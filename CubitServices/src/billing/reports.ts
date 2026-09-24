import { AppDataSource } from '../database';
import { directoryRows } from './directory';
import { day, validDay } from './ledger';
import { Transaction } from '../entity/transaction';
import { AccessLog } from '../entity/accessLog';
import { fail } from './payments';
import { MemberPlan } from '../entity/memberPlan';
import { BillingCharge, ChargeAdjustment, OperationsSettings } from '../entity/cubitOperations';
import { activeMembersAt } from './membership-history';
import { localAccessEntries, busiestTimes } from './activity-patterns';

export function reportRange(query: any) {
  const to = String(query.to || day(new Date())),
    from = String(query.from || `${to.slice(0, 4)}-01-01`);
  if (!validDay(from) || !validDay(to) || from > to || to > day(new Date()))
    fail('Choose valid dates with the start on or before the end, ending no later than today.');
  return { from, to };
}

export function csv(rows: any[][]) {
  const cell = (value: any) => {
    let text = value == null ? '' : String(value);
    // Protect spreadsheet users from formulas, including leading whitespace/control characters.
    // eslint-disable-next-line no-control-regex -- Deliberately detect hidden formula prefixes.
    if (typeof value === 'string' && /^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  };
  return '\uFEFF' + rows.map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n';
}

export async function reportData(query: any) {
  const { from, to } = reportRange(query);
  const roster = await directoryRows();
  const [allPayments, logs, plans, charges, adjustments, settings] = await Promise.all([
    AppDataSource.manager.find(Transaction, { order: { transactionDate: 'DESC' } }),
    AppDataSource.manager.find(AccessLog, {
      relations: { member: true },
      order: { timestamp: 'DESC' },
    }),
    AppDataSource.manager.find(MemberPlan),
    AppDataSource.manager.find(BillingCharge),
    AppDataSource.manager.find(ChargeAdjustment),
    AppDataSource.manager.findOneByOrFail(OperationsSettings, { id: 'default' }),
  ]);
  const payments = allPayments.filter(
    (p) => day(p.transactionDate) >= from && day(p.transactionDate) <= to,
  );
  const localVisits = localAccessEntries(logs, from, to);
  const visits = localVisits.map((entry) => entry.event);
  const successful = visits.filter((l) => l.accessGranted);
  const successfulLocal = localVisits.filter((entry) => entry.event.accessGranted);
  const months: any[] = [];
  for (
    let d = new Date(`${from.slice(0, 7)}-01T00:00:00Z`);
    d.toISOString().slice(0, 10) <= to;
    d.setUTCMonth(d.getUTCMonth() + 1)
  ) {
    const month = d.toISOString().slice(0, 7),
      tx = payments.filter((p) => day(p.transactionDate).startsWith(month));
    const events = successfulLocal
      .filter((entry) => entry.date.startsWith(month))
      .map((entry) => entry.event);
    const monthEnd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
      .toISOString()
      .slice(0, 10);
    const membershipAsOf = monthEnd < to ? monthEnd : to;
    months.push({
      month,
      netPayments: tx.reduce((n, p) => n + Math.round(Number(p.amount) * 100), 0) / 100,
      visits: events.length,
      uniqueVisitors: new Set(events.map((l) => l.member?.id).filter(Boolean)).size,
      activeMembers: activeMembersAt(
        roster,
        plans,
        charges,
        allPayments,
        adjustments,
        settings.graceDays,
        membershipAsOf,
      ),
      membershipAsOf,
      membershipEstimated: membershipAsOf !== day(new Date()),
    });
  }
  const overdue = roster.filter((m) => m.pastDue > 0 && m.status !== 'Canceled');
  const summary = {
    members: roster.length,
    active: roster.filter((m) => m.status === 'Active').length,
    netPayments: payments.reduce((n, p) => n + Math.round(Number(p.amount) * 100), 0) / 100,
    overdueMembers: overdue.length,
    overdueAmount: overdue.reduce((n, m) => n + Math.round(m.pastDue * 100), 0) / 100,
    checkins: successful.length,
    uniqueVisitors: new Set(successful.map((l) => l.member?.id).filter(Boolean)).size,
  };
  return {
    from,
    to,
    asOf: day(new Date()),
    summary,
    months,
    busiestTimes: busiestTimes(localVisits, from, to),
    statuses: ['Active', 'Inactive', 'Canceled'].map((status) => ({
      status,
      count: roster.filter((m) => m.status === status).length,
    })),
    roster,
    payments,
    visits,
    overdue,
  };
}

export function exportReport(type: string, data: Awaited<ReturnType<typeof reportData>>) {
  const names = new Map(data.roster.map((m) => [m.id, `${m.firstName} ${m.lastName}`]));
  if (type === 'roster')
    return csv([
      [
        'Member ID',
        'First name',
        'Last name',
        'Email',
        'PayPal email',
        'Phone',
        'Status',
        'Plan',
        'Balance',
        'Past due',
        'Access enabled',
        'Last successful check-in',
      ],
      ...data.roster.map((m) => [
        m.id,
        m.firstName,
        m.lastName,
        m.email,
        m.paypalEmail,
        m.phone,
        m.status,
        m.planName,
        m.balance,
        m.pastDue,
        m.accessAllowed,
        m.lastKeyUsage,
      ]),
    ]);
  if (type === 'transactions')
    return csv([
      [
        'Transaction ID',
        'Member',
        'Date',
        'Amount (USD)',
        'Method',
        'Description',
        'Confirmation',
        'Recorded by',
        'Reversal of',
        'Corrected by',
      ],
      ...data.payments.map((p) => [
        p.id,
        names.get(p.memberId),
        day(p.transactionDate),
        Number(p.amount),
        p.method,
        p.description,
        p.confirmation,
        p.recordedBy,
        p.reversalOf,
        p.correctedBy,
      ]),
    ]);
  if (type === 'overdue')
    return csv([
      [
        'Member ID',
        'Name',
        'Email',
        'Phone',
        'Past due (USD)',
        'Days behind',
        'Access enabled',
        'Plan',
      ],
      ...data.overdue.map((m) => [
        m.id,
        names.get(m.id),
        m.email,
        m.phone,
        m.pastDue,
        m.daysPastDue,
        m.accessAllowed,
        m.planName,
      ]),
    ]);
  if (type === 'checkins')
    return csv([
      ['Timestamp', 'Member', 'Access granted', 'Message'],
      ...data.visits.map((v) => [
        new Date(v.timestamp).toISOString(),
        v.member ? names.get(v.member.id) : '',
        v.accessGranted,
        v.message,
      ]),
    ]);
  fail('Unknown report. Waiver compliance becomes available when waivers are implemented.', 404);
}
