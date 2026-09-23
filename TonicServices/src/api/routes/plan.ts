import { paypalTransactions } from './../../entity/PaypalTransaction'
import { AppDataSource } from './../../app'
import express from 'express'
import { Guid } from 'guid-typescript'
import { Plan } from '../../entity/plan'
import { MemberPlan } from '../../entity/memberPlan'
import { Member } from '../../entity/member'
import { day, validDay } from '../../billing/ledger'
import { lockMember, postCharges, refreshAccess } from '../../billing/store'
import { sortPlans } from '../../billing/plan-order'

const router = express.Router()

router.get('/', (req, res) => {
  AppDataSource.manager
    .find(Plan, { where: req.query.available === 'true' ? { available: true } : {}, order: { monthlyCost: 'ASC', name: 'ASC' } })
    .then((planList) => {
      res.status(200).json(sortPlans(planList))
    })
    .catch((err) => {
      return res.status(500).json({ error: err })
    })
})

router.get('/:Id', async (req, res) => {
  AppDataSource.manager
    .findOneOrFail(MemberPlan, { where: { id: req.params.Id } })
    .then((memberPlan: MemberPlan) => {
      return res.status(200).json(memberPlan)
    })
    .catch((err) => {
      return res.status(500).json({ error: err })
    })
})

router.post('/memberplan', async (req, res, next) => {
  try {
  const postedMemberPlan = { id: req.body.id, memberId: req.body.memberId, planId: req.body.planId,
    startDate: req.body.startDate,
    paypalSubscriptionId: '', paypalSubscriptionPlanId: '' }
  if (postedMemberPlan.id !== 'New') return res.status(400).json({ message: 'Use the final billing date workflow to end or correct an existing plan.' })
  if (req.body.endDate || req.body.finalBillingDate) return res.status(400).json({ message: 'Create the plan first, then set its final billing date with a reason.' })
  if (typeof postedMemberPlan.startDate !== 'string' || !validDay(day(postedMemberPlan.startDate)))
    return res.status(400).json({ message: 'Enter a valid start date.' })
  if (!await AppDataSource.manager.findOneBy(Member, { id: postedMemberPlan.memberId }) ||
      !await AppDataSource.manager.findOneBy(Plan, { id: postedMemberPlan.planId, available: true }))
    return res.status(400).json({ message: 'Choose an existing member and an available plan.' })
  const saved = await AppDataSource.transaction(async manager => {
  const member = await lockMember(manager, postedMemberPlan.memberId)
  const existing = await manager.find(MemberPlan, { where: { memberId: postedMemberPlan.memberId } })
  const start = day(postedMemberPlan.startDate)
  if (existing.some(p => !(p.finalBillingDate || p.endDate) || day(p.finalBillingDate || p.endDate) >= start))
    throw Object.assign(new Error('This would overlap an existing plan. Set its final billing date first.'), { status: 409 })

  if (postedMemberPlan.id == 'New') {
    postedMemberPlan.id = Guid.create().toString()
    postedMemberPlan.paypalSubscriptionId = ''
    postedMemberPlan.paypalSubscriptionPlanId = ''
  }

  const catalog = await manager.findOneByOrFail(Plan, { id: postedMemberPlan.planId, available: true })
  const memberPlan = await manager.save(MemberPlan, manager.create(MemberPlan, { ...postedMemberPlan,
    startDate: new Date(`${start}T12:00:00`), billingRate: Number(catalog.monthlyCost), billingName: catalog.name }))
  await postCharges(manager, member.id)
  await refreshAccess(manager, member, req.member!.email)
  return memberPlan
  })
  res.json(saved)
  } catch (err) { next(err) }
})

router.get('/:memberId', (req, res) => {
  AppDataSource.manager
    .find(MemberPlan, { where: { member: { id: req.params.memberId } } })
    .then((memberPlans) => {
      res.status(200).json(memberPlans)
    })
    .catch((err) => {
      res.status(500).send('error:' + err)
    })
})

module.exports = router
