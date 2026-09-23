// Read-only analysis of the preserved export. Does not connect to any database.
const fs = require('fs'), path = require('path'), zlib = require('zlib')
const root = path.resolve(__dirname, '..')
process.chdir(path.join(root, 'TonicServices'))
require('../TonicServices/node_modules/ts-node/register')
const { billingLedger } = require('../TonicServices/src/billing/ledger')
const source = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, '.private/imports/tonic-current-data.json.gz'))))
const t = source.tables, asOf = source.source.snapshotUtc.slice(0, 10)
const plans = new Map(t.plan.map(p => [p.id, p]))
const cents = x => Math.round(Number(x || 0) * 100)
const members = t.member.map(m => {
  const memberships = t.member_plan.filter(p => p.memberId === m.id).map(p => ({ ...p, plan: plans.get(p.planId) }))
  const payments = t.transaction.filter(p => p.memberId === m.id)
  const ledger = billingLedger(memberships, payments, asOf)
  const firstStart = memberships.map(p => p.startDate.slice(0, 10)).sort()[0]
  const lastEnd = memberships.length && memberships.every(p => p.endDate) ? memberships.map(p => p.endDate.slice(0, 10)).sort().at(-1) : null
  return { ...m, memberships, payments, ledger, firstStart, lastEnd }
})
const credit = members.filter(m => m.ledger.credit > 0), debt = members.filter(m => m.ledger.balance > 0)
const duplicateGroups = field => {
  const map = new Map()
  for (const m of members) { const key = String(m[field] || '').trim().toLowerCase(); if (key) map.set(key, (map.get(key) || 0) + 1) }
  return [...map.values()].filter(n => n > 1).length
}
const summary = {
  snapshot: source.source.snapshotUtc,
  earliestPayment: t.transaction.map(p => p.transactionDate.slice(0, 10)).sort()[0],
  earliestMembership: t.member_plan.map(p => p.startDate.slice(0, 10)).sort()[0],
  creditMembers: credit.length,
  creditAtLeast1000: credit.filter(m => m.ledger.credit >= 1000).length,
  totalCalculatedCredit: credit.reduce((n, m) => n + cents(m.ledger.credit), 0) / 100,
  creditWithoutAnyPlan: credit.filter(m => !m.memberships.length).length,
  creditWithoutAnyPlanAmount: credit.filter(m => !m.memberships.length).reduce((n, m) => n + cents(m.ledger.credit), 0) / 100,
  creditWithPaymentsBeforeFirstPlan: credit.filter(m => m.firstStart && m.payments.some(p => Number(p.amount) > 0 && p.transactionDate.slice(0, 10) < m.firstStart)).length,
  creditWithPaymentsAfterLastPlan: credit.filter(m => m.lastEnd && m.payments.some(p => Number(p.amount) > 0 && p.transactionDate.slice(0, 10) > m.lastEnd)).length,
  debitMembers: debt.length,
  debtAtLeast1000: debt.filter(m => m.ledger.balance >= 1000).length,
  debtAtLeast1000WithOpenPlan: debt.filter(m => m.ledger.balance >= 1000 && m.memberships.some(p => !p.endDate)).length,
  debtWithOpenPlanNoPaymentsForOverYear: debt.filter(m => m.memberships.some(p => !p.endDate) && !m.payments.some(p => Number(p.amount) > 0 && p.transactionDate.slice(0, 10) >= String(Number(asOf.slice(0, 4)) - 1) + asOf.slice(4))).length,
  invalidEndBeforeStart: t.member_plan.filter(p => p.endDate && p.endDate < p.startDate).length,
  futureEndDates: t.member_plan.filter(p => p.endDate && p.endDate.slice(0, 10) > asOf).length,
  duplicateContactEmailGroups: duplicateGroups('email'),
  duplicatePaypalEmailGroups: duplicateGroups('paypalEmail'),
  membersWithOverlappingPlans: members.filter(m => m.memberships.some((a, i) => m.memberships.some((b, j) => i < j && a.startDate <= (b.endDate || asOf + ' 23:59:59') && b.startDate <= (a.endDate || asOf + ' 23:59:59')))).length,
  unassignedPayments: t.transaction.filter(p => !p.memberId).length,
  unassignedPaymentAmount: t.transaction.filter(p => !p.memberId).reduce((n, p) => n + cents(p.amount), 0) / 100,
  negativePayments: t.transaction.filter(p => Number(p.amount) < 0).length,
  paypalRecordedStatusCodes: Object.fromEntries(['S', 'P', 'D', 'V', 'F'].map(code => [code, t.transaction.filter(p => p.method === 'PayPal' && p.description === code).length])),
  note: 'Calculated balances are reconstructions, not validated debts or confirmed prepaid credit. Date overlaps and out-of-plan payments are review candidates, not automatic errors.'
}
fs.writeFileSync(path.join(root, '.private/imports/billing-pattern-summary.json'), JSON.stringify(summary, null, 2) + '\n')
console.log(JSON.stringify(summary, null, 2))
