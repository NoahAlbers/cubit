import { EntityManager } from 'typeorm'
import { AppDataSource } from '../app'
import { Member } from '../entity/member'
import { MemberPlan } from '../entity/memberPlan'
import { Transaction } from '../entity/transaction'
import { BillingCharge, ChargeAdjustment, OperationsSettings, OperationsAudit } from '../entity/cubitOperations'
import { anniversary, billingLedger, day } from './ledger'
import { postedLedger, accessDecision } from './posted-ledger'

export async function lockMember(manager: EntityManager, memberId: string) {
  const member = await manager.findOne(Member, { where: { id: memberId }, lock: { mode: 'pessimistic_write' } })
  if (!member) throw Object.assign(new Error('Member not found.'), { status: 404 })
  return member
}

// Every caller that posts charges holds the member row lock. The unique key is a second guard.
export async function postCharges(manager: EntityManager, memberId: string, asOf = day(new Date())) {
  const plans = await manager.find(MemberPlan, { where: { memberId }, relations: ['plan'] })
  const existing = await manager.find(BillingCharge, { where: { memberId } })
  let count = 0
  for (const p of plans) {
    if (p.billingRate === null || p.billingRate === undefined) {
      p.billingRate = Number(p.plan.monthlyCost); p.billingName = p.plan.name
      await manager.update(MemberPlan, p.id, { billingRate: p.billingRate, billingName: p.billingName })
    }
    const stop = [asOf, p.finalBillingDate, p.endDate && day(p.endDate)].filter(Boolean).sort()[0] as string
    for (let n = 0; ; n++) {
      const dueDate = anniversary(day(p.startDate), n)
      if (dueDate > stop) break
      if (n >= 1200) throw Error('Plan exceeds supported billing history')
      if (!existing.some(c => c.memberPlanId === p.id && c.dueDate === dueDate)) {
        await manager.save(BillingCharge, manager.create(BillingCharge, { memberId, memberPlanId: p.id,
          planName: p.billingName, dueDate, amount: p.billingRate!, voided: false }))
        count++
      }
    }
  }
  return count
}

export async function readBilling(manager: EntityManager, memberId: string, asOf = day(new Date())) {
  const [plans, payments, charges, adjustments] = await Promise.all([
    manager.find(MemberPlan, { where: { memberId }, relations: ['plan'] }), manager.find(Transaction, { where: { memberId } }),
    manager.find(BillingCharge, { where: { memberId } }), manager.find(ChargeAdjustment, { where: { memberId }, order: { createdAt: 'DESC' } }),
  ])
  return { plans, payments, records: charges, adjustments, ledger: postedLedger(charges, payments, adjustments, asOf) }
}

export async function refreshAccess(manager: EntityManager, member: Member, author = 'Automation') {
  const state = await readBilling(manager, member.id)
  const settings = await manager.findOneByOrFail(OperationsSettings, { id: 'default' })
  const decision = accessDecision(member, state.plans, state.ledger, settings.graceDays)
  if (member.billingSuspended !== decision.suspended) await manager.save(OperationsAudit, manager.create(OperationsAudit, {
    memberId: member.id, kind: decision.suspended ? 'Billing access suspended' : 'Billing access restored', author, detail: decision.reason,
  }))
  await manager.update(Member, member.id, { status: decision.status, balance: state.ledger.balance,
    billingSuspended: decision.suspended, statusReason: decision.reason })
  return { ...state, ...decision }
}

export async function ensureBilling(memberId: string) {
  return AppDataSource.transaction(async manager => {
    const member = await lockMember(manager, memberId)
    await postCharges(manager, memberId)
    return refreshAccess(manager, member)
  })
}

export async function initializeBilling() {
  await AppDataSource.transaction(async manager => {
    let settings = await manager.findOneBy(OperationsSettings, { id: 'default' })
    if (settings) return
    settings = manager.create(OperationsSettings, { id: 'default', graceDays: 60, dailyEnabled: true })
    await manager.save(settings)
    const members = await manager.find(Member)
    let posted = 0
    for (const member of members) {
      await lockMember(manager, member.id)
      const plans = await manager.find(MemberPlan, { where: { memberId: member.id }, relations: ['plan'] })
      const payments = await manager.find(Transaction, { where: { memberId: member.id } })
      const before = billingLedger(plans, payments)
      posted += await postCharges(manager, member.id)
      const after = (await readBilling(manager, member.id)).ledger
      if (before.balance !== after.balance || before.pastDue !== after.pastDue) throw Error('Billing migration reconciliation failed')
    }
    settings.migrationSummary = JSON.stringify({ members: members.length, charges: posted, reconciled: true, at: new Date().toISOString() })
    await manager.save(settings)
  })
}
