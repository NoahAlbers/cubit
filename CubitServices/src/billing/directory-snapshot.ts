import { anniversary, day } from './ledger'
import { postedLedger, accessDecision } from './posted-ledger'

export function byMember<T extends { memberId: string }>(rows: T[]) {
  const grouped = new Map<string, T[]>()
  for (const row of rows) {
    if (!grouped.has(row.memberId)) grouped.set(row.memberId, [])
    grouped.get(row.memberId)!.push(row)
  }
  return grouped
}

// The common list request can use batch reads. Only changed/due accounts need
// the existing locked posting and access-audit path; no cached billing results.
export function directoryBilling(member: any, plans: any[], records: any[], payments: any[], adjustments: any[], graceDays: number, asOf: string) {
  const ledger = postedLedger(records, payments, adjustments, asOf)
  const decision = accessDecision(member, plans, ledger, graceDays)
  const existing = new Set(records.map(c => `${c.memberPlanId}:${c.dueDate}`))
  let needsRefresh = Number(member.balance) !== ledger.balance || member.status !== decision.status ||
    Boolean(member.billingSuspended) !== decision.suspended || String(member.statusReason || '') !== String(decision.reason || '')
  for (const p of plans) {
    if (p.billingRate == null) needsRefresh = true
    const stop = [asOf, p.finalBillingDate, p.endDate && day(p.endDate)].filter(Boolean).sort()[0] as string
    for (let n = 0; ; n++) {
      const dueDate = anniversary(day(p.startDate), n)
      if (dueDate > stop) break
      if (n >= 1200) throw Error('Plan exceeds supported billing history')
      // Voided charges must stay voided, not be regenerated.
      if (!existing.has(`${p.id}:${dueDate}`)) { needsRefresh = true; break }
    }
  }
  return { plans, ledger, ...decision, needsRefresh }
}
