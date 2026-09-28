import express from 'express';
import { localConfig } from '../dev/config';
import { parallelEnabled } from './reader';
import { integratedSnapshot } from './integrated-snapshot';
import { staffOnly } from '../api/common/staff-auth';
import { AppDataSource } from '../database';
import { OperationsSettings } from '../entity/cubitOperations';
import { filterDirectory } from '../billing/directory';
import { buildReportData, exportReport, reportRange } from '../billing/reports';
import { accessLogOptions } from '../billing/access-log-options';
import { sortPlans } from '../billing/plan-order';
import { recordAudit } from '../staff/audit';

export const integratedEnabled = () =>
  parallelEnabled() &&
  localConfig.runtimeMode === 'hosted-review' &&
  process.env.PARALLEL_INTEGRATED === 'true';
export const integratedRequired = () =>
  integratedEnabled() && process.env.PARALLEL_REQUIRED === 'true';
const business =
  /^\/(?:member|plan|transaction|key|accessLog)(?:\/|$)|^\/api\/(?:cubit|waivers|portal)(?:\/|$)|^\/api\/account\/members(?:\/|$)/;
const staffPreferences = /^\/api\/cubit\/staff\/preferences(?:\/|$)/;
export const integratedMiddleware = express.Router();
integratedMiddleware.use((req, res, next) => {
  if (!business.test(req.path) || staffPreferences.test(req.path)) return next();
  const selection = req.header('X-Cubit-Workspace');
  if (selection && !['parallel', 'review'].includes(selection))
    return res.status(400).json({ message: 'Invalid workspace.' });
  if (selection === 'review') {
    if (integratedRequired())
      return res.status(403).json({
        message: 'The old review copy is retired. Member data comes from the read-only Tonic feed.',
      });
    return next();
  }
  if (!integratedEnabled()) {
    if (selection === 'parallel')
      return res
        .status(503)
        .json({ message: 'Parallel testing is not available in this environment.' });
    return next();
  }
  return staffOnly(req, res, async (error) => {
    if (error) return next(error);
    try {
      res.setHeader('X-Cubit-Workspace', 'parallel');
      if (req.method !== 'GET')
        return res.status(403).json({
          message:
            'Parallel testing is read-only. Make operational changes in Tonic, or switch to Editable review for isolated experiments.',
        });
      const pinned = req.header('X-Cubit-Snapshot');
      if (!pinned)
        return res.status(428).json({
          message:
            'Select a complete snapshot before opening parallel data. Refresh the workspace.',
        });
      // Reject unavailable datasets before any fallback can read the editable copy.
      if (
        /^\/api\/(waivers|portal)\b|^\/api\/account\/members\b|^\/api\/cubit\/(audit|payment-matching|matching-members)\b/.test(
          req.path,
        )
      )
        return res.status(409).json({
          message:
            'This dataset is not included in the Tonic snapshot. Review data is never substituted in parallel testing.',
        });
      const settings = await AppDataSource.manager.findOneByOrFail(OperationsSettings, {
        id: 'default',
      });
      const graceHeader = req.header('X-Cubit-Grace-Days');
      const grace = graceHeader === undefined ? settings.graceDays : Number(graceHeader);
      if (!Number.isInteger(grace) || grace < 0 || grace > 365)
        return res.status(400).json({ message: 'Invalid comparison grace window.' });
      const d = await integratedSnapshot(pinned, grace);
      res.setHeader('X-Cubit-Snapshot', d.snapshot.id);
      res.setHeader('X-Cubit-Source-Time', d.snapshot.sourceTime);
      res.setHeader('X-Cubit-Currency', 'USD');
      const path = req.path.replace(/\/$/, '');
      const getMember = (id: string) => {
        const m = d.rows.find((m: any) => m.id === id);
        if (!m) throw Object.assign(Error('Member not present in this snapshot.'), { status: 404 });
        return m;
      };
      const send = (value: any) => res.json(value);
      if (path === '/api/cubit/members')
        return send({
          ...filterDirectory(d.rows, req.query, d.organizationAsOf),
          asOf: d.organizationAsOf,
          snapshot: d.snapshot,
          estimatedBilling: true,
        });
      if (path === '/plan') return send(sortPlans(d.plans));
      if (path === '/api/cubit/plan-catalog')
        return send({
          plans: sortPlans(d.plans),
          history: [],
          readOnly: true,
          historyUnavailable: true,
        });
      if (path === '/api/cubit/automation')
        return send({
          settings: {
            ...settings,
            graceDays: d.graceDays,
            dailyEnabled: false,
            migrationSummary: null,
          },
          runs: [],
          events: [],
          audit: [],
          migration: null,
          imported: true,
          readOnly: true,
          mode: 'Parallel testing: copied records are never processed or changed. Backups, system health and account settings below belong to Cubit.',
          schedule:
            'Billing amounts are calculated without posting charges. The saved review grace rule is used for comparison only; Tonic remains the access authority.',
        });
      let match = path.match(/^\/api\/cubit\/members\/([^/]+)\/(billing|notes|operations)$/);
      if (match) {
        const id = decodeURIComponent(match[1]);
        getMember(id);
        if (match[2] === 'billing') return send({ ...d.billing.get(id), snapshot: d.snapshot });
        return send(
          match[2] === 'notes'
            ? { rows: [], page: 1, pages: 1, total: 0, pageSize: 5, unavailable: true }
            : {
                accessHold: null,
                accessHoldReason: 'Not supplied by this export',
                history: [],
                unavailable: true,
              },
        );
      }
      match = path.match(/^\/member\/(balance|isActive|plans)\/([^/]+)$/);
      if (match) {
        const id = decodeURIComponent(match[2]),
          m = getMember(id);
        return send(
          match[1] === 'balance'
            ? m.balance
            : match[1] === 'isActive'
              ? m.status === 'Active'
              : d.memberships.filter((p: any) => p.memberId === id),
        );
      }
      match = path.match(/^\/member\/([^/]+)$/);
      if (match && !['refreshStatus', 'New'].includes(match[1]))
        return send(getMember(decodeURIComponent(match[1])));
      match = path.match(/^\/key\/(memberActivity|memberKeys)\/([^/]+)$/);
      if (match) {
        const id = decodeURIComponent(match[2]);
        getMember(id);
        const keys = d.keys.filter((k: any) => k.memberId === id);
        return send(
          match[1] === 'memberKeys'
            ? keys
            : { keys, lastEntry: d.activity.get(id)?.lastEntry || null },
        );
      }
      match = path.match(/^\/transaction\/memberTransactions\/([^/]+)$/);
      if (match) {
        const id = decodeURIComponent(match[1]);
        getMember(id);
        return send(d.payments.filter((p: any) => p.memberId === id));
      }
      if (path === '/accessLog/events') {
        const o = accessLogOptions(req.query, new Date(d.snapshot.sourceTime)),
          search = o.search.toLowerCase();
        const rows = d.logs.filter(
          (l: any) =>
            (!o.since || Date.parse(l.timestamp) >= +o.since) &&
            (o.result === 'all' || l.accessGranted === (o.result === 'granted')) &&
            (!search ||
              [l.member?.firstName, l.member?.lastName, l.member?.email, l.message]
                .join(' ')
                .toLowerCase()
                .includes(search)),
        );
        const sign = o.order === 'ASC' ? 1 : -1;
        rows.sort(
          (a: any, b: any) =>
            sign *
              (o.sort === 'name'
                ? `${a.member?.lastName || ''} ${a.member?.firstName || ''}`.localeCompare(
                    `${b.member?.lastName || ''} ${b.member?.firstName || ''}`,
                  )
                : o.sort === 'result'
                  ? Number(a.accessGranted) - Number(b.accessGranted)
                  : a.timestamp.localeCompare(b.timestamp)) || a.id.localeCompare(b.id),
        );
        const pages = Math.max(1, Math.ceil(rows.length / o.pageSize)),
          page = Math.min(pages, o.page);
        return send({
          rows: rows.slice((page - 1) * o.pageSize, page * o.pageSize).map((l: any) => ({
            ...l,
            member: l.member
              ? {
                  id: l.member.id,
                  firstName: l.member.firstName,
                  lastName: l.member.lastName,
                  email: l.member.email,
                }
              : null,
          })),
          total: rows.length,
          page,
          pages,
          snapshot: d.snapshot,
        });
      }
      if (
        path === '/api/cubit/reports' ||
        /^\/api\/cubit\/reports\/(roster|transactions|overdue|checkins)\.csv$/.test(path)
      ) {
        const range = reportRange(req.query);
        const data = buildReportData({
          ...range,
          roster: d.rows,
          allPayments: d.payments,
          logs: d.logs,
          plans: d.memberships,
          charges: d.charges,
          adjustments: [],
          settings: { graceDays: d.graceDays },
          asOf: d.organizationAsOf,
          sourceTime: d.snapshot.sourceTime,
        });
        if (path.endsWith('.csv')) {
          const type = path.split('/').pop()!.replace('.csv', '');
          const contents = exportReport(type, data, 'USD');
          await recordAudit(AppDataSource.manager, {
            kind: 'Parallel report exported',
            author: req.member!.email,
            after: {
              report: type,
              snapshot: d.snapshot.id,
              from: range.from,
              to: range.to,
              estimatedBilling: true,
            },
          });
          res
            .type('text/csv')
            .setHeader(
              'Content-Disposition',
              `attachment; filename="cubit-parallel-${type}-${d.asOf}.csv"`,
            );
          return res.send(
            contents
              .replace('Balance (USD)', 'Tonic stored balance (USD)')
              .replace(/Past due \(USD\)/g, 'Estimated past due (USD)')
              .replace(/Access enabled/g, 'Snapshot eligibility (not controller verification)'),
          );
        }
        const { roster, payments, visits, overdue, ...dashboard } = data;
        return send({ ...dashboard, snapshot: d.snapshot, estimatedBilling: true });
      }
      return res.status(409).json({
        message:
          'This operation is unavailable in parallel testing. No review records were substituted.',
      });
    } catch (e) {
      next(e);
    }
  });
});
