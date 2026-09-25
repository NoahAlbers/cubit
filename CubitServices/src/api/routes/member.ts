import { authorizeAccountChange } from '../../security/staff-permissions';
import { recordAudit, snapshot, profileFields } from '../../staff/audit';
import { memberInput } from '../common/member-input';
import { AppDataSource } from '../../database';
import express from 'express';
import { Member, ROLES } from '../../entity/member';
import { randomUUID } from 'crypto';
import { MemberPlan } from '../../entity/memberPlan';
import { localConfig } from '../../dev/config';
import { demoEmail, demoMemberId } from '../../demo/identity';
import { lockIdentities, rejectDuplicateContact } from '../../billing/member-identity';

const router = express.Router();
const memberClass = new Member();

// The active directory uses /api/cubit/members with bounded pagination.
router.get('/', (_req, res) =>
  res.status(410).json({ message: 'Use the paginated member directory at /api/cubit/members.' }),
);
const publicFields = [
  'id',
  'firstName',
  'lastName',
  'email',
  'paypalEmail',
  'phone',
  'emergencyContact',
  'emergencyEmail',
  'emergencyPhone',
  'picture',
  'role',
  'status',
  'statusReason',
  'balance',
] as const;
const publicMember = (member: Partial<Member>) =>
  Object.fromEntries(publicFields.map((k) => [k, member[k]]));

router.put('/', async (req, res, next) => {
  try {
    const postedMemberData = memberInput(req.body);
    const reason = postedMemberData.reason?.trim();
    delete postedMemberData.reason;
    if (
      localConfig.runtimeMode === 'hosted-demo' &&
      postedMemberData.id === demoMemberId &&
      ((postedMemberData.email !== undefined && postedMemberData.email !== demoEmail) ||
        (postedMemberData.role !== undefined && postedMemberData.role !== ROLES.ADMIN) ||
        postedMemberData.password)
    )
      return res
        .status(403)
        .json({ message: 'The shared demo sign-in email, password and role cannot be changed.' });

    await AppDataSource.transaction(async (manager) => {
      await lockIdentities(manager);
      const before = await manager.findOneOrFail(Member, {
        where: { id: postedMemberData.id },
        lock: { mode: 'pessimistic_write' },
      });
      await authorizeAccountChange(manager, req.member!, before, postedMemberData);
      postedMemberData.staffVersion = before.staffVersion + 1;
      if (
        typeof postedMemberData.email === 'string' &&
        postedMemberData.email.trim().toLowerCase() !== before.email.trim().toLowerCase()
      ) {
        await rejectDuplicateContact(manager, postedMemberData.email, postedMemberData.id);
        if (!reason)
          throw Object.assign(Error('Give a reason for changing the login email.'), {
            status: 400,
          });
      }
      if (
        (postedMemberData.role !== undefined && postedMemberData.role !== before.role) ||
        (postedMemberData.email !== undefined && postedMemberData.email !== before.email)
      )
        postedMemberData.tokenVersion = before.tokenVersion + 1;
      const saved = await manager.save(Member, postedMemberData);
      const after = { ...before, ...saved },
        oldValues = snapshot(before, profileFields),
        newValues = snapshot(after, profileFields);
      if (JSON.stringify(oldValues) !== JSON.stringify(newValues))
        await recordAudit(manager, {
          memberId: before.id,
          kind: 'Member details updated',
          author: req.member!.email,
          entityId: before.id,
          before: oldValues,
          after: newValues,
          reason,
        });
      return saved;
    })
      .then((member: Member) => {
        //remove the password field from the payload
        //say everything is happy with a 200 status
        //and pass the result as json
        member.password = '';

        return res.status(200).json(publicMember(member));
      })
      .catch((err) => {
        //oh nos! we have an error
        next(err);
      });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const memberClass = new Member();

    const input = memberInput(req.body, true);
    delete input.reason;
    const member: Member = input;
    member.id = randomUUID();

    if (await memberClass.checkForDuplicateEmail(member.email)) {
      res.status(409).json({ message: 'A member already exists with this e-mail address' });
      return;
    }

    member.password = 'Not Set';
    member.role = ROLES.MEMBER;

    await AppDataSource.transaction(async (manager) => {
      await lockIdentities(manager);
      await rejectDuplicateContact(manager, member.email);
      const result = await manager.insert(Member, member);
      await recordAudit(manager, {
        memberId: member.id,
        kind: 'Member created',
        author: req.member!.email,
        entityId: member.id,
        after: snapshot(member, profileFields),
      });
      return result;
    })
      .then(() => {
        //remove the password field from the payload
        //say everything is happy with a 200 status
        //and pass the result as json
        member.password = '';

        return res.status(200).json(publicMember(member));
      })
      .catch((err) => {
        //oh nos! we have an error
        next(err);
      });
  } catch (err) {
    next(err);
  }
});

router.get('/refreshStatus', async (req, res, next) => {
  try {
    await memberClass.updateAllMemberBalancesAndStatus();
    res.status(200).json({ result: 'completed' });
  } catch (error) {
    next(error);
  }
});

router.get('/:memberId', (req, res, next) => {
  AppDataSource.manager
    .findOneOrFail(Member, {
      where: { id: req.params.memberId },
      select: Object.fromEntries(publicFields.map((k) => [k, true])),
    })
    .then((member: Member) => {
      member.password = '';

      res.status(200).json(publicMember(member));
    })
    .catch((err) => {
      next(err);
    });
});

router.get('/balance/:memberId', async (req, res, next) => {
  try {
    const balance = await memberClass.getCurrentBalance(req.params.memberId);

    res.status(200).json(balance);
  } catch (err) {
    next(err);
  }
});

router.get('/isActive/:memberId', async (req, res, next) => {
  try {
    res.status(200).json(await memberClass.isMemberActive(req.params.memberId));
  } catch (err) {
    next(err);
  }
});

router.get('/plans/:memberId', (req, res, next) => {
  AppDataSource.manager
    .find(MemberPlan, {
      where: { member: { id: req.params.memberId } },
      relations: { plan: true },
    })
    .then((memberPlans) => {
      res.status(200).json(memberPlans);
    })
    .catch((err) => {
      next(err);
    });
});

module.exports = router;
