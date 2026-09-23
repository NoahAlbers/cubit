import { AppDataSource } from '../app'
import { hash } from 'bcrypt'
import { Member, ROLES } from '../entity/member'
import { Plan } from '../entity/plan'
import { MemberPlan } from '../entity/memberPlan'
import { MemberKey } from '../entity/memberKey'
import { Transaction } from '../entity/transaction'
import { AccessLog } from '../entity/accessLog'
import { BillingChange } from '../entity/billingChange'
import { billingLedger, day, membershipStatus } from '../billing/ledger'

const fixtureId = (kind: number, n: number) => `${kind}0000000-0000-4000-8000-${String(n).padStart(12, '0')}`

// Additive, versioned, atomic fixtures. A reserved plan ID is the completion marker.
// Existing members and later edits are never reset by startup.
export async function seedScenarios() {
  if (await AppDataSource.manager.exists(Plan, { where: { id: fixtureId(4, 1) } })) return
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth() - 6, 1, 12)
  const cutoff = day(new Date(today.getFullYear(), today.getMonth() - 3, 20, 12))
  const password = await hash('LocalDemoOnly!2026', 10)
  const firstNames = ['Morgan', 'Jordan', 'Riley', 'Casey', 'Taylor', 'Avery', 'Jamie', 'Cameron', 'Parker', 'Quinn', 'Drew', 'Skyler']
  const lastNames = ['Rivera', 'Chen', 'Patel', 'Brooks', 'Williams', 'Santos']
  await AppDataSource.transaction(async manager => {
    const plans = await manager.save(Plan, [
      manager.create(Plan, { id: fixtureId(4, 1), name: 'Standard', monthlyCost: 50 }),
      manager.create(Plan, { id: fixtureId(4, 2), name: 'Household', monthlyCost: 75 }),
      manager.create(Plan, { id: fixtureId(4, 3), name: 'Student', monthlyCost: 25 }),
    ])
    for (let i = 0; i < 72; i++) {
      const scenario = i % 9
      const firstName = firstNames[i % firstNames.length], lastName = lastNames[Math.floor(i / firstNames.length)]
      const member = manager.create(Member, {
        id: fixtureId(5, i + 1), firstName, lastName,
        email: `${firstName}.${lastName}@example.test`.toLowerCase(),
        paypalEmail: `billing.${i + 1}@example.test`, phone: `(202) 555-${String(100 + i).padStart(4, '0')}`,
        emergencyContact: `Demo contact ${i + 1}`, emergencyEmail: `contact.${i + 1}@example.test`,
        emergencyPhone: '(202) 555-0199', password, role: ROLES.MEMBER,
        statusReason: ['Current', 'Partially paid', 'Two months behind', 'Long overdue', 'Canceled, settled',
          'Canceled, prior debt', 'No plan', 'Future plan', 'Credit balance'][scenario] + ' — synthetic fixture',
      })
      await manager.save(Member, member)
      const plan = plans[i % 3]
      const canceled = scenario === 4 || scenario === 5
      const membership = manager.create(MemberPlan, {
        id: fixtureId(6, i + 1), memberId: member.id, planId: plan.id, plan,
        startDate: scenario === 7 ? new Date(today.getFullYear(), today.getMonth() + 1, 1, 12) : start,
        paypalSubscriptionId: `SYNTHETIC-${i + 1}`, paypalSubscriptionPlanId: '',
        ...(canceled ? { finalBillingDate: cutoff, endDate: new Date(`${cutoff}T23:59:59`) } : {}),
      })
      const memberships = scenario === 6 ? [] : [membership]
      if (memberships.length) await manager.save(MemberPlan, membership)
      const charges = billingLedger(memberships, []).charges
      const unpaidMonths = [0, 0.5, 2, 5, 0, 2, 0, 0, -1][scenario]
      let paymentBudget = Math.max(0, charges.length * Number(plan.monthlyCost) - unpaidMonths * Number(plan.monthlyCost))
      const payments: Transaction[] = []
      for (const charge of charges) {
        if (paymentBudget <= 0) break
        const amount = Math.min(paymentBudget, charge.amount)
        payments.push(manager.create(Transaction, { memberId: member.id, amount,
          transactionDate: new Date(`${charge.dueDate}T12:00:00`), method: 'Local demo',
          description: 'Synthetic membership payment', confirmation: `DEMO-${i + 1}-${charge.dueDate}` }))
        paymentBudget -= amount
      }
      if (paymentBudget > 0) payments.push(manager.create(Transaction, { memberId: member.id, amount: paymentBudget,
        transactionDate: today, method: 'Local demo', description: 'Synthetic advance payment' }))
      await manager.save(Transaction, payments)
      const ledger = billingLedger(memberships, payments)
      member.balance = ledger.balance
      member.status = membershipStatus(memberships, ledger.balance)
      await manager.save(Member, member)
      await manager.save(MemberKey, manager.create(MemberKey, { id: fixtureId(7, i + 1), memberId: member.id,
        serialNumber: `DEMO${String(i + 101).padStart(8, '0')}`, status: 'Active' }))
      if (canceled) await manager.save(BillingChange, manager.create(BillingChange, {
        memberId: member.id, memberPlanId: membership.id, previousDate: null, finalBillingDate: cutoff,
        reason: 'Synthetic cancellation example', changedBy: 'admin@example.test',
      }))
      const daysAgo = [2, 20, 45, 120, -1, 7][i % 6]
      if (daysAgo >= 0 && scenario !== 6 && scenario !== 7) {
        for (let visit = 0; visit < 6; visit++) {
          const timestamp = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAgo - visit * 12, 14 + i % 5)
          if (canceled && day(timestamp) > cutoff) continue
          await manager.save(AccessLog, manager.create(AccessLog, { member, timestamp,
            accessGranted: true, message: 'Synthetic workshop sign-in' }))
        }
      }
      if (i % 4 === 0) await manager.save(AccessLog, manager.create(AccessLog, { member,
        timestamp: today, accessGranted: false, message: 'Synthetic denied key attempt' }))
    }
  })
  console.log('Added Cubit fixture set v1: 72 synthetic members, payments, cancellations and access logs.')
}
