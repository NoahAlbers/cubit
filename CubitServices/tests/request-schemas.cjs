const assert=require('node:assert/strict');
module.exports=async({request,db,memberId})=>{
 const {OperationsAudit,StaffNote,PaymentEvent,OperationsSettings}=require('../src/entity/cubitOperations');
 const {Waiver}=require('../src/entity/waiver');
 const {BackupJob}=require('../src/entity/backup');
 const entities=[OperationsAudit,StaffNote,PaymentEvent,OperationsSettings,Waiver,BackupJob];
 const counts=()=>Promise.all(entities.map(e=>db.manager.count(e)));
 const before=await counts();
 const invalid=[
  [`/api/cubit/members/${memberId}/notes`,{text:['private submitted value']}],
  [`/api/cubit/members/${memberId}/operations`,{accessHold:'false',reason:'Fixture'}],
  [`/api/cubit/members/${memberId}/charges`,{amount:12.345,date:'2026-09-24',description:'Fixture',requestKey:'fixture'}],
  ['/api/cubit/charges/missing/correct',{amount:10,expectedAmount:null,reason:'Fixture',requestKey:'fixture'}],
  ['/api/cubit/charges/missing/adjustments',{credit:-1,reason:'Fixture',requestKey:'fixture'}],
  ['/api/cubit/automation/settings',{graceDays:'60',dailyEnabled:false,version:0}],
  ['/api/cubit/automation/run',{preview:true,unexpected:true}],
  ['/api/cubit/automation/events/simulate',{}],
  ['/api/cubit/automation/events/missing/process',{memberId:{id:memberId}}],
  ['/api/cubit/staff/preferences',{enabled:'false'},'PUT'],
  ['/api/cubit/staff/preferences/preview',{enabled:true}],
  ['/api/waivers',[]],
  ['/api/waivers/missing/versions',{name:'Fixture',description:'Fixture',required:true,provider:'unknown'}],
  ['/api/waivers/missing/archive',{archived:'false',revision:1}],
  ['/api/waivers/documents/missing/review',{status:'Accepted',reason:'Fixture',revision:'1'}],
  ['/api/waivers/signatures/missing/sync',{submissionId:123}],
  ['/api/waivers/documents/template',{}],
  [`/api/waivers/members/${memberId}/versions/missing/documents`,{}],
  ['/api/backups/settings',{revision:1,settings:{frequency:'daily'}}],
  ['/api/backups/jobs',{kind:'backup',command:'private submitted value'}],
 ];
 for(const [path,body,method]of invalid){const r=await request(path,body,method||'POST');assert.equal(r.status,400,path);assert.ok(!JSON.stringify(r.data).includes('private submitted value'),'Validation must not echo submitted values');}
 assert.deepEqual(await counts(),before,'Malformed requests neither mutate records nor create audit rows');
 // A normal form with optional null fields still publishes, versions and archives.
 const form={name:'Schema fixture',description:'Not a legal waiver',required:false,provider:'demo',demoText:'Synthetic test only',signerRole:'Member',docusealTemplateId:null,sourceDocumentId:null};
 const created=await request('/api/waivers',form);assert.equal(created.status,201);
 const next=await request(`/api/waivers/${created.data.id}/versions`,{...form,revision:created.data.revision});assert.equal(next.status,201);
 const archived=await request(`/api/waivers/${created.data.id}/archive`,{archived:true,revision:next.data.revision});assert.equal(archived.status,200);
 console.log('PASS: every typed body boundary rejects malformed data before mutation; valid waiver forms retain version/archive behavior.');
};
