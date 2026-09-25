const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
module.exports=async({db,request,Member,jwtHelper})=>{
 const {BackupJob}=require('../src/entity/backup'),{OperationsAudit}=require('../src/entity/cubitOperations');
 const {localConfig}=require('../src/dev/config'),{systemHealth,invalidateHealth}=require('../src/system/health');
 const staff=await db.manager.save(Member,db.manager.create(Member,{firstName:'Review',lastName:'Staff',email:'backup.reviewer@example.test',paypalEmail:'',role:'staff'})),token=jwtHelper.GenerateJWT(staff);
 const id=randomUUID();await db.manager.save(BackupJob,{id,kind:'backup',status:'Failed',requestedBy:'fixture',result:JSON.stringify({message:'Synthetic failure'})});
 const path='/api/backups/jobs/'+id+'/review',body={reviewed:true,reason:'Expected failure during isolated recovery test',revision:0};
 assert.equal((await request(path,body,'POST',null)).status,401);assert.equal((await request(path,body,'POST',token)).status,403);
 const original=localConfig.runtimeMode;
 const health=async()=>{localConfig.runtimeMode='local';try{return await systemHealth();}finally{localConfig.runtimeMode=original;}};
 try{
  invalidateHealth();
  assert.equal((await health()).checks.find(c=>c.name==='Recent backup failures').status,'warning');
  const saved=await request(path,body,'POST');assert.equal(saved.status,200);assert.equal(saved.data.status,'Failed');assert.equal(saved.data.reviewRevision,1);assert.ok(saved.data.reviewedBy);
  assert.equal((await health()).checks.find(c=>c.name==='Recent backup failures').status,'ok');
  assert.equal((await request(path,body,'POST')).status,409);
  assert.equal((await request('/api/backups/jobs?filter=reviewed')).data.rows.some(j=>j.id===id),true);
  assert.equal((await request('/api/backups/jobs?filter=unreviewed')).data.rows.some(j=>j.id===id),false);
  assert.equal((await request(path,{...body,reviewed:false,revision:1,reason:'The issue requires investigation'},'POST')).status,200);
  assert.equal((await health()).checks.find(c=>c.name==='Recent backup failures').status,'warning');
  assert.equal((await db.manager.findOneByOrFail(BackupJob,{id})).result,JSON.stringify({message:'Synthetic failure'}));
  assert.equal((await request(path,{...body,revision:2,reason:''},'POST')).status,400);
  assert.ok(await db.manager.countBy(OperationsAudit,{kind:'Backup failure reviewed'}));assert.ok(await db.manager.countBy(OperationsAudit,{kind:'Backup failure reopened'}));
 }finally{localConfig.runtimeMode=original;await db.manager.delete(BackupJob,{id});invalidateHealth();}
 console.log('PASS: administrator-only backup review, reason/stale-write protection, preserved failures, reopening, health refresh, and audit history.');
};
