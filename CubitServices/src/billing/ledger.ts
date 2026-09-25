import { organizationDay } from '../organization/time';
// Calendar dates and integer cents keep billing independent of DST and rounding.
export function day(value: Date | string): string {
  if (typeof value === 'string') return value.slice(0, 10);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export function validDay(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}

export function anniversary(start: string, offset: number): string {
  const [year, month, date] = start.split('-').map(Number);
  const first = new Date(Date.UTC(year, month - 1 + offset, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(date, last));
  return first.toISOString().slice(0, 10);
}

export interface BillingPlan {
  id: string;
  startDate: Date | string;
  endDate?: Date | string | null;
  finalBillingDate?: string | null;
  plan: { name: string; monthlyCost: number | string };
}
export interface Payment {
  amount: number | string;
  transactionDate: Date | string;
}

export function billingLedger(plans: BillingPlan[], payments: Payment[], asOf = organizationDay()) {
  if (!validDay(asOf)) throw new Error('Invalid billing date');
  const charges: {
    planId: string;
    planName: string;
    dueDate: string;
    amount: number;
    outstanding: number;
  }[] = [];
  for (const plan of plans) {
    const start = day(plan.startDate);
    const stop = [asOf, plan.endDate && day(plan.endDate), plan.finalBillingDate]
      .filter(Boolean)
      .sort()[0] as string;
    if (!validDay(start) || !validDay(stop)) throw new Error('Invalid plan dates');
    const cents = Math.round(Number(plan.plan.monthlyCost) * 100);
    if (!Number.isFinite(cents) || cents < 0) throw new Error('Invalid monthly rate');
    for (let month = 0; ; month++) {
      const dueDate = anniversary(start, month);
      if (dueDate > stop) break;
      if (month >= 1200) throw new Error('Plan exceeds supported billing history');
      charges.push({
        planId: plan.id,
        planName: plan.plan.name,
        dueDate,
        amount: cents,
        outstanding: cents,
      });
    }
  }
  charges.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.planId.localeCompare(b.planId));
  const paid = payments
    .filter((p) => day(p.transactionDate) <= asOf)
    .reduce((sum, p) => sum + Math.round(Number(p.amount) * 100), 0);
  if (!Number.isFinite(paid)) throw new Error('Invalid payment amount');
  let available = Math.max(0, paid);
  for (const charge of charges) {
    const applied = Math.min(available, charge.amount);
    charge.outstanding -= applied;
    available -= applied;
  }
  const total = charges.reduce((sum, c) => sum + c.amount, 0);
  const late = charges.filter((c) => c.outstanding > 0 && c.dueDate < asOf);
  const oldestUnpaidDate = charges.find((c) => c.outstanding > 0)?.dueDate || null;
  const overdue = late.reduce((sum, c) => sum + c.outstanding, 0);
  return {
    asOf,
    totalCharges: total / 100,
    totalPaid: paid / 100,
    balance: (total - paid) / 100,
    pastDue: overdue / 100,
    credit: Math.max(0, paid - total) / 100,
    oldestUnpaidDate,
    daysPastDue: late.length
      ? Math.floor((Date.parse(asOf) - Date.parse(late[0].dueDate)) / 86400000)
      : 0,
    // Excess refunds cannot be allocated to a due date; expose for staff review.
    unallocatedDebit: Math.max(0, -paid) / 100,
    charges: charges.map((c) => ({
      ...c,
      amount: c.amount / 100,
      outstanding: c.outstanding / 100,
    })),
  };
}

export function membershipStatus(plans: BillingPlan[], balance: number, asOf = organizationDay()) {
  const current = plans
    .filter(
      (p) =>
        day(p.startDate) <= asOf &&
        (!p.endDate || day(p.endDate) >= asOf) &&
        (!p.finalBillingDate || p.finalBillingDate >= asOf),
    )
    .sort((a, b) => day(b.startDate).localeCompare(day(a.startDate)))[0];
  if (current) return balance <= Number(current.plan.monthlyCost) * 2 ? 'Active' : 'Inactive';
  return plans.some(
    (p) =>
      (p.finalBillingDate && p.finalBillingDate < asOf) || (p.endDate && day(p.endDate) < asOf),
  )
    ? 'Canceled'
    : 'Inactive';
}
