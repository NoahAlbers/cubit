const assert=require('node:assert/strict');
module.exports=async({db,request,ok,Member,jwtHelper})=>{
 const {BackupSettings,BackupJob}=require('../src/entity/backup');
 const staff=await db.manager.save(Member,db.manager.create(Member,{firstName:'Backup',lastName:'Staff',email:'backup.staff@example.test',paypalEmail:'',role:'staff'}));
 const token=jwtHelper.GenerateJWT(staff);
 const before=await ok('/api/backups');
 const read=await request('/api/backups',null,'GET',token);assert.equal(read.status,200);assert.equal(read.data.canManageSettings,false);assert.equal(before.canManageSettings,true);
 const count=await db.manager.count(BackupJob);
 assert.equal((await request('/api/backups/settings',{settings:{...before.settings,frequency:'manual',localKeep:3},revision:before.revision},'POST',token)).status,403);
 assert.equal((await request('/api/backups/jobs',{kind:'prune',revision:before.revision},'POST',token)).status,403);
 assert.equal((await db.manager.findOneByOrFail(BackupSettings,{id:'default'})).revision,before.revision);
 assert.equal(await db.manager.count(BackupJob),count);
 assert.equal((await request('/api/backups/settings',{settings:before.settings,revision:before.revision},'POST')).status,200);
 assert.equal((await request('/api/backups/jobs',{kind:'backup'},'POST',token)).status,503,'Staff may request backup, but demo has no worker');
 assert.equal((await request('/api/backups/jobs',{kind:'verify'},'POST',token)).status,503);
 console.log('PASS: backup settings and pruning are Administration-only; Staff retains read/backup/recovery access.');
};
