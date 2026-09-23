import { day } from './ledger'
import { postedLedger, accessDecision } from './posted-ledger'

// Reconstruct month-end billing eligibility using corrected records and today's
// grace policy. Historical manual holds and grace changes cannot be reconstructed.
export function activeMembersAt(members: any[], plans: any[], charges: any[], payments: any[], adjustments: any[], graceDays: number, asOf: string, today = day(new Date())) {
  const group = (rows: any[]) => {
    const result = new Map<string, any[]>()
    for (const row of rows) {
      if (!result.has(row.memberId)) result.set(row.memberId, [])
      result.get(row.memberId)!.push(row)
    }
    return result
  }
  const grouped = [plans, charges, payments, adjustments].map(group)
  return members.filter(member => {
    const [memberPlans, memberCharges, memberPayments, memberAdjustments] = grouped.map(rows => rows.get(member.id) || [])
    const ledger = postedLedger(memberCharges, memberPayments, memberAdjustments, asOf)
    const holds = asOf === today ? member : { accessHold: false }
    return accessDecision(holds, memberPlans, ledger, graceDays).status === 'Active'
  }).length
}
