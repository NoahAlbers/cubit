import express from 'express';
import { signedIn } from '../common/member-auth';
import { staffOnly } from '../common/staff-auth';
import { loginLimit } from '../common/login-limit';
import { AppDataSource } from '../../database';
import { AccountMfa, AccountNotice } from '../../entity/accountSecurity';
import { IsNull } from 'typeorm';
import { recordAudit } from '../../staff/audit';
import { Member } from '../../entity/member';
import {
  beginMfa,
  confirmMfa,
  issueAccountLink,
  redeemAccountLink,
  mfaConfigured,
} from '../../security/accounts';
import { localConfig } from '../../dev/config';
import { demoMemberId } from '../../demo/identity';

const router = express.Router(),
  limit = loginLimit();
const route =
  (fn: (req: express.Request, res: express.Response) => Promise<unknown>): express.RequestHandler =>
  async (req, res, next) => {
    try {
      await fn(req, res);
    } catch (error) {
      next(error);
    }
  };
function body(req: express.Request, fields: string[]) {
  if (
    !req.body ||
    typeof req.body !== 'object' ||
    Array.isArray(req.body) ||
    Object.keys(req.body).some((k) => !fields.includes(k))
  )
    throw Object.assign(Error('Unexpected account field.'), { status: 400 });
  return req.body as Record<string, unknown>;
}
router.post(
  '/redeem',
  limit,
  route(async (req, res) => {
    const b = body(req, ['token', 'password', 'code']);
    await redeemAccountLink(b.token, b.password, b.code);
    res.json({ message: 'Password saved. Sign in with your new password.' });
  }),
);
router.get(
  '/',
  signedIn,
  route(async (req, res) => {
    const mfa = await AppDataSource.manager.findOneBy(AccountMfa, { memberId: req.member!.id });
    res.json({
      mfaEnabled: !!mfa?.secret,
      email: req.member!.email,
      passwordResetEmailAvailable: false,
      mfaAvailable: mfaConfigured(),
      sharedDemo: localConfig.runtimeMode === 'hosted-demo' && req.member!.id === demoMemberId,
    });
  }),
);
router.post(
  '/password-reset/request',
  limit,
  staffOnly,
  route(async (req, res) => {
    body(req, []);
    // A future transport must verify the account email and issue a scoped,
    // single-use link. Do not mint a token or queue mail while disconnected.
    res
      .status(503)
      .json({
        message:
          'Password-reset email is not connected. Ask an administrator for a private reset link.',
        deliveryEnabled: false,
      });
  }),
);
router.get(
  '/notices/count',
  staffOnly,
  route(async (req, res) => {
    res.json({
      count: await AppDataSource.manager.countBy(AccountNotice, { acknowledgedAt: IsNull() }),
    });
  }),
);
router.get(
  '/notices',
  staffOnly,
  route(async (req, res) => {
    res.json({
      rows: await AppDataSource.manager.find(AccountNotice, {
        where: { acknowledgedAt: IsNull() },
        order: { createdAt: 'DESC' },
        take: 100,
      }),
    });
  }),
);
router.post(
  '/notices/:id/acknowledge',
  staffOnly,
  route(async (req, res) => {
    body(req, []);
    const id = req.params.id;
    if (typeof id !== 'string' || !/^[a-f\d-]{36}$/i.test(id))
      throw Object.assign(Error('Choose an account notice.'), { status: 400 });
    await AppDataSource.transaction(async (manager) => {
      const notice = await manager.findOne(AccountNotice, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!notice) throw Object.assign(Error('Notice not found.'), { status: 404 });
      if (notice.acknowledgedAt) return;
      await manager.update(AccountNotice, notice.id, {
        acknowledgedAt: new Date(),
        acknowledgedBy: req.member!.id,
      });
      await recordAudit(manager, {
        memberId: notice.memberId,
        kind: 'Login email change acknowledged',
        author: req.member!.email,
        entityId: notice.id,
        after: { acknowledged: true },
      });
    });
    res.status(204).end();
  }),
);
router.post(
  '/members/:id/link',
  limit,
  staffOnly,
  route(async (req, res) => {
    const b = body(req, ['purpose']),
      id = req.params.id;
    if (typeof id !== 'string' || !/^[a-f\d-]{36}$/i.test(id))
      throw Object.assign(Error('Choose a member.'), { status: 400 });
    if (!(await AppDataSource.manager.existsBy(Member, { id })))
      return res.status(404).json({ message: 'Member not found.' });
    res.status(201).json(await issueAccountLink(id, req.member!, b.purpose));
  }),
);
router.post(
  '/mfa/start',
  limit,
  staffOnly,
  route(async (req, res) => {
    const b = body(req, ['password']);
    res.json(await beginMfa(req.member!.id, b.password));
  }),
);
router.post(
  '/mfa/confirm',
  limit,
  staffOnly,
  route(async (req, res) => {
    const b = body(req, ['password', 'code']);
    res.json(await confirmMfa(req.member!.id, b.password, b.code));
  }),
);
module.exports = router;
