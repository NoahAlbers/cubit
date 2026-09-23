import { day } from './ledger'

// Posted charge amounts never depend on the current catalog rate.
export function postedLedger(records: any[], payments: any[], adjustments: any[], asOf = day(new Date())) {
  const charges = records.filter(c => !c.voided && c.dueDate <= asOf).map(c => {
    const credit = adjustments.filter(a => a.chargeId === c.id).reduce((n, a) => n + Math.round(Number(a.credit) * 100), 0)
    const original = Math.round(Number(c.amount) * 100)
    return { id: c.id, planId: c.memberPlanId, planName: c.planName, dueDate: c.dueDate,
      originalAmount: original / 100, adjustment: credit / 100, amount: original - credit, outstanding: original - credit }
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id))
  const paid = payments.filter(p => day(p.transactionDate) <= asOf).reduce((n, p) => n + Math.round(Number(p.amount) * 100), 0)
  let available = Math.max(0, paid)
  for (const c of charges) { const allocated = Math.min(available, c.amount); c.outstanding -= allocated; available -= allocated }
  const total = charges.reduce((n, c) => n + c.amount, 0)
  const late = charges.filter(c => c.outstanding > 0 && c.dueDate < asOf)
  return { asOf, totalCharges: total / 100, totalPaid: paid / 100, balance: (total - paid) / 100,
    pastDue: late.reduce((n, c) => n + c.outstanding, 0) / 100, credit: Math.max(0, paid - total) / 100,
    oldestUnpaidDate: charges.find(c => c.outstanding > 0)?.dueDate || null,
    daysPastDue: late.length ? Math.floor((Date.parse(asOf) - Date.parse(late[0].dueDate)) / 86400000) : 0,
    unallocatedDebit: Math.max(0, -paid) / 100,
    charges: charges.map(c => ({ ...c, amount: c.amount / 100, outstanding: c.outstanding / 100 })) }
}

export function accessDecision(member: any, plans: any[], ledger: ReturnType<typeof postedLedger>, graceDays: number) {
  const current = plans.some(p => day(p.startDate) <= ledger.asOf &&
    (!p.endDate || day(p.endDate) >= ledger.asOf) && (!p.finalBillingDate || p.finalBillingDate >= ledger.asOf))
  const ended = plans.some(p => (p.finalBillingDate && p.finalBillingDate < ledger.asOf) || (p.endDate && day(p.endDate) < ledger.asOf))
  const suspended = current && (ledger.daysPastDue > graceDays || ledger.unallocatedDebit > 0)
  const status = !current ? (ended ? 'Canceled' : 'Inactive') : member.accessHold || suspended ? 'Inactive' : 'Active'
  return { status, suspended, reason: member.accessHold ? member.accessHoldReason : !current ? 'No current membership' :
    suspended ? 'Outside billing grace period' : ledger.pastDue ? 'Within billing grace period' : 'Current' }
}
