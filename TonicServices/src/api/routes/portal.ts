import express from 'express'
import { AppDataSource } from '../../app'
import { signedIn } from '../common/member-auth'
import { Member } from '../../entity/member'
import { MemberKey } from '../../entity/memberKey'
import { OperationsAudit, OperationsSettings } from '../../entity/cubitOperations'
import { lockMember, ensureBilling } from '../../billing/store'
import { day } from '../../billing/ledger'
import { fail } from '../../billing/payments'
import { memberWaivers, startSigning, completeDemo, syncSigning } from '../../waivers/store'

const router=express.Router()
router.use(signedIn)
router.use((req,res,next)=>{res.setHeader('Cache-Control','no-store');next()})
const route=(fn:any)=>async(req:any,res:any,next:any)=>{try{await fn(req,res)}catch(err){next(err)}}
const profileFields=['firstName','lastName','email','phone','emergencyContact','emergencyEmail','emergencyPhone'] as const
function profile(member: Member) {
  return Object.fromEntries(profileFields.map(k=>[k,member[k]||'']))
}
router.get('/',route(async(req:any,res:any)=>{
  const member=req.member as Member
  const state=await ensureBilling(member.id), asOf=state.ledger.asOf
  const enabledKeys=await AppDataSource.manager.countBy(MemberKey,{memberId:member.id,status:'Active'})
  const plans=state.plans.map(p=>({id:p.id,name:p.billingName || p.plan.name,monthlyRate:Number(p.billingRate??p.plan.monthlyCost),
    startDate:day(p.startDate),finalBillingDate:p.finalBillingDate || (p.endDate?day(p.endDate):null)}))
  const payments=state.payments.filter(p=>!p.correctedBy&&!p.reversalOf&&Number(p.amount)!==0).map(p=>({
    id:p.id,amount:Number(p.amount),transactionDate:p.transactionDate,method:p.method,description:p.description }))
  res.json({profile:profile(member),
    status:state.status,entryAllowed:state.status==='Active'&&enabledKeys>0,enabledKeys,
    accessMessage:member.accessHold?'Please contact staff about your membership access.':state.reason,
    plans:plans.map(p=>({...p,current:p.startDate<=asOf&&(!p.finalBillingDate||p.finalBillingDate>=asOf)})),
    billing:{...state.ledger,payments,charges:state.ledger.charges.map(c=>({id:c.id,dueDate:c.dueDate,planName:c.planName,amount:c.amount,outstanding:c.outstanding}))},
    waivers:await memberWaivers(member.id)})
}))
router.put('/profile',route(async(req:any,res:any)=>{
  const b=req.body
  if(Object.keys(b).some(k=>!profileFields.includes(k as any)))fail('Only contact and emergency contact fields can be changed here.')
  const values:any={}
  for(const k of profileFields) {
    if(typeof b[k]!=='string'||b[k].trim().length>(k==='phone'||k==='emergencyPhone'?50:150))fail('Enter valid contact details.')
    values[k]=b[k].trim()
  }
  if(!values.firstName||!values.lastName||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email) ||
      (values.emergencyEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.emergencyEmail)))fail('Enter a name and valid email addresses.')
  values.email=values.email.toLowerCase()
  await AppDataSource.transaction(async manager=>{
    // A shared lock serializes portal email changes to prevent duplicate login addresses.
    await manager.findOneOrFail(OperationsSettings,{where:{id:'default'},lock:{mode:'pessimistic_write'}})
    const member=await lockMember(manager,req.member.id)
    if(await manager.createQueryBuilder(Member,'m').where('LOWER(m.email) = :email AND m.id != :id',{email:values.email,id:member.id}).getCount())fail('That email is already in use.',409)
    await manager.update(Member,member.id,values)
    await manager.save(OperationsAudit,{memberId:member.id,kind:'Member updated contact details',author:member.email,detail:JSON.stringify({fields:profileFields.filter(k=>values[k]!==member[k])})})
  })
  res.json({profile:values})
}))
router.post('/waivers/:versionId/start',route(async(req:any,res:any)=>res.json(await startSigning(req.member,req.params.versionId))))
router.post('/signatures/:id/demo-complete',route(async(req:any,res:any)=>res.json(await completeDemo(req.member.id,req.params.id,req.body))))
router.post('/signatures/:id/sync',route(async(req:any,res:any)=>res.json(await syncSigning(req.member.id,req.params.id))))
module.exports=router
