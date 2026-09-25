import express from 'express';
import { z } from 'zod';
import { In } from 'typeorm';
import { AppDataSource } from '../../database';
import { OrganizationSettings } from '../../entity/organization';
import { Member, ROLES } from '../../entity/member';
import { AccountMfa } from '../../entity/accountSecurity';
import { route } from '../common/request-schema';
import { staffOnly } from '../common/staff-auth';
import { validEmail } from '../../contact/validation';
import { lockIdentities, rejectDuplicateContact } from '../../billing/member-identity';
import { authorizeAccountChange } from '../../security/staff-permissions';
import { recordAudit, snapshot } from '../../staff/audit';
import { fail } from '../../billing/payments';
import { demoMemberId } from '../../demo/identity';
import { localConfig } from '../../dev/config';
import { validTimeZone } from '../../organization/time';
import { acceptOrganizationSettings } from '../../organization/settings';

const router = express.Router();
const text = z.string().trim().min(1).max(150);
const email = z.string().trim().toLowerCase().refine(validEmail, 'Enter a valid email address.');
const role = z.enum(['member', 'staff', 'admin']);
const staffFields = ['firstName', 'lastName', 'email', 'role', 'loginDisabled'];
const update = z
  .object({
    firstName: text,
    lastName: text,
    email,
    role,
    loginDisabled: z.boolean(),
    staffVersion: z.number().int().nonnegative(),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();
function publicStaff(m: Member) {
  return {
    id: m.id,
    firstName: m.firstName,
    lastName: m.lastName,
    email: m.email,
    role: m.role,
    loginDisabled: m.loginDisabled,
    staffVersion: m.staffVersion,
    hasPassword: /^\$2[aby]\$/.test(m.password || ''),
    protected: localConfig.runtimeMode === 'hosted-demo' && m.id === demoMemberId,
  };
}
router.get(
  '/public',
  route(async (_req, res) => {
    const settings = await AppDataSource.manager.findOneByOrFail(OrganizationSettings, {
      id: 'default',
    });
    res.json({
      name: settings.name,
      supportEmail: settings.supportEmail,
      timezone: settings.timezone,
    });
  }),
);
router.use(staffOnly, (req, res, next) => {
  if (req.member?.role !== ROLES.ADMIN)
    return res.status(403).json({ message: 'Administration access is required.' });
  next();
});
router.get(
  '/',
  route(async (req, res) => {
    const [settings, staff, mfa] = await Promise.all([
      AppDataSource.manager.findOneByOrFail(OrganizationSettings, { id: 'default' }),
      AppDataSource.manager.find(Member, {
        where: { role: In([ROLES.ADMIN, ROLES.STAFF]) },
        order: { lastName: 'ASC', firstName: 'ASC' },
      }),
      AppDataSource.manager.find(AccountMfa, { select: { memberId: true, secret: true } }),
    ]);
    res.json({
      settings,
      staff: staff.map((m) => ({
        ...publicStaff(m),
        mfaEnabled: !!mfa.find((a) => a.memberId === m.id)?.secret,
      })),
      currentUserId: req.member.id,
    });
  }),
);
router.put(
  '/settings',
  route(
    z
      .object({
        name: z.string().trim().min(1).max(120),
        supportEmail: email,
        timezone: z.string().refine(validTimeZone, 'Choose a valid IANA time zone.').optional(),
        revision: z.number().int().positive(),
      })
      .strict(),
    async (req, res) => {
      const saved = await AppDataSource.transaction(async (manager) => {
        await lockIdentities(manager);
        const actor = await manager.findOneByOrFail(Member, { id: req.member.id });
        if (
          actor.role !== ROLES.ADMIN ||
          actor.loginDisabled ||
          actor.tokenVersion !== req.member.tokenVersion
        )
          fail('Your administrative access changed. Sign in again.', 401);
        const settings = await manager.findOneOrFail(OrganizationSettings, {
          where: { id: 'default' },
          lock: { mode: 'pessimistic_write' },
        });
        if (settings.revision !== req.body.revision)
          fail('Organization settings changed. Reload before saving.', 409);
        const before = {
          name: settings.name,
          supportEmail: settings.supportEmail,
          timezone: settings.timezone,
        };
        Object.assign(settings, req.body, { revision: settings.revision + 1 });
        await manager.save(settings);
        await recordAudit(manager, {
          kind: 'Organization settings changed',
          author: req.member.email,
          before,
          after: {
            name: settings.name,
            supportEmail: settings.supportEmail,
            timezone: settings.timezone,
          },
        });
        return settings;
      });
      acceptOrganizationSettings(saved);
      res.json(saved);
    },
  ),
);
router.get(
  '/candidates',
  route(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q.length < 2 || q.length > 150)
      fail('Enter at least two characters to find an existing member.');
    const members = await AppDataSource.manager
      .createQueryBuilder(Member, 'm')
      .where('m.role = :role', { role: ROLES.MEMBER })
      .andWhere('(m.firstName LIKE :q OR m.lastName LIKE :q OR m.email LIKE :q)', {
        q: '%' + q.replace(/[%_\\]/g, '') + '%',
      })
      .orderBy('m.lastName', 'ASC')
      .take(20)
      .getMany();
    res.json({ rows: members.map(publicStaff) });
  }),
);
router.post(
  '/staff',
  route(
    z.object({ firstName: text, lastName: text, email, role: z.enum(['staff', 'admin']) }).strict(),
    async (req, res) => {
      const saved = await AppDataSource.transaction(async (manager) => {
        await lockIdentities(manager);
        const actor = await manager.findOneByOrFail(Member, { id: req.member.id });
        if (
          actor.role !== ROLES.ADMIN ||
          actor.loginDisabled ||
          actor.tokenVersion !== req.member.tokenVersion
        )
          fail('Your administrative access changed. Sign in again.', 401);
        await rejectDuplicateContact(manager, req.body.email);
        const staff = await manager.save(
          Member,
          manager.create(Member, {
            ...req.body,
            role: req.body.role as ROLES,
            paypalEmail: '',
            password: 'Not Set',
          }),
        );
        await recordAudit(manager, {
          memberId: staff.id,
          entityId: staff.id,
          kind: 'Staff account created',
          author: req.member.email,
          after: snapshot(staff, staffFields),
        });
        return staff;
      });
      res.status(201).json(publicStaff(saved));
    },
  ),
);
router.put(
  '/staff/:id',
  route(update, async (req, res) => {
    const saved = await AppDataSource.transaction(async (manager) => {
      await lockIdentities(manager);
      const current = await manager.findOne(Member, {
        where: { id: req.params.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!current) fail('Account not found.', 404);
      if (current.staffVersion !== req.body.staffVersion)
        fail('This account changed. Reload before saving.', 409);
      const patch = {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email,
        role: req.body.role as ROLES,
        loginDisabled: req.body.loginDisabled,
      };
      await authorizeAccountChange(manager, req.member, current, patch);
      await rejectDuplicateContact(manager, patch.email, current.id);
      const before = snapshot(current, staffFields);
      const changed = JSON.stringify(before) !== JSON.stringify(snapshot(patch, staffFields));
      if (changed) {
        Object.assign(current, patch, {
          staffVersion: current.staffVersion + 1,
          tokenVersion: current.tokenVersion + 1,
        });
        await manager.save(current);
        await recordAudit(manager, {
          memberId: current.id,
          entityId: current.id,
          kind: 'Staff account updated',
          author: req.member.email,
          before,
          after: snapshot(current, staffFields),
          reason: req.body.reason,
        });
      }
      return current;
    });
    res.json(publicStaff(saved));
  }),
);
module.exports = router;
