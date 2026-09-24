// Isolated synthetic local schema only. Never connects to hosted or imported records.
const assert=require('assert/strict'),{randomUUID}=require('crypto')
Object.assign(process.env,{LOCAL_DEVELOPMENT:'true',DATABASE_NAME:'TonicLocalDev',DATABASE_URI:'127.0.0.1',DATABASE_USERNAME:'tonic_local',PORT:'5013',HOST:'127.0.0.1',DOCUSEAL_ENABLED:'false'})
delete process.env.CUBIT_MODE
require('ts-node/register')
const {AppDataSource:db,startLocalApp}=require('../src/app')
const {Member}=require('../src/entity/member'),{Waiver,WaiverVersion,WaiverSignature}=require('../src/entity/waiver')
const {WaiverDocument}=require('../src/entity/waiverDocument'),{OperationsAudit}=require('../src/entity/cubitOperations')
const {jwtHelper}=require('../src/api/common/jwtHelper'),{hash}=require('bcrypt')
const {syncSigning}=require('../src/waivers/store'),{inspectDocument}=require('../src/waivers/documents')
const {validateTemplate,createSigning,downloadSigningFile}=require('../src/waivers/docuseal')
const pdf=Buffer.from('%PDF-1.4\nSynthetic test bytes only; no legal effect.\n%%EOF\n')
async function main(){
 const server=await startLocalApp(),ids=[randomUUID(),randomUUID()],documents=[],waivers=[]
 const base='http://127.0.0.1:5013'
 const call=async(path,token,body,status=200,binary=false)=>{
  const headers={Authorization:'Bearer '+token}
  if(body!==undefined)headers['Content-Type']=binary?'application/octet-stream':'application/json'
  if(binary)headers['X-Cubit-Filename']='fixture.pdf'
  const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:binary?body:JSON.stringify(body)})
  const data=Buffer.from(await r.arrayBuffer());assert.equal(r.status,status,data.toString());return {data,json:()=>JSON.parse(data.toString()),headers:r.headers}
 }
 try{
  const password=await hash(randomUUID(),4)
  for(const id of ids)await db.manager.save(Member,{id,firstName:'Waiver',lastName:'QA',email:id+'@example.test',paypalEmail:'',phone:'',role:'member',password})
  const admin=await db.manager.findOneByOrFail(Member,{email:'admin@example.test'}),a=jwtHelper.GenerateJWT(admin)
  const member=await db.manager.findOneByOrFail(Member,{id:ids[0]}),m=jwtHelper.GenerateJWT(member),other=jwtHelper.GenerateJWT(await db.manager.findOneByOrFail(Member,{id:ids[1]}))
  await call('/api/waivers/documents/template',m,pdf,403,true)
  await call('/api/waivers/documents/template',a,Buffer.from('<script>invalid</script>'),400,true)
  const original=(await call('/api/waivers/documents/template',a,pdf,201,true)).json();documents.push(original.id)
  await call('/api/portal/documents/'+original.id,m,undefined,404)
  const input={name:'QA waiver '+randomUUID(),description:'Nonbinding test only',required:true,provider:'paper',sourceDocumentId:original.id}
  const w=(await call('/api/waivers',a,input,201)).json();waivers.push(w.id)
  assert.deepEqual((await call('/api/portal/documents/'+original.id,m)).data,pdf)
  const uploaded=(await call('/api/portal/waivers/'+w.version.id+'/documents',m,pdf,201,true)).json();documents.push(uploaded.id)
  const complete=async()=> (await call('/api/portal',m)).json().waivers.current.find(x=>x.id===w.id).complete
  assert.equal(await complete(),false)
  await call('/api/portal/documents/'+uploaded.id,other,undefined,404)
  await call('/api/waivers/documents/'+uploaded.id+'/review',m,{status:'Accepted',reason:'Forged',revision:1},403)
  await call('/api/waivers/documents/'+uploaded.id+'/review',a,{status:'Accepted',reason:'Checked synthetic fixture',revision:1})
  assert.equal(await complete(),true)
  await call('/api/waivers/documents/'+uploaded.id+'/review',a,{status:'Rejected',reason:'stale',revision:1},409)
  await call('/api/waivers/documents/'+uploaded.id+'/review',a,{status:'Rejected',reason:'Replacement needed in test',revision:2})
  assert.equal(await complete(),false)
  const dl=await call('/api/portal/documents/'+uploaded.id,m);assert.deepEqual(dl.data,pdf);assert.match(dl.headers.get('content-disposition'),/attachment/)
  const source2=(await call('/api/waivers/documents/template',a,pdf,201,true)).json();documents.push(source2.id)
  await call('/api/waivers/'+w.id+'/versions',a,{...input,sourceDocumentId:source2.id,revision:w.revision},201)
  await call('/api/portal/waivers/'+w.version.id+'/documents',m,pdf,409,true)
  assert.deepEqual((await call('/api/portal/documents/'+uploaded.id,m)).data,pdf,'Superseding a version retains earlier files')
  assert.ok(await db.manager.createQueryBuilder(OperationsAudit,'a').where('a.memberId=:id',{id:member.id}).andWhere('a.detail LIKE :document',{document:'%'+uploaded.id+'%'}).getCount()>=3)
  // Provider API is mocked; no external request or actual waiver signing occurs.
  const axios=require('axios'),adapter=axios.defaults.adapter;process.env.DOCUSEAL_ENABLED='true';process.env.DOCUSEAL_API_KEY='mock-only';process.env.DOCUSEAL_PUBLIC_URL='https://docuseal.com'
  const signature=await db.manager.save(WaiverSignature,{memberId:member.id,waiverId:w.id,versionId:w.version.id,provider:'docuseal',signerEmail:member.email,signerName:'Test',submissionId:10,submitterId:30,slug:'testSlug',status:'Pending'})
  await db.manager.update(WaiverVersion,w.version.id,{provider:'docuseal',docusealTemplateId:20})
  let failDownload=true
  axios.defaults.adapter=async config=>{
    let data
    if(config.url.includes('/file/')){assert.ok(!config.headers['X-Auth-Token']);if(failDownload)throw Error('offline');data=pdf}
    else {assert.equal(config.headers['X-Auth-Token'],'mock-only')
      if(config.url.endsWith('/templates/20'))data={submitters:[{name:'Member'}],fields:[{type:'signature',required:true}],documents:[{url:'https://docuseal.com/file/original.pdf'}],schema:[]}
      else if(config.method==='post'){const body=JSON.parse(config.data);assert.equal(body.send_email,false);assert.equal(body.send_sms,false);assert.equal(body.submitters[0].send_email,false);data=[{id:30,submission_id:10,slug:'testSlug'}]}
      else data={id:10,template:{id:20},status:'completed',documents:[{url:'https://docuseal.com/file/signed.pdf'}],audit_log_url:'https://docuseal.com/file/audit.pdf',submitters:[{id:30,slug:'testSlug',email:member.email,external_id:signature.id,status:'completed',completed_at:new Date().toISOString()}]}
    }return {data,status:200,statusText:'OK',headers:{},config}
  }
  try{
    await assert.rejects(syncSigning(member.id,signature.id));assert.equal((await db.manager.findOneByOrFail(WaiverSignature,{id:signature.id})).status,'Pending')
    failDownload=false;const checked=await validateTemplate(20,'Member');assert.equal(checked.sha256,inspectDocument(pdf,'x.pdf').sha256)
    await assert.rejects(createSigning({docusealTemplateId:20,signerRole:'Member',providerFingerprint:'changed'},signature))
    await createSigning({docusealTemplateId:20,signerRole:'Member',providerFingerprint:checked.fingerprint},signature)
    await assert.rejects(downloadSigningFile('https://evil.example/file/a.pdf'));await assert.rejects(downloadSigningFile('https://docuseal.com/api/user'))
    await syncSigning(member.id,signature.id);await syncSigning(member.id,signature.id)
    assert.equal(await db.manager.countBy(WaiverDocument,{signatureId:signature.id}),2,'Signed PDF and certificate retained once')
    assert.equal((await db.manager.findOneByOrFail(WaiverSignature,{id:signature.id})).status,'Signed')
  }finally{axios.defaults.adapter=adapter;process.env.DOCUSEAL_ENABLED='false'}
  console.log('PASS: private upload/download, member isolation, staff review, immutable retention, version changes, concurrency, failed archival retry, template drift and duplicate-safe signed PDF/certificate archival.')
 }finally{
  for(const memberId of ids){await db.manager.delete(WaiverDocument,{memberId});await db.manager.delete(WaiverSignature,{memberId});await db.manager.delete(OperationsAudit,{memberId})}
  for(const id of documents)await db.manager.delete(WaiverDocument,{id})
  for(const waiverId of waivers){await db.manager.delete(WaiverVersion,{waiverId});await db.manager.delete(Waiver,{id:waiverId})}
  await db.manager.delete(Member,ids);await new Promise(resolve=>server.close(resolve));await db.destroy()
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1})
