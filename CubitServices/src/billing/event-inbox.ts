import { createHash } from 'crypto'
import { AppDataSource } from '../app'
import { MemberPlan } from '../entity/memberPlan'
import { Member } from '../entity/member'
import { Transaction } from '../entity/transaction'
import { PaymentEvent, OperationsAudit } from '../entity/cubitOperations'
import { recordPayment, fail, requestKey } from './payments'
import { validDay, day } from './ledger'

// This local fixture endpoint cannot establish PayPal authenticity. Live webhooks remain blocked.
export async function receiveSimulation(body: any, author: string) {
  const input = { id: requestKey(body.id), kind: String(body.kind), resourceId: requestKey(body.resourceId),
    subscriptionId: String(body.subscriptionId || '').slice(0, 100), parentResourceId: String(body.parentResourceId || '').slice(0, 100),
    eventDate: body.eventDate, amount: Number(body.amount || 0) }
  if (input.resourceId.length > 100) fail('Resource IDs may be at most 100 characters.')
  if (!['payment', 'refund', 'cancellation'].includes(input.kind) || !validDay(input.eventDate) || input.eventDate > day(new Date()) ||
      input.eventDate < '1900-01-01' || !Number.isFinite(input.amount) || input.amount < 0 || input.amount > 99999999 ||
      Math.abs(input.amount * 100 - Math.round(input.amount * 100)) > 0.00001 || (input.kind !== 'cancellation' && !input.amount)) fail('Invalid test event.')
  const hash = createHash('sha256').update(JSON.stringify(input)).digest('hex')
  const previous = await AppDataSource.manager.findOneBy(PaymentEvent, { id: input.id })
  if (previous) { if (previous.payloadHash !== hash) fail('Event ID already exists with different contents.', 409); return previous }
  try {
    const saved = await AppDataSource.manager.save(PaymentEvent, AppDataSource.manager.create(PaymentEvent, {
      ...input, payloadHash: hash, detail: 'Local simulation; not received from PayPal.', status: 'Unmatched' }))
    await AppDataSource.manager.save(OperationsAudit, { kind: 'Test event received', author, detail: saved.id })
    return saved
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY') { const row = await AppDataSource.manager.findOneByOrFail(PaymentEvent, { id: input.id }); if (row.payloadHash !== hash) fail('Event ID conflict.', 409); return row }
    throw err
  }
}

export async function processEvent(id: string, memberId: string | undefined, author: string) {
  return AppDataSource.transaction(async manager => {
    const event = await manager.findOne(PaymentEvent, { where: { id }, lock: { mode: 'pessimistic_write' } })
    if (!event) fail('Event not found.', 404)
    if (event.status === 'Processed') return event
    event.attempts++
    const plans = event.subscriptionId ? await manager.find(MemberPlan, { where: { paypalSubscriptionId: event.subscriptionId } }) : []
    const matches = [...new Set(plans.map(p => p.memberId))]
    const selected = memberId || event.memberId || (matches.length === 1 ? matches[0] : '')
    if (!selected || !await manager.findOneBy(Member, { id: selected })) {
      event.status = 'Unmatched'; event.detail = 'Choose a member to reconcile this event.'
      return manager.save(event)
    }
    event.memberId = selected
    if (event.kind === 'cancellation') {
      const memberPlans = await manager.find(MemberPlan, { where: { memberId: selected }, order: { startDate: 'DESC' } })
      const plan = memberPlans.find(p => !event.subscriptionId || p.paypalSubscriptionId === event.subscriptionId)
      if (plan?.finalBillingDate) { event.status = 'Processed'; event.detail = `Staff final billing date reviewed: ${plan.finalBillingDate}.` }
      else { event.status = 'Needs final billing date'; event.detail = 'Staff must review the member plan and set the final billing date, then retry this review. No dates or balances were changed.' }
    } else {
      if (event.kind === 'refund') {
        const original = await manager.findOneBy(Transaction, { requestKey: `paypal:payment:${event.parentResourceId}` })
        if (!original || original.memberId !== selected) fail('Match the original payment before processing this refund.')
        // Serialize refunds on the original capture as well as on the member row.
        await manager.findOneOrFail(Transaction, { where: { id: original.id }, lock: { mode: 'pessimistic_write' } })
        const refunds = await manager.find(PaymentEvent, { where: { parentResourceId: event.parentResourceId, kind: 'refund', status: 'Processed' } })
        const sameResource = refunds.find(r => r.resourceId === event.resourceId)
        const distinct = [...new Map(refunds.map(r => [r.resourceId, r])).values()]
        if (!sameResource && Math.round((distinct.reduce((n, r) => n + Number(r.amount), 0) + Number(event.amount)) * 100) > Math.round(Number(original.amount) * 100)) fail('Refund exceeds the original payment.')
      }
      await recordPayment(manager, { id: 'New', memberId: selected, amount: (event.kind === 'refund' ? -1 : 1) * Number(event.amount),
        transactionDate: event.eventDate, description: `PayPal ${event.kind} simulation ${event.resourceId}`, method: 'PayPal simulation',
        requestKey: `paypal:${event.kind}:${event.resourceId}`, confirmation: event.resourceId }, author)
      event.status = 'Processed'; event.detail = 'Recorded once; member balance and access recalculated.'
    }
    await manager.save(OperationsAudit, { memberId: selected, kind: 'Event reconciliation', author, detail: `${event.id}: ${event.status}` })
    return manager.save(event)
  })
}
