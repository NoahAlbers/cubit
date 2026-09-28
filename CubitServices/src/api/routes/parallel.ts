import { OperationsSettings } from '../../entity/cubitOperations';
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
          comparisonGraceDays: (
            await AppDataSource.manager.findOneByOrFail(OperationsSettings, { id: 'default' })
          ).graceDays,
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
    res.json({
      ...result,
      projection,
      projectionWarning:
        'Estimate using copied plan prices and dates. Historical rates and final billing dates may be incomplete. This does not control billing or doors.',
    });
  } catch (e) {
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
