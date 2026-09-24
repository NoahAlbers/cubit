import { AppDataSource } from '../database';
import { Member } from '../entity/member';
import { MemberPlan } from '../entity/memberPlan';
import { Transaction } from '../entity/transaction';
import { AccessLog } from '../entity/accessLog';
import { MemberKey } from '../entity/memberKey';
import { day } from './ledger';
import { ensureBilling } from './store';
import { BillingCharge, ChargeAdjustment, OperationsSettings } from '../entity/cubitOperations';
import { byMember, directoryBilling } from './directory-snapshot';

export function matchesSearch(member: any, query: string, field = 'all') {
  const fields =
    field === 'all' ? ['firstName', 'lastName', 'email', 'paypalEmail', 'phone'] : [field];
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  const phone = String(member.phone || '').replace(/\D/g, '');
  if ((field === 'phone' || field === 'all') && /^[+\d\s().-]+$/.test(normalized)) {
    const digits = normalized.replace(/\D/g, '');
    if (digits && phone.includes(digits)) return true;
  }
  return normalized.split(/\s+/).every((token) =>
    fields.some((f) =>
      String(member[f] || '')
        .toLowerCase()
        .includes(token),
    ),
  );
}

export async function directoryRows() {
  const now = new Date();
  const since = new Date(now.getTime() - 30 * 86400000);
  const [members, logs, keys, plans, payments, charges, adjustments, settings] = await Promise.all([
    AppDataSource.manager.find(Member),
    AppDataSource.manager
      .createQueryBuilder(AccessLog, 'log')
      .select('log.memberId', 'memberId')
      .addSelect('MAX(log.timestamp)', 'lastAttempt')
      .addSelect(
        'MAX(CASE WHEN log.accessGranted = 1 AND log.timestamp <= :now THEN log.timestamp ELSE NULL END)',
        'lastKeyUsage',
      )
      .addSelect(
        'MAX(CASE WHEN log.accessGranted = 1 AND log.timestamp >= :since AND log.timestamp <= :now THEN 1 ELSE 0 END)',
        'checkedIn30Days',
      )
      .setParameters({ since, now })
      .groupBy('log.memberId')
      .getRawMany(),
    AppDataSource.manager.find(MemberKey, { where: { status: 'Active' } }),
    AppDataSource.manager.find(MemberPlan, { relations: { plan: true } }),
    AppDataSource.manager.find(Transaction),
    AppDataSource.manager.find(BillingCharge),
    AppDataSource.manager.find(ChargeAdjustment),
    AppDataSource.manager.findOneByOrFail(OperationsSettings, { id: 'default' }),
  ]);
  const asOf = day(now);
  const groupedPlans = byMember(plans),
    groupedPayments = byMember(payments),
    groupedCharges = byMember(charges),
    groupedAdjustments = byMember(adjustments);
  const logMap = new Map(logs.map((log) => [log.memberId, log]));
  const keyCounts = new Map<string, number>();
  for (const key of keys) keyCounts.set(key.memberId, (keyCounts.get(key.memberId) || 0) + 1);
  const result: any[] = [];
  for (const member of members) {
    const snapshot = directoryBilling(
      member,
      groupedPlans.get(member.id) || [],
      groupedCharges.get(member.id) || [],
      groupedPayments.get(member.id) || [],
      groupedAdjustments.get(member.id) || [],
      settings.graceDays,
      asOf,
    );
    const {
      plans: memberPlans,
      ledger,
      status,
      reason,
      suspended,
    } = snapshot.needsRefresh ? await ensureBilling(member.id) : snapshot;
    const log = logMap.get(member.id);
    const latest = memberPlans.sort((a, b) => day(b.startDate).localeCompare(day(a.startDate)))[0];
    const { password, ...safe } = member;
    const enabledKeys = keyCounts.get(member.id) || 0;
    result.push({
      ...safe,
      status,
      statusReason: reason,
      billingSuspended: suspended,
      enabledKeys,
      accessAllowed: status === 'Active' && enabledKeys > 0,
      checkedIn30Days: Number(log?.checkedIn30Days || 0) === 1,
      balance: ledger.balance,
      pastDue: ledger.pastDue,
      daysPastDue: ledger.daysPastDue,
      oldestUnpaidDate: ledger.oldestUnpaidDate,
      unallocatedDebit: ledger.unallocatedDebit,
      planName: latest?.billingName || latest?.plan.name || 'No plan',
      planId: latest?.planId || '',
      finalBillingDate: latest?.finalBillingDate || (latest?.endDate ? day(latest.endDate) : null),
      lastKeyUsage: log?.lastKeyUsage || null,
      lastAttempt: log?.lastAttempt || null,
    });
  }
  return result;
}

export function filterDirectory(rows: any[], query: Record<string, any>) {
  let result = rows.filter((m) => matchesSearch(m, String(query.q || ''), query.field || 'all'));
  if (query.status) result = result.filter((m) => m.status === query.status);
  if (query.plan) result = result.filter((m) => m.planId === query.plan);
  if (query.overdue === 'true') result = result.filter((m) => m.pastDue > 0);
  if (query.overdue === 'true' && query.includeEnded !== 'true')
    result = result.filter((m) => m.status !== 'Canceled');
  if (query.access === 'enabled') result = result.filter((m) => m.accessAllowed);
  if (query.access === 'disabled') result = result.filter((m) => !m.accessAllowed);
  if (query.minDays) result = result.filter((m) => m.daysPastDue >= Number(query.minDays));
  if (query.minAmount) result = result.filter((m) => m.pastDue >= Number(query.minAmount));
  const today = Date.parse(day(new Date()));
  if (query.activity === 'never') result = result.filter((m) => !m.lastKeyUsage);
  if (query.activity === '30' || query.activity === '90')
    result = result.filter(
      (m) =>
        m.lastKeyUsage &&
        today - Date.parse(day(new Date(m.lastKeyUsage))) <= Number(query.activity) * 86400000,
    );
  if (query.activity === 'stale')
    result = result.filter(
      (m) => m.lastKeyUsage && today - Date.parse(day(new Date(m.lastKeyUsage))) > 90 * 86400000,
    );
  const sort = [
    'name',
    'contact',
    'status',
    'plan',
    'access',
    'recent',
    'balance',
    'amount',
    'oldest',
  ].includes(query.sort)
    ? query.sort
    : 'name';
  const order = ['asc', 'desc'].includes(query.order)
    ? query.order
    : ['recent', 'balance', 'amount', 'oldest'].includes(sort)
      ? 'desc'
      : 'asc';
  const text = (a: any, b: any) =>
    String(a || '').localeCompare(String(b || ''), 'en', { sensitivity: 'base', numeric: true });
  const name = (a: any, b: any) =>
    text(a.lastName, b.lastName) || text(a.firstName, b.firstName) || text(a.id, b.id);
  result.sort((a, b) => {
    // Missing contact/activity stays last in either direction.
    if (sort === 'recent' && !a.lastKeyUsage !== !b.lastKeyUsage) return a.lastKeyUsage ? -1 : 1;
    if (sort === 'contact' && !a.email?.trim() !== !b.email?.trim())
      return a.email?.trim() ? -1 : 1;
    let diff = 0;
    if (sort === 'name') diff = name(a, b);
    if (sort === 'contact') diff = text(a.email?.trim(), b.email?.trim());
    if (sort === 'status') diff = text(a.status, b.status) || text(a.planName, b.planName);
    if (sort === 'plan') diff = text(a.planName, b.planName);
    if (sort === 'access') diff = Number(a.accessAllowed) - Number(b.accessAllowed);
    if (sort === 'recent')
      diff =
        (a.lastKeyUsage ? +new Date(a.lastKeyUsage) : 0) -
        (b.lastKeyUsage ? +new Date(b.lastKeyUsage) : 0);
    if (sort === 'balance') diff = Number(a.balance) - Number(b.balance);
    if (sort === 'amount') diff = Number(a.pastDue) - Number(b.pastDue);
    if (sort === 'oldest') diff = Number(a.daysPastDue) - Number(b.daysPastDue);
    return diff * (order === 'asc' ? 1 : -1) || name(a, b);
  });
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(query.pageSize)) || 20));
  const pages = Math.max(1, Math.ceil(result.length / pageSize));
  const page = Math.min(pages, Math.max(1, Math.floor(Number(query.page)) || 1));
  return {
    rows: result.slice((page - 1) * pageSize, page * pageSize),
    total: result.length,
    page,
    pages,
    pageSize,
    sort,
    order,
    summary: {
      total: rows.length,
      active: rows.filter((m) => m.status === 'Active').length,
      overdue: rows.filter((m) => m.pastDue > 0 && m.status !== 'Canceled').length,
      uniqueCheckins30Days: rows.filter((m) => m.checkedIn30Days).length,
      filteredAccessAllowed: result.filter((m) => m.accessAllowed).length,
      filteredPastDue: Math.round(result.reduce((sum, m) => sum + m.pastDue, 0) * 100) / 100,
      oldestDays: Math.max(0, ...result.map((m) => m.daysPastDue)),
    },
    asOf: day(new Date()),
  };
}
