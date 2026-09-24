import express from 'express'
import { AppDataSource } from '../../database'
import { staffOnly } from '../common/staff-auth'
import { PaymentEvent, OperationsAudit } from '../../entity/cubitOperations'
import { Member } from '../../entity/member'
import { MemberPlan } from '../../entity/memberPlan'
import { Plan } from '../../entity/plan'
import { Transaction } from '../../entity/transaction'
import { saveCatalogPlan } from '../../billing/plan-catalog'
import { sortPlans } from '../../billing/plan-order'
import { fail } from '../../billing/payments'
const router=express.Router()
router.use(staffOnly)
const route=(fn:any)=>async(req:any,res:any,next:any)=>{try{await fn(req,res)}catch(e){next(e)}}

router.get('/payment-matching',route(async(req:any,res:any)=>{
  const state=req.query.state==='processed'?'processed':'pending',q=String(req.query.q||'').trim().slice(0,150)
  const query=AppDataSource.manager.createQueryBuilder(PaymentEvent,'e').where(state==='processed'?'e.status = :status':'e.status != :status',{status:'Processed'})
  if(q)query.andWhere("(e.payerEmail LIKE :q ESCAPE '!' OR e.payerName LIKE :q ESCAPE '!' OR e.resourceId LIKE :q ESCAPE '!')",{q:'%'+q.replace(/[!%_]/g,'!$&')+'%'})
  const total=await query.getCount(),pages=Math.max(1,Math.ceil(total/20)),page=Math.min(pages,Math.max(1,Math.floor(Number(req.query.page))||1))
  const rows=await query.orderBy('e.createdAt','DESC').addOrderBy('e.id','DESC').skip((page-1)*20).take(20).getMany()
  res.json({rows,total,page,pages,state,pending:await AppDataSource.manager.createQueryBuilder(PaymentEvent,'e').where('e.status != :status',{status:'Processed'}).getCount()})
}))
router.get('/payment-matching/:id',route(async(req:any,res:any)=>{
  const event=await AppDataSource.manager.findOneBy(PaymentEvent,{id:req.params.id})
  if(!event)fail('Payment event not found.',404)
  const plans=event.subscriptionId?await AppDataSource.manager.findBy(MemberPlan,{paypalSubscriptionId:event.subscriptionId}):[]
  const duplicate=event.kind==='cancellation'?null:await AppDataSource.manager.findOneBy(Transaction,{requestKey:`paypal:${event.kind}:${event.resourceId}`})
  const original=event.kind==='refund'?await AppDataSource.manager.findOneBy(Transaction,{requestKey:`paypal:payment:${event.parentResourceId}`}):null
  const ids=[...new Set([event.memberId,duplicate?.memberId,original?.memberId,...plans.map(p=>p.memberId)].filter(Boolean))]
  const candidates=await AppDataSource.manager.createQueryBuilder(Member,'m').select(['m.id','m.firstName','m.lastName','m.email','m.paypalEmail','m.status'])
    .where('(LOWER(TRIM(m.email)) = :email OR LOWER(TRIM(m.paypalEmail)) = :email) AND :email != :empty',{email:event.payerEmail,empty:''})
    .orWhere(ids.length?'m.id IN (:...ids)':'1 = 0',{ids}).orderBy('m.lastName','ASC').getMany()
  res.json({event,candidates:candidates.map(m=>({...m,reasons:[event.payerEmail&&[m.email,m.paypalEmail].some(e=>e?.trim().toLowerCase()===event.payerEmail)?'Email match':'',plans.some(p=>p.memberId===m.id)?'Subscription match':'',duplicate?.memberId===m.id?'Payment already recorded':'',original?.memberId===m.id?'Original payment':'',event.memberId===m.id?'Previously selected':''].filter(Boolean)})),alreadyRecorded:!!duplicate})
}))
router.get('/matching-members',route(async(req:any,res:any)=>{
  const q=String(req.query.q||'').trim().slice(0,150)
  if(q.length<2)return res.json([])
  const rows=await AppDataSource.manager.createQueryBuilder(Member,'m').select(['m.id','m.firstName','m.lastName','m.email','m.paypalEmail','m.status'])
    .where("CONCAT(m.firstName, ' ', m.lastName) LIKE :q ESCAPE '!' OR m.email LIKE :q ESCAPE '!' OR m.paypalEmail LIKE :q ESCAPE '!'",{q:'%'+q.replace(/[!%_]/g,'!$&')+'%'})
    .orderBy('m.lastName','ASC').addOrderBy('m.firstName','ASC').take(20).getMany()
  res.json(rows)
}))
router.get('/plan-catalog',route(async(req:any,res:any)=>{
  const plans=sortPlans(await AppDataSource.manager.find(Plan))
  const history=await AppDataSource.manager.createQueryBuilder(OperationsAudit,'a').where('a.kind IN (:...kinds)',{kinds:['Plan created','Plan updated','Plan retired','Plan restored']}).orderBy('a.createdAt','DESC').take(50).getMany()
  res.json({plans,history:history.map(h=>({...h,change:JSON.parse(h.detail)}))})
}))
router.post('/plan-catalog',route(async(req:any,res:any)=>res.status(201).json(await saveCatalogPlan(req.body.id,req.body,req.member.email,true))))
router.put('/plan-catalog/:id',route(async(req:any,res:any)=>res.json(await saveCatalogPlan(req.params.id,req.body,req.member.email))))
module.exports=router
