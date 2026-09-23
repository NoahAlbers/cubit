import { EntityManager } from 'typeorm'
import { BillingCharge, ChargeAdjustment } from '../entity/cubitOperations'
import { lockMember, readBilling, refreshAccess, postCharges } from './store'
import { fail, reasonText, requestKey } from './payments'
import { day, validDay } from './ledger'

function money(value: unknown, allowZero = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < (allowZero ? 0 : 0.01) || value > 99999999 ||
      Math.abs(value * 100 - Math.round(value * 100)) > 0.00001) fail('Enter a valid amount with at most two decimal places.')
  return Math.round((value as number) * 100)
}

export async function addCharge(manager: EntityManager, memberId: string, input: any, author: string) {
  const amount = money(input.amount), name = reasonText(input.description, 255), key = requestKey(input.requestKey)
  if (!validDay(input.date) || input.date > day(new Date()) || input.date < '1900-01-01') fail('Enter a valid charge date no later than today.')
  const member = await lockMember(manager, memberId)
  const duplicate = await manager.findOneBy(BillingCharge, { requestKey: key })
  if (duplicate) {
    if (duplicate.memberId !== memberId || Math.round(Number(duplicate.amount)*100) !== amount || duplicate.dueDate !== input.date || duplicate.planName !== name) fail('This request ID was already used for a different charge.', 409)
    return duplicate
  }
  const charge = await manager.save(BillingCharge, manager.create(BillingCharge, {
    memberId, memberPlanId: `manual:${key}`, planName: name, dueDate: input.date, amount: amount / 100, requestKey: key, createdBy: author,
  }))
  await postCharges(manager, memberId)
  await refreshAccess(manager, member, author)
  return charge
}

export async function editCharge(manager: EntityManager, chargeId: string, input: any, author: string) {
  const amount = money(input.amount, true), expected = money(input.expectedAmount, true)
  const reason = reasonText(input.reason), key = requestKey(input.requestKey)
  const lookup = await manager.findOneBy(BillingCharge, { id: chargeId })
  if (!lookup) fail('Charge not found.', 404)
  const member = await lockMember(manager, lookup.memberId)
  const duplicate = await manager.findOneBy(ChargeAdjustment, { requestKey: key })
  if (duplicate) {
    if (duplicate.chargeId !== chargeId || Math.round(Number(duplicate.credit)*100) !== expected - amount) fail('This request ID was already used for another change.', 409)
    return duplicate
  }
  const state = await readBilling(manager, member.id)
  const current = state.ledger.charges.find(c => c.id === chargeId)
  if (!current) fail('This charge is no longer active. Refresh the member.', 409)
  if (Math.round(current.amount*100) !== expected) fail('The charge changed. Reopen it before editing.', 409)
  if (amount === expected) fail('Enter a different amount or cancel.')
  // Signed corrections preserve the original charge and allow an earlier waiver to be undone.
  const saved = await manager.save(ChargeAdjustment, manager.create(ChargeAdjustment, {
    memberId: member.id, chargeId, credit: (expected - amount)/100, reason, author, requestKey: key,
  }))
  await refreshAccess(manager, member, author)
  return saved
}
