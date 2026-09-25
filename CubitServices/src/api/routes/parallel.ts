import express from 'express';
import { z } from 'zod';
import { staffOnly } from '../common/staff-auth';
import { localConfig } from '../../dev/config';
import {
  generationStatus,
  json,
  parallelEnabled,
  parallelMember,
  readParallel,
} from '../../parallel/reader';
import { billingLedger } from '../../billing/ledger';
import { AppDataSource } from '../../database';
import { ParallelSubscriptionLink } from '../../entity/parallelSubscription';
import { recordAudit } from '../../staff/audit';

const router = express.Router();
router.use(staffOnly);
router.use((_req, res, next) => {
  if (localConfig.runtimeMode === 'hosted-demo')
    return res
      .status(403)
      .json({ message: 'Live mirror data is not available in the synthetic demo.' });
  if (!parallelEnabled())
    return res.status(503).json({ message: 'Parallel workspace has not been connected yet.' });
  next();
});
router.get('/status', async (_req, res, next) => {
  try {
    res.json(
      await readParallel(async (db, g) => {
        const [runs] = await db.query(
          'SELECT status,detail,createdAt FROM parallel_run ORDER BY id DESC LIMIT 20',
        );
        return {
          ...generationStatus(g),
          runs,
          intervalMinutes: 15,
          links: await AppDataSource.manager.count(ParallelSubscriptionLink),
        };
      }),
    );
  } catch (e) {
    next(e);
  }
});
router.get('/records', async (req, res, next) => {
  try {
    const parsed = z
      .object({
        kind: z.enum(['member', 'transaction', 'access_log', 'plan']).default('member'),
        q: z.string().max(100).default(''),
        page: z.coerce.number().int().min(1).max(100000).default(1),
        pageSize: z.coerce.number().int().min(10).max(100).default(20),
        memberId: z.string().max(255).optional(),
      })
      .safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ message: 'Invalid list filters.' });
    const { kind, q, page, pageSize, memberId } = parsed.data;
    res.json(
      await readParallel(async (db, g) => {
        if (!g) return { rows: [], total: 0, snapshot: generationStatus(g) };
        const where =
          'generation=? AND kind=?' +
          (q ? ' AND LOCATE(?,searchText)>0' : '') +
          (memberId ? ' AND memberId=?' : '');
        const args: any[] = [g.id, kind, ...(q ? [q] : []), ...(memberId ? [memberId] : [])];
        const [[total]] = await db.query<any[]>(
          'SELECT COUNT(*) AS n FROM parallel_record WHERE ' + where,
          args,
        );
        const safePage = Math.min(page, Math.max(1, Math.ceil(total.n / pageSize)));
        const [rows] = await db.query<any[]>(
          'SELECT payload FROM parallel_record WHERE ' +
            where +
            (kind === 'member'
              ? ' ORDER BY searchText,sourceId'
              : ' ORDER BY dateValue DESC,sourceId') +
            ' LIMIT ? OFFSET ?',
          [...args, pageSize, (safePage - 1) * pageSize],
        );
        return {
          rows: rows.map((r) => json(r.payload)),
          total: total.n,
          page: safePage,
          pageSize,
          snapshot: generationStatus(g),
        };
      }),
    );
  } catch (e) {
    next(e);
  }
});
router.get('/members/:id', async (req, res, next) => {
  try {
    const result = await parallelMember(req.params.id);
    let projection: any = null;
    try {
      projection = billingLedger(
        result.memberships,
        result.payments,
        result.snapshot.sourceTime!.slice(0, 10),
      );
    } catch {
      /* Source facts remain viewable when legacy dates cannot be projected. */
    }
    const links = await AppDataSource.manager.findBy(ParallelSubscriptionLink, {
      memberId: req.params.id,
    });
    res.json({
      ...result,
      links,
      projection,
      projectionWarning:
        'Estimate using copied plan prices and dates. Historical rates and final billing dates may be incomplete. This does not control billing or doors.',
    });
  } catch (e) {
    next(e);
  }
});
const linkSchema = z
  .object({
    memberId: z.string().min(1).max(255),
    merchantAccount: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_-]{5,64}$/),
    subscriptionId: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^I-[A-Z0-9]{5,60}$/),
    subscriptionPlanId: z
      .string()
      .trim()
      .max(64)
      .regex(/^(?:P-[A-Za-z0-9]+)?$/)
      .default(''),
    reason: z.string().trim().min(10).max(255),
    confirmed: z.literal(true),
    revision: z.number().int().min(0),
  })
  .strict();
router.put('/subscription-links/:id', async (req, res, next) => {
  try {
    const parsed = linkSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({
        message:
          'Enter the PayPal account, subscription ID, evidence/reason, and confirm the membership match.',
      });
    const input = parsed.data;
    const source = await parallelMember(input.memberId);
    if (source.snapshot.stale)
      return res
        .status(409)
        .json({ message: 'Wait for a fresh snapshot before linking a subscription.' });
    if (!source.memberships.some((p) => p.id === req.params.id))
      return res.status(404).json({ message: 'Membership not found in the current snapshot.' });
    const result = await AppDataSource.transaction(async (manager) => {
      const before = await manager.findOne(ParallelSubscriptionLink, {
        where: { membershipId: req.params.id },
        lock: { mode: 'pessimistic_write' },
      });
      if ((before?.revision || 0) !== input.revision)
        throw Object.assign(Error('This link changed. Reload the member before editing.'), {
          status: 409,
        });
      const saved = await manager.save(ParallelSubscriptionLink, {
        membershipId: req.params.id,
        memberId: input.memberId,
        merchantAccount: input.merchantAccount,
        subscriptionId: input.subscriptionId,
        subscriptionPlanId: input.subscriptionPlanId,
        reason: input.reason,
        confirmedBy: req.member!.email,
        confirmedAt: new Date(),
        revision: input.revision + 1,
      });
      await recordAudit(manager, {
        kind: 'Parallel subscription linked',
        author: req.member!.email,
        entityId: saved.membershipId,
        before: before
          ? { subscriptionId: before.subscriptionId, merchantAccount: before.merchantAccount }
          : null,
        after: {
          memberId: input.memberId,
          membershipId: saved.membershipId,
          merchantAccount: saved.merchantAccount,
          subscriptionId: saved.subscriptionId,
          subscriptionPlanId: saved.subscriptionPlanId,
        },
        reason: input.reason,
      });
      return saved;
    });
    res.json(result);
  } catch (e: any) {
    if (e.code === 'ER_DUP_ENTRY')
      return res
        .status(409)
        .json({ message: 'That subscription is already linked to another membership.' });
    next(e);
  }
});
// Default deny, including any future unimplemented business mutation.
router.use((_req, res) =>
  res
    .status(403)
    .json({ message: 'Mirrored records are read-only. Make operational changes in Tonic.' }),
);
module.exports = router;
