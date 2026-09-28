import { readParallel, generationStatus, json } from './reader';
import { billingLedger } from '../billing/ledger';
import { accessDecision } from '../billing/posted-ledger';
import { byMember } from '../billing/directory-snapshot';
import { organizationDay } from '../organization/time';

const cache = new Map<string, Promise<any>>();
export const sourceInstant = (value: any) =>
  value == null ? null : String(value).replace(' ', 'T').replace(/Z?$/, 'Z');

// Only six allowlisted source datasets enter this adapter. No ORM entities are saved.
export function assembleSnapshot(tables: Record<string, any[]>, snapshot: any, graceDays: number) {
  const asOf = snapshot.sourceTime.slice(0, 10),
    now = Date.parse(snapshot.sourceTime);
  const plans = tables.plan.map((p) => ({ ...p, retired: false, revision: 0 }));
  const catalog = new Map(plans.map((p) => [p.id, p]));
  const memberships = tables.member_plan.map((p) => ({
    ...p,
    plan: catalog.get(p.planId),
    startDate: sourceInstant(p.startDate),
    endDate: sourceInstant(p.endDate),
    billingName: p.billingName || catalog.get(p.planId)?.name,
    billingRate: p.billingRate ?? catalog.get(p.planId)?.monthlyCost,
  }));
  const payments = tables.transaction.map((p) => ({
    ...p,
    transactionDate: sourceInstant(p.transactionDate),
  }));
  const keys = tables.member_key.map((k) => ({ ...k, lastUsed: null }));
  const members = tables.member.map((m) => ({
    ...m,
    picture: '',
    sourceRole: m.role,
    role: 'member',
  }));
  const byId = new Map(members.map((m) => [m.id, m]));
  const logs = tables.access_log.map((l) => ({
    ...l,
    timestamp: sourceInstant(l.timestamp),
    accessGranted: l.accessGranted === true || l.accessGranted === 1,
    member: l.memberId ? byId.get(l.memberId) || null : null,
  }));
  const groupedPlans = byMember(memberships),
    groupedPayments = byMember(payments),
    groupedKeys = byMember(keys);
  const activity = new Map<string, any>();
  for (const l of logs) {
    if (!l.memberId || Date.parse(l.timestamp) > now) continue;
    const a = activity.get(l.memberId) || {
      lastEntry: null,
      lastAttempt: null,
      checkedIn30Days: false,
    };
    if (!a.lastAttempt || l.timestamp > a.lastAttempt) a.lastAttempt = l.timestamp;
    if (l.accessGranted) {
      if (!a.lastEntry || l.timestamp > a.lastEntry) a.lastEntry = l.timestamp;
      if (Date.parse(l.timestamp) >= now - 30 * 86400000) a.checkedIn30Days = true;
    }
    activity.set(l.memberId, a);
  }
  const billing = new Map<string, any>(),
    charges: any[] = [];
  const rows = members.map((m) => {
    const mp = groupedPlans.get(m.id) || [],
      tx = groupedPayments.get(m.id) || [];
    const ledger = billingLedger(
      mp.map((p) => ({ ...p, plan: { name: p.billingName, monthlyCost: p.billingRate } })),
      tx,
      asOf,
    );
    const estimatedCharges = ledger.charges.map((c) => ({
      ...c,
      id: `estimate:${c.planId}:${c.dueDate}`,
      memberId: m.id,
      memberPlanId: c.planId,
      originalAmount: c.amount,
      credit: 0,
      voided: false,
    }));
    charges.push(...estimatedCharges);
    const estimate = accessDecision(
      { accessHold: false },
      mp,
      { ...ledger, charges: estimatedCharges } as any,
      graceDays,
    );
    const status = ['Active', 'Inactive', 'Canceled'].includes(m.status) ? m.status : 'Unknown';
    const enabledKeys = (groupedKeys.get(m.id) || []).filter((k) => k.status === 'Active').length;
    const latest = [...mp].sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
    const a = activity.get(m.id);
    billing.set(m.id, {
      ...ledger,
      charges: estimatedCharges,
      plans: mp,
      payments: tx,
      adjustments: [],
      history: [],
      voidedCharges: [],
      status,
      accessReason: 'Status copied from Tonic; physical door access is not verified.',
      sourceBalance: Number(m.balance),
      projectedStatus: estimate.status,
      projectedReason: estimate.reason,
      estimated: true,
      readOnly: true,
    });
    return {
      ...m,
      status,
      balance: Number(m.balance),
      estimatedBalance: ledger.balance,
      sourceBalance: Number(m.balance),
      pastDue: ledger.pastDue,
      daysPastDue: ledger.daysPastDue,
      oldestUnpaidDate: ledger.oldestUnpaidDate,
      unallocatedDebit: ledger.unallocatedDebit,
      projectedStatus: estimate.status,
      enabledKeys,
      accessKeys: (groupedKeys.get(m.id) || []).map((k) => k.serialNumber).join(' '),
      accessAllowed: status === 'Active' && enabledKeys > 0,
      billingSuspended: estimate.suspended,
      checkedIn30Days: !!a?.checkedIn30Days,
      lastKeyUsage: a?.lastEntry || null,
      lastAttempt: a?.lastAttempt || null,
      planName: latest?.billingName || 'No plan',
      planId: latest?.planId || '',
      finalBillingDate: latest?.finalBillingDate || latest?.endDate?.slice(0, 10) || null,
    };
  });
  return {
    snapshot,
    asOf,
    organizationAsOf: organizationDay(new Date(snapshot.sourceTime)),
    members,
    rows,
    billing,
    plans,
    memberships,
    payments,
    keys,
    logs,
    activity,
    charges,
    graceDays,
  };
}

export async function integratedSnapshot(expected: string | undefined, graceDays: number) {
  return readParallel(async (db, g) => {
    if (!g)
      throw Object.assign(Error('A complete parallel snapshot is not available.'), { status: 503 });
    const key = g.id + ':' + graceDays;
    let promise = cache.get(key);
    if (!promise) {
      promise = (async () => {
        const [records] = await db.query<any[]>(
          'SELECT kind,payload FROM parallel_record WHERE generation=?',
          [g.id],
        );
        const tables: Record<string, any[]> = Object.fromEntries(
          ['member', 'plan', 'member_plan', 'transaction', 'member_key', 'access_log'].map((k) => [
            k,
            [],
          ]),
        );
        for (const r of records) tables[r.kind].push(json(r.payload));
        return assembleSnapshot(tables, generationStatus(g), graceDays);
      })();
      cache.set(key, promise);
      promise.catch(() => cache.delete(key));
      for (const old of [...cache.keys()].slice(0, -2)) cache.delete(old);
    }
    const data = await promise;
    return { ...data, snapshot: generationStatus(g) };
  }, expected);
}
