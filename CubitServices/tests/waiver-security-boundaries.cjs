const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
module.exports=async({db,request,base,Member,jwtHelper,staff})=>{
 const {Waiver,WaiverVersion,WaiverSignature}=require('../src/entity/waiver');
 const {WaiverDocument}=require('../src/entity/waiverDocument');
 const {AccountThrottle}=require('../src/entity/accountThrottle');
 const {OperationsAudit}=require('../src/entity/cubitOperations');
 const store=require('../src/waivers/store'),{uploadDocument}=require('../src/waivers/documents');
 const {localConfig}=require('../src/dev/config');
 const actor=await db.manager.save(Member,db.manager.create(Member,{firstName:'Upload',lastName:'Boundary',email:'upload.boundary@example.test',paypalEmail:'',role:'member'}));
 const pdf=Buffer.from('%PDF-1.4\nSynthetic boundary fixture\n%%EOF');
 const input={name:'Security demo fixture',description:'Synthetic only',provider:'demo',required:true,demoText:'Not a legal agreement'};
 const w=await store.publishWaiver(undefined,input,staff.email),version=w.version;
 const mode=localConfig.runtimeMode;
 try {
  const prior=await db.manager.save(WaiverDocument,db.manager.create(WaiverDocument,{memberId:actor.id,versionId:version.id,filename:'fixture.pdf',mime:'application/pdf',bytes:250*1024*1024-pdf.length,sha256:'0'.repeat(64),content:pdf,source:'member upload',status:'Pending review',uploadedBy:'old.address@example.test'}));
  const {UploadAccountLimits1790352000000}=require('../src/migrations/upload-security');const runner=db.createQueryRunner();try{await new UploadAccountLimits1790352000000().up(runner);}finally{await runner.release();}
  assert.equal((await db.manager.findOneByOrFail(WaiverDocument,{id:prior.id})).uploadedById,actor.id,'Legacy member uploads bind to ID despite changed email');
  const parallel=await Promise.allSettled([1,2].map(()=>uploadDocument(actor.id,version.id,pdf,'fixture.pdf',actor,false)));
  assert.deepEqual(parallel.map(x=>x.status).sort(),['fulfilled','rejected'],'Concurrent uploads cannot exceed account quota');
  const token=jwtHelper.GenerateJWT(actor),profile={firstName:actor.firstName,lastName:actor.lastName,email:'upload.changed@example.test',phone:'',emergencyContact:'',emergencyEmail:'',emergencyPhone:''};
  assert.equal((await request('/api/portal/profile',profile,'PUT',token)).status,200);
  Object.assign(actor,await db.manager.findOneByOrFail(Member,{id:actor.id}));
  await assert.rejects(uploadDocument(actor.id,version.id,pdf,'fixture.pdf',actor,false),e=>e.status===413,'Email changes cannot reset upload allowance');
  const currentToken=jwtHelper.GenerateJWT(actor);
  for(const raw of [undefined,'null','[]','42','"wrong"','{}']){
    const r=await fetch(base+'/api/portal/profile',{method:'PUT',headers:{Authorization:'Bearer '+currentToken,'Content-Type':'application/json'},body:raw});assert.equal(r.status,400);
  }
  assert.equal((await db.manager.findOneByOrFail(Member,{id:actor.id})).email,profile.email);
  const upload=()=>fetch(base+'/api/portal/waivers/'+version.id+'/documents',{method:'POST',headers:{Authorization:'Bearer '+currentToken,'Content-Type':'application/octet-stream'},body:Buffer.from('bad')});
  for(let i=0;i<10;i++)assert.equal((await upload()).status,400,'Invalid files consume attempts');
  const limited=await upload();assert.equal(limited.status,429);assert.ok(Number(limited.headers.get('retry-after'))>0);
  assert.equal((await db.manager.findOneByOrFail(AccountThrottle,{id:'upload:'+actor.id})).attempts,10);
  const signing=await store.startSigning(actor,version.id);await store.completeDemo(actor.id,signing.id,{name:'Synthetic Member',acknowledged:true});
  assert.equal((await store.memberWaivers(actor.id)).current.find(x=>x.id===w.id).complete,true);
  localConfig.runtimeMode='hosted-review';
  for(const action of [()=>store.publishWaiver(undefined,input,staff.email),()=>store.publishWaiver(w.id,{...input,revision:w.revision},staff.email),()=>store.startSigning(actor,version.id),()=>store.completeDemo(actor.id,signing.id,{name:'Synthetic',acknowledged:true}),()=>store.syncSigning(actor.id,signing.id)])await assert.rejects(action,e=>e.status===403);
  const listed=await store.memberWaivers(actor.id);assert.equal(listed.current.find(x=>x.id===w.id).complete,false);assert.equal(listed.current.find(x=>x.id===w.id).signature.status,'Demo only');
  const compliance=await request('/api/waivers',null,'GET',jwtHelper.GenerateJWT(staff));assert.equal(compliance.status,200);assert.ok(compliance.data.compliance.find(x=>x.id===actor.id).missing.some(x=>x.id===w.id));assert.equal(compliance.data.demoAllowed,false);
  localConfig.runtimeMode='local';assert.equal(require('../src/waivers/policy').demoWaiversAllowed(),true);
  console.log('PASS: account-ID upload quota/backfill, concurrent quota enforcement, email-change bypass blocked, durable upload throttle, malformed portal bodies and hosted demo-waiver exclusion.');
 } finally {
  localConfig.runtimeMode=mode;
  for(const E of [WaiverDocument,WaiverSignature,OperationsAudit])await db.manager.delete(E,{memberId:actor.id});
  await db.manager.delete(WaiverVersion,{waiverId:w.id});await db.manager.delete(Waiver,{id:w.id});await db.manager.delete(AccountThrottle,{id:'upload:'+actor.id});await db.manager.delete(Member,{id:actor.id});
  // The portal change creates a notice; only remove this synthetic account's notice.
  await db.manager.delete(require('../src/entity/accountSecurity').AccountNotice,{memberId:actor.id});
 }
};
