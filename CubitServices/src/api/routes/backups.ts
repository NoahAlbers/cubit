import express from 'express'
import {randomUUID} from 'crypto'
import {AppDataSource} from '../../app'
import {staffOnly} from '../common/staff-auth'
import {localConfig} from '../../dev/config'
import {BackupSettings,BackupJob,BackupRuntime} from '../../entity/backup'
import {defaultBackupSettings,validateBackupSettings} from '../../backups/settings'
import {recordAudit} from '../../staff/audit'
import {fail} from '../../billing/payments'
const router=express.Router();router.use(staffOnly)
const route=(fn:any)=>async(req:any,res:any,next:any)=>{try{res.setHeader('Cache-Control','no-store');await fn(req,res)}catch(e){next(e)}}
async function settings(){await AppDataSource.manager.createQueryBuilder().insert().into(BackupSettings).values({id:'default',settings:JSON.stringify(defaultBackupSettings),revision:1}).orIgnore().execute();return AppDataSource.manager.findOneByOrFail(BackupSettings,{id:'default'})}
async function runtime(){const r=await AppDataSource.manager.findOneBy(BackupRuntime,{id:'default'});const detail=r?JSON.parse(r.detail):{};return {...detail,heartbeat:r?.heartbeat,available:localConfig.runtimeMode==='hosted-review'&&!!r&&Date.now()-new Date(r.heartbeat).getTime()<180000}}
router.get('/',route(async(req:any,res:any)=>{const [s,r,jobs]=await Promise.all([settings(),runtime(),AppDataSource.manager.find(BackupJob,{order:{createdAt:'DESC'},take:30})]);res.json({settings:JSON.parse(s.settings),revision:s.revision,runtime:r,jobs:jobs.map(j=>({...j,result:j.result?JSON.parse(j.result):null})),hosted:localConfig.runtimeMode==='hosted-review'})}))
router.post('/settings',route(async(req:any,res:any)=>{
 const value=validateBackupSettings(req.body.settings),r=await runtime()
 if(value.offsiteEnabled&&!r.offsiteConfigured)fail('Connect private off-server storage on the server before enabling copies.')
 await settings()
 const revision=await AppDataSource.transaction(async m=>{const s=await m.findOneOrFail(BackupSettings,{where:{id:'default'},lock:{mode:'pessimistic_write'}});if(s.revision!==req.body.revision)fail('Backup settings changed. Reload before saving.',409);const before=JSON.parse(s.settings);s.settings=JSON.stringify(value);s.revision++;await m.save(s);await recordAudit(m,{kind:'Backup settings changed',author:req.member.email,entityId:'backup-settings',before,after:value});return s.revision})
 res.json({revision})
}))
router.post('/jobs',route(async(req:any,res:any)=>{
 if(!req.body||typeof req.body!=='object'||Array.isArray(req.body)||Object.keys(req.body).some(k=>!['kind','snapshot','revision'].includes(k)))fail('Unexpected backup request.')
 if(!['backup','verify','prune'].includes(req.body.kind))fail('Choose backup, recovery test or local retention.')
 if(req.body.snapshot!==undefined&&(req.body.kind!=='verify'||typeof req.body.snapshot!=='string'||!/^[a-f0-9]{64}$/.test(req.body.snapshot)))fail('Choose a retained local backup.')
 const r=await runtime();if(!r.available)fail('The backup worker is unavailable. No job was started.',503)
 if(req.body.snapshot&&(!Array.isArray(r.snapshots)||!r.snapshots.some((s:any)=>s.id===req.body.snapshot)))fail('This backup is no longer listed. Refresh the inventory.',409)
 await settings()
 const job=await AppDataSource.transaction(async m=>{
  const s=await m.findOneOrFail(BackupSettings,{where:{id:'default'},lock:{mode:'pessimistic_write'}})
  if(req.body.kind==='prune'&&req.body.revision!==s.revision)fail('Retention settings changed. Refresh before confirming cleanup.',409)
  if(await m.createQueryBuilder(BackupJob,'j').where("j.status IN ('Queued','Running')").getCount())fail('A backup operation is already queued or running.',409)
  const request=req.body.snapshot?{requestedSnapshot:req.body.snapshot}:req.body.kind==='prune'?{localKeep:JSON.parse(s.settings).localKeep}:{}
  const j=await m.save(BackupJob,m.create(BackupJob,{id:randomUUID(),kind:req.body.kind,status:'Queued',requestedBy:req.member.email,result:JSON.stringify(request)}))
  await recordAudit(m,{kind:j.kind==='backup'?'Backup requested':j.kind==='prune'?'Local retention requested':'Recovery test requested',author:req.member.email,entityId:j.id,after:request});return j
 })
 res.status(202).json(job)
}))
module.exports=router
