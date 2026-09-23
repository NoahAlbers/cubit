import { recordAudit } from '../../staff/audit'
import express from 'express'
import { AppDataSource } from '../../app'
import { staffOnly } from '../common/staff-auth'
import { Waiver, WaiverVersion, WaiverSignature } from '../../entity/waiver'
import { OperationsAudit } from '../../entity/cubitOperations'
import { directoryRows } from '../../billing/directory'
import { publishWaiver, publicSignature, memberWaivers, syncSigning } from '../../waivers/store'
import { docusealConfig } from '../../waivers/docuseal'
import { fail } from '../../billing/payments'
import { unlockWaiverPreview, requireWaiverPreview } from '../../waivers/preview'
import { loginLimit } from '../common/login-limit'

const router=express.Router()
router.use(staffOnly)
router.use((req,res,next)=>{res.setHeader('Cache-Control','no-store');next()})
router.post('/unlock',loginLimit(),unlockWaiverPreview)
router.use(requireWaiverPreview)
const route=(fn:any)=>async(req:any,res:any,next:any)=>{try{await fn(req,res)}catch(err){next(err)}}
router.get('/',route(async(req:any,res:any)=>{
  const [waivers,versions,signatures,members]=await Promise.all([
    AppDataSource.manager.find(Waiver),AppDataSource.manager.find(WaiverVersion,{order:{createdAt:'DESC',number:'DESC'}}),
    AppDataSource.manager.find(WaiverSignature,{order:{createdAt:'DESC'}}),directoryRows(),
  ])
  const required=waivers.filter(w=>w.required&&!w.archived)
  const compliance=members.map(m=>({id:m.id,name:`${m.firstName} ${m.lastName}`,email:m.email,status:m.status,
    missing:required.filter(w=>!signatures.some(s=>s.memberId===m.id&&s.versionId===w.currentVersionId&&s.status==='Signed')).map(w=>({id:w.id,name:w.name})),
    signed:required.filter(w=>signatures.some(s=>s.memberId===m.id&&s.versionId===w.currentVersionId&&s.status==='Signed')).length}))
  res.json({docusealConnected:docusealConfig().enabled,waivers:waivers.map(w=>({...w,version:versions.find(v=>v.id===w.currentVersionId),
    versions:versions.filter(v=>v.waiverId===w.id).map(v=>({...v,signedCount:signatures.filter(s=>s.versionId===v.id&&s.status==='Signed').length}))})),
    compliance,summary:{active:compliance.filter(m=>m.status==='Active').length,missing:compliance.filter(m=>m.status==='Active'&&m.missing.length).length,
      complete:compliance.filter(m=>m.status==='Active'&&!m.missing.length).length,required:required.length},
    signatures:signatures.map(s=>({...publicSignature(s),memberId:s.memberId,memberName:members.find(m=>m.id===s.memberId)?.firstName+' '+members.find(m=>m.id===s.memberId)?.lastName,
      version:versions.find(v=>v.id===s.versionId)}))})
}))
router.post('/',route(async(req:any,res:any)=>res.status(201).json(await publishWaiver(undefined,req.body,req.member.email))))
router.post('/:id/versions',route(async(req:any,res:any)=>res.status(201).json(await publishWaiver(req.params.id,req.body,req.member.email))))
router.post('/:id/archive',route(async(req:any,res:any)=>{
  if(typeof req.body.archived!=='boolean')fail('Choose archive or restore.')
  res.json(await AppDataSource.transaction(async manager=>{
    const waiver=await manager.findOne(Waiver,{where:{id:req.params.id},lock:{mode:'pessimistic_write'}})
    if(!waiver)fail('Waiver not found.',404)
    if(req.body.revision!==waiver.revision)fail('This waiver changed. Reload before saving.',409)
    const before={name:waiver.name,archived:waiver.archived}
    waiver.archived=req.body.archived;waiver.revision++
    await manager.save(waiver)
    await recordAudit(manager,{kind:waiver.archived?'Waiver archived':'Waiver restored',author:req.member.email,entityId:waiver.id,before,after:{name:waiver.name,archived:waiver.archived}})
    return waiver
  }))
}))
router.get('/members/:id',route(async(req:any,res:any)=>res.json(await memberWaivers(req.params.id))))
router.post('/signatures/:id/sync',route(async(req:any,res:any)=>{
  const signature=await AppDataSource.manager.findOneBy(WaiverSignature,{id:req.params.id})
  if(!signature)fail('Signing request not found.',404)
  res.json(await syncSigning(signature.memberId,signature.id))
}))
module.exports=router
