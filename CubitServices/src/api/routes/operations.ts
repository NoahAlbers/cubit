import { route, bodies } from '../common/request-schema';
import { recordAudit } from '../../staff/audit';
import express from 'express';
import { AppDataSource } from '../../database';
import { staffOnly } from '../common/staff-auth';
import { Member } from '../../entity/member';
import { localConfig } from '../../dev/config';
import {
  StaffNote,
  ChargeAdjustment,
  BillingCharge,
  OperationsSettings,
  OperationsAudit,
  AutomationRun,
  PaymentEvent,
} from '../../entity/cubitOperations';
import { lockMember, postCharges, readBilling, refreshAccess } from '../../billing/store';
import { fail, reasonText, requestKey } from '../../billing/payments';
import { runAutomation } from '../../billing/automation';
import { receiveSimulation, processEvent } from '../../billing/event-inbox';
import { reportData, exportReport } from '../../billing/reports';
import { addCharge, editCharge } from '../../billing/charge-edits';
const router = express.Router();
router.use(staffOnly);

router.get(
  '/members/:id/notes',
  route(async (req, res) => {
    if (!(await AppDataSource.manager.findOneBy(Member, { id: req.params.id })))
      fail('Member not found.', 404);
    res.json(
      await AppDataSource.manager.find(StaffNote, {
        where: { memberId: req.params.id },
        order: { createdAt: 'DESC', id: 'DESC' },
      }),
    );
  }),
);
router.post(
  '/members/:id/notes',
  route(bodies.note, async (req, res) => {
    const text = reasonText(req.body.text, 4000);
    res.status(201).json(
      await AppDataSource.transaction(async (manager) => {
        await lockMember(manager, req.params.id);
        const note = await manager.save(
          StaffNote,
          manager.create(StaffNote, { memberId: req.params.id, text, author: req.member.email }),
        );
        await recordAudit(manager, {
          memberId: req.params.id,
          kind: 'Staff note added',
          author: req.member.email,
          entityId: note.id,
          after: { text },
        });
        return note;
      }),
    );
  }),
);
router.get(
  '/members/:id/operations',
  route(async (req, res) => {
    const member = await AppDataSource.manager.findOneBy(Member, { id: req.params.id });
    if (!member) fail('Member not found.', 404);
    res.json({
      accessHold: member.accessHold,
      accessHoldReason: member.accessHoldReason,
      history: await AppDataSource.manager.find(OperationsAudit, {
        where: { memberId: member.id },
        order: { createdAt: 'DESC' },
        take: 50,
      }),
    });
  }),
);
router.post(
  '/members/:id/operations',
  route(bodies.access, async (req, res) => {
    const reason = reasonText(req.body.reason);
    if (
      typeof req.body.accessHold !== 'boolean' ||
      Object.keys(req.body).some((k) => !['accessHold', 'reason'].includes(k))
    )
      fail('Invalid access settings.');
    await AppDataSource.transaction(async (manager) => {
      const member = await lockMember(manager, req.params.id);
      const before = { accessHold: member.accessHold, accessHoldReason: member.accessHoldReason };
      member.accessHold = req.body.accessHold;
      member.accessHoldReason = member.accessHold ? reason : '';
      await manager.save(member);
      await postCharges(manager, member.id);
      await refreshAccess(manager, member, req.member.email);
      await recordAudit(manager, {
        memberId: member.id,
        author: req.member.email,
        kind: 'Staff access change',
        before,
        after: { accessHold: member.accessHold, accessHoldReason: member.accessHoldReason },
        reason,
      });
    });
    res.json({ saved: true });
  }),
);
router.post(
  '/charges/:id/adjustments',
  route(bodies.credit, async (req, res) => {
    const credit = Number(req.body.credit),
      reason = reasonText(req.body.reason),
      key = requestKey(req.body.requestKey);
    if (
      !Number.isFinite(credit) ||
      credit <= 0 ||
      Math.abs(credit * 100 - Math.round(credit * 100)) > 0.00001
    )
      fail('Enter a positive credit with at most two decimals.');
    const result = await AppDataSource.transaction(async (manager) => {
      const lookup = await manager.findOneBy(BillingCharge, { id: req.params.id });
      if (!lookup) fail('Charge not found.', 404);
      const member = await lockMember(manager, lookup.memberId);
      const duplicate = await manager.findOneBy(ChargeAdjustment, { requestKey: key });
      if (duplicate) {
        if (duplicate.chargeId !== lookup.id || Number(duplicate.credit) !== credit)
          fail('Request ID conflict.', 409);
        return duplicate;
      }
      const state = await readBilling(manager, member.id);
      const charge = state.ledger.charges.find((c) => c.id === lookup.id);
      if (!charge || Math.round(credit * 100) > Math.round(charge.amount * 100))
        fail('Credit exceeds the remaining charge amount.');
      const saved = await manager.save(
        ChargeAdjustment,
        manager.create(ChargeAdjustment, {
          memberId: member.id,
          chargeId: lookup.id,
          credit,
          reason,
          author: req.member.email,
          requestKey: key,
        }),
      );
      await recordAudit(manager, {
        memberId: member.id,
        kind: 'Charge credit applied',
        author: req.member.email,
        entityId: lookup.id,
        before: { amount: charge.amount },
        after: { amount: charge.amount - credit },
        reason,
      });
      await refreshAccess(manager, member, req.member.email);
      return saved;
    });
    res.json(result);
  }),
);
router.post(
  '/members/:id/charges',
  route(bodies.charge, async (req, res) => {
    res.json(
      await AppDataSource.transaction((manager) =>
        addCharge(manager, req.params.id, req.body, req.member.email),
      ),
    );
  }),
);
router.post(
  '/charges/:id/correct',
  route(bodies.correction, async (req, res) => {
    res.json(
      await AppDataSource.transaction((manager) =>
        editCharge(manager, req.params.id, req.body, req.member.email),
      ),
    );
  }),
);
router.get(
  '/automation',
  route(async (req, res) => {
    const [settings, runs, events, audit] = await Promise.all([
      AppDataSource.manager.findOneByOrFail(OperationsSettings, { id: 'default' }),
      AppDataSource.manager.find(AutomationRun, { order: { createdAt: 'DESC' }, take: 30 }),
      AppDataSource.manager.find(PaymentEvent, { order: { createdAt: 'DESC' }, take: 100 }),
      AppDataSource.manager.find(OperationsAudit, {
        where: { kind: 'Automation settings changed' },
        order: { createdAt: 'DESC' },
        take: 20,
      }),
    ]);
    res.json({
      settings,
      migration: settings.migrationSummary ? JSON.parse(settings.migrationSummary) : null,
      runs: runs.map((r) => {
        const s = JSON.parse(r.summary);
        return {
          ...r,
          summary: {
            date: s.date,
            members: s.members,
            newCharges: s.newCharges,
            accessChanges: s.accessChanges,
            error: s.error,
          },
        };
      }),
      events,
      audit,
      mode:
        localConfig.runtimeMode === 'hosted-demo'
          ? 'Synthetic demo: all members, payments and visits are fictional. Changes affect demo data only.'
          : localConfig.dataMode === 'imported'
            ? 'Reviewing imported membership data. No live integrations.'
            : 'Local development: payment events are simulations.',
      schedule:
        localConfig.runtimeMode === 'hosted-demo'
          ? 'Automatic processing is paused. Preview or run processing manually on the synthetic data.'
          : localConfig.dataMode === 'imported'
            ? 'Automatic processing is paused for the imported-data review. Billing dates use UTC to preserve the imported dates.'
            : 'Daily after 9:00 AM in this PC’s timezone, while Cubit is running. Missed runs catch up at the next start.',
      imported: localConfig.dataMode === 'imported' || localConfig.runtimeMode === 'hosted-demo',
    });
  }),
);
router.post(
  '/automation/settings',
  route(bodies.automation, async (req, res) => {
    const b = req.body;
    if (
      (localConfig.dataMode === 'imported' || localConfig.runtimeMode === 'hosted-demo') &&
      b.dailyEnabled
    )
      fail('Automatic processing is paused in this review environment.');
    if (
      Object.keys(b).some(
        (k) => !['id', 'graceDays', 'dailyEnabled', 'version', 'migrationSummary'].includes(k),
      ) ||
      !Number.isInteger(b.graceDays) ||
      b.graceDays < 0 ||
      b.graceDays > 365 ||
      typeof b.dailyEnabled !== 'boolean'
    )
      fail('Enter 0–365 grace days and valid billing settings.');
    const saved = await AppDataSource.transaction(async (manager) => {
      const settings = await manager.findOneOrFail(OperationsSettings, {
        where: { id: 'default' },
        lock: { mode: 'pessimistic_write' },
      });
      if (b.version !== settings.version) fail('Settings changed. Reload before saving.', 409);
      const before = { ...settings };
      settings.graceDays = b.graceDays;
      settings.dailyEnabled = b.dailyEnabled;
      settings.version++;
      await manager.save(settings);
      await recordAudit(manager, {
        kind: 'Automation settings changed',
        author: req.member.email,
        before: { graceDays: before.graceDays, dailyEnabled: before.dailyEnabled },
        after: { graceDays: settings.graceDays, dailyEnabled: settings.dailyEnabled },
      });
      return settings;
    });
    res.json(saved);
  }),
);
router.post(
  '/automation/run',
  route(bodies.run, async (req, res) => {
    if (typeof req.body.preview !== 'boolean') fail('Choose preview or apply.');
    res.json(await runAutomation(req.body.preview, req.member.email));
  }),
);
router.post(
  '/automation/events/simulate',
  route(bodies.simulation, async (req, res) =>
    res.status(201).json(await receiveSimulation(req.body, req.member.email)),
  ),
);
router.post(
  '/automation/events/:id/process',
  route(bodies.match, async (req, res) => {
    try {
      res.json(
        await processEvent(
          req.params.id,
          req.body.memberId,
          req.member.email,
          req.body.createMember,
        ),
      );
    } catch (err) {
      await AppDataSource.manager
        .createQueryBuilder()
        .update(PaymentEvent)
        .set({
          status: 'Needs review',
          detail: err instanceof Error ? err.message : 'Processing failed',
          attempts: () => 'attempts + 1',
        })
        .where('id = :id AND status != :done', { id: req.params.id, done: 'Processed' })
        .execute();
      throw err;
    }
  }),
);
router.get(
  '/reports',
  route(async (req, res) => {
    const data = await reportData(req.query);
    const { roster, payments, visits, overdue, ...dashboard } = data;
    res.json(dashboard);
  }),
);
router.get(
  '/reports/:type.csv',
  route(async (req, res) => {
    if (!['roster', 'transactions', 'overdue', 'checkins'].includes(req.params.type))
      fail('Report not available.', 404);
    const data = await reportData(req.query);
    const contents = exportReport(req.params.type, data);
    await recordAudit(AppDataSource.manager, {
      kind: 'Report exported',
      author: req.member.email,
      after: { report: req.params.type, from: data.from, to: data.to },
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="cubit-${req.params.type}-${data.asOf}.csv"`,
    );
    res.send(contents);
  }),
);
module.exports = router;
