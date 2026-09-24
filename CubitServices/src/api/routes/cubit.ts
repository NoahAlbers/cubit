import { recordAudit } from '../../staff/audit'
import express from 'express'
import { AppDataSource } from '../../database'
import { Member } from '../../entity/member'
import { MemberPlan } from '../../entity/memberPlan'
import { Transaction } from '../../entity/transaction'
import { BillingChange } from '../../entity/billingChange'
import { billingLedger, day, validDay, membershipStatus } from '../../billing/ledger'
import { directoryRows, filterDirectory } from '../../billing/directory'
import { staffOnly } from '../common/staff-auth'
import { BillingCharge } from '../../entity/cubitOperations'
import { lockMember, postCharges, readBilling, refreshAccess } from '../../billing/store'
import { postedLedger } from '../../billing/posted-ledger'

const router = express.Router()
router.use(staffOnly)
router.get('/members', async (req, res, next) => {
  try {
    const q = req.query
    if (q.field && !['all', 'firstName', 'lastName', 'email', 'paypalEmail', 'phone'].includes(String(q.field)))
      return res.status(400).json({ message: 'Invalid search field.' })
    return res.json(filterDirectory(await directoryRows(), q))
  } catch (err) { next(err) }
})

router.get('/members/:id/billing', async (req, res, next) => {
  try {
    if (!await AppDataSource.manager.findOneBy(Member, { id: req.params.id })) return res.sendStatus(404)
    const { plans, ledger, payments, adjustments, records, status, reason } = await new Member().getBilling(req.params.id)
    const history = await AppDataSource.manager.find(BillingChange, { where: { memberId: req.params.id }, order: { changedAt: 'DESC' } })
    res.json({ ...ledger, plans, payments, history, adjustments, voidedCharges: records.filter(c => c.voided), status, accessReason: reason })
  } catch (err) { next(err) }
})

// Preview and save use the same calculation. Saving also records who made the cutoff.
router.post('/plans/:id/cutoff', async (req, res, next) => {
  try {
    const { finalBillingDate, reason, preview, expectedDate } = req.body
    if (!validDay(finalBillingDate) || finalBillingDate < '1900-01-01' || finalBillingDate > '2100-12-31')
      return res.status(400).json({ message: 'Enter a valid final billing date.' })
    if (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 255)
      return res.status(400).json({ message: 'Enter a reason (1–255 characters).' })
    const result = await AppDataSource.transaction(async manager => {
      const lookup = await manager.findOneBy(MemberPlan, { id: req.params.id })
      if (!lookup) throw Object.assign(new Error('Plan not found.'), { status: 404 })
      const member = await lockMember(manager, lookup.memberId)
      const plan = await manager.findOneBy(MemberPlan, { id: req.params.id })
      if (!plan) throw Object.assign(new Error('Plan not found.'), { status: 404 })
      if (finalBillingDate < day(plan.startDate)) throw Object.assign(new Error('Final billing date cannot precede the plan start.'), { status: 400 })
      const previousDate = plan.finalBillingDate || (plan.endDate ? day(plan.endDate) : null)
      if (expectedDate !== previousDate) throw Object.assign(new Error('The plan changed. Refresh and review it again.'), { status: 409 })
      await postCharges(manager, plan.memberId)
      const { plans, payments, records, adjustments, ledger: before } = await readBilling(manager, plan.memberId)
      if (plans.some(p => p.id !== plan.id && day(p.startDate) <= finalBillingDate &&
          (!(p.finalBillingDate || p.endDate) || day(p.finalBillingDate || p.endDate) >= day(plan.startDate))))
        throw Object.assign(new Error('This date would overlap another membership plan.'), { status: 409 })
      const changed = plans.find(p => p.id === plan.id)!
      changed.finalBillingDate = finalBillingDate
      changed.endDate = new Date(`${finalBillingDate}T23:59:59`)
      const projected = records.map(c => c.memberPlanId === plan.id ? { ...c, voided: c.dueDate > finalBillingDate } : c)
      // An extended cutoff can expose anniversaries never posted under the old cutoff.
      const scheduled = billingLedger([{ ...changed, plan: { name: changed.billingName, monthlyCost: changed.billingRate! } }], []).charges
      for (const c of scheduled) if (!projected.some(p => p.memberPlanId === plan.id && p.dueDate === c.dueDate))
        projected.push({ id: `preview-${c.dueDate}`, memberId: plan.memberId, memberPlanId: plan.id,
          planName: c.planName, dueDate: c.dueDate, amount: c.amount, voided: false, createdAt: new Date() })
      const after = postedLedger(projected, payments, adjustments)
      if (preview !== true && previousDate !== finalBillingDate) {
        await manager.update(MemberPlan, plan.id, { finalBillingDate, endDate: changed.endDate })
        for (const c of records.filter(c => c.memberPlanId === plan.id))
          await manager.update(BillingCharge, c.id, { voided: c.dueDate > finalBillingDate })
        await postCharges(manager, plan.memberId)
        await manager.save(BillingChange, manager.create(BillingChange, { memberId: plan.memberId,
          memberPlanId: plan.id, previousDate, finalBillingDate, reason: reason.trim(), changedBy: req.member!.email }))
        await recordAudit(manager,{memberId:plan.memberId,kind:'Final billing date changed',author:req.member!.email,entityId:plan.id,
          before:{finalBillingDate:previousDate},after:{finalBillingDate},reason:reason.trim()})
        await refreshAccess(manager, member, req.member!.email)
      }
      return { before, after, previousDate, finalBillingDate, saved: preview !== true }
    })
    res.json(result)
  } catch (err) { next(err) }
})
module.exports = router
