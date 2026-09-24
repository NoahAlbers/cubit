import express from 'express'
import { AppDataSource } from '../../database'
import { staffOnly } from '../common/staff-auth'
import { OperationsAudit } from '../../entity/cubitOperations'
import { Member } from '../../entity/member'
import { StaffAlertPreference } from '../../entity/staffAlertPreference'
import { auditDetail, recordAudit } from '../../staff/audit'
import { defaultPreferences, planAccessAlerts } from '../../staff/access-alerts'
import { fail } from '../../billing/payments'
import { validDay } from '../../billing/ledger'
const router=express.Router();router.use(staffOnly)
const route=(fn:any)=>async(req:any,res:any,next:any)=>{try{await fn(req,res)}catch(e){next(e)}}
const text=(v:any,max=200)=>typeof v==='string'?v.trim().slice(0,max):''
router.get('/audit',route(async(req:any,res:any)=>{
  const q=req.query,from=text(q.from,10),to=text(q.to,10),memberId=text(q.memberId,36),author=text(q.author),kind=text(q.kind),search=text(q.q)
  if(from&&!validDay(from)||to&&!validDay(to)||from&&to&&from>to)fail('Choose a valid date range.')
  const order=q.order==='asc'?'ASC':'DESC',sort=['date','action','staff','member'].includes(q.sort)?q.sort:'date'
  const pageSize=[20,50,100].includes(Number(q.pageSize))?Number(q.pageSize):20
  let page=Math.max(1,Math.min(1000000,Number.parseInt(q.page,10)||1))
  const query=AppDataSource.manager.createQueryBuilder(OperationsAudit,'a').leftJoin(Member,'m','m.id=a.memberId')
  if(memberId)query.andWhere('a.memberId=:memberId',{memberId})
  if(from)query.andWhere('a.createdAt>=:from',{from:from+' 00:00:00'})
  if(to)query.andWhere('a.createdAt<DATE_ADD(:to,INTERVAL 1 DAY)',{to:to+' 00:00:00'})
  if(author)query.andWhere('a.author=:author',{author})
  if(kind)query.andWhere('a.kind=:kind',{kind})
  if(q.actor==='staff')query.andWhere("COALESCE(JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(a.detail),a.detail,'{}'),'$.actorType')),IF(a.author='Automation','system',IF((a.kind LIKE 'Member updated%' OR a.kind='Demo waiver signed'),'member','staff')))='staff'")
  if(search)query.andWhere("CONCAT_WS(' ',m.firstName,m.lastName,m.email,a.author,a.kind,a.detail) LIKE :q ESCAPE '!'",{q:'%'+search.replace(/[!%_]/g,'!$&')+'%'})
  const total=await query.getCount(),pages=Math.max(1,Math.ceil(total/pageSize));page=Math.min(page,pages)
  query.select(['a.id AS id','a.memberId AS memberId','a.kind AS kind','a.author AS author','a.detail AS detail','a.createdAt AS createdAt',"NULLIF(TRIM(CONCAT_WS(' ',m.firstName,m.lastName)),'') AS memberName"])
  query.orderBy(({date:'a.createdAt',action:'a.kind',staff:'a.author',member:'m.lastName'} as any)[sort],order).addOrderBy('a.id',order).offset((page-1)*pageSize).limit(pageSize)
  const [rows,kinds,authors,member]=await Promise.all([query.getRawMany(),AppDataSource.manager.createQueryBuilder(OperationsAudit,'a').select('DISTINCT a.kind','value').orderBy('a.kind').getRawMany(),AppDataSource.manager.createQueryBuilder(OperationsAudit,'a').select('DISTINCT a.author','value').orderBy('a.author').getRawMany(),memberId?AppDataSource.manager.findOneBy(Member,{id:memberId}):null])
  res.json({rows:rows.map(a=>({...auditDetail(a),memberName:a.memberName})),total,page,pages,pageSize,sort,order:order.toLowerCase(),kinds:kinds.map(x=>x.value),authors:authors.map(x=>x.value),member:member?{id:member.id,name:member.firstName+' '+member.lastName}:null})
}))
router.get('/staff/preferences',route(async(req:any,res:any)=>{
  const preference=await AppDataSource.manager.findOneBy(StaffAlertPreference,{staffId:req.member.id})
  res.json({preferences:preference||{...defaultPreferences,revision:0},email:req.member.email,deliveryEnabled:false})
}))
router.put('/staff/preferences',route(async(req:any,res:any)=>{
  const b=req.body
  if(Object.keys(b).some(k=>!['enabled','unknownFobs','refusedFobs','dedupeMinutes','revision'].includes(k))||!['enabled','unknownFobs','refusedFobs'].every(k=>typeof b[k]==='boolean')||!Number.isInteger(b.dedupeMinutes)||b.dedupeMinutes<1||b.dedupeMinutes>1440||!Number.isInteger(b.revision))fail('Choose alert types and a duplicate window from 1 to 1440 minutes.')
  res.json(await AppDataSource.transaction(async manager=>{
    // Lock the staff identity even before their first preferences row exists.
    await manager.findOneOrFail(Member,{where:{id:req.member.id},lock:{mode:'pessimistic_write'}})
    const old=await manager.findOneBy(StaffAlertPreference,{staffId:req.member.id}),before=old?{enabled:old.enabled,unknownFobs:old.unknownFobs,refusedFobs:old.refusedFobs,dedupeMinutes:old.dedupeMinutes}:defaultPreferences
    if(b.revision!==(old?.revision||0))fail('These preferences changed elsewhere. Reload before saving.',409)
    const after={enabled:b.enabled,unknownFobs:b.unknownFobs,refusedFobs:b.refusedFobs,dedupeMinutes:b.dedupeMinutes}
    const saved=await manager.save(StaffAlertPreference,{staffId:req.member.id,...after,revision:b.revision+1})
    if(JSON.stringify(before)!==JSON.stringify(after))await recordAudit(manager,{kind:'Staff notification preferences changed',author:req.member.email,entityId:req.member.id,before,after})
    return {preferences:saved,email:req.member.email,deliveryEnabled:false}
  }))
}))
router.post('/staff/preferences/preview',route(async(req:any,res:any)=>{
  const p=await AppDataSource.manager.findOneBy(StaffAlertPreference,{staffId:req.member.id})||defaultPreferences
  const start=Date.now(),window=p.dedupeMinutes*60000
  res.json({deliveryEnabled:false,results:planAccessAlerts(p,[{id:'1',fob:'DEMO-001',outcome:'unknown',at:start},{id:'2',fob:'DEMO-001',outcome:'unknown',at:start+1000},{id:'3',fob:'DEMO-002',outcome:'refused',at:start+2000},{id:'4',fob:'DEMO-003',outcome:'granted',at:start+3000},{id:'5',fob:'DEMO-001',outcome:'unknown',at:start+window}])})
}))
module.exports=router
