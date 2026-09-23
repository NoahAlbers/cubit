const assert=require('assert/strict')
const {randomUUID}=require('crypto')
const {request}=require('./native-smoke.cjs')
require('ts-node/register')
const {hash}=require('bcrypt')
const {AppDataSource:db}=require('../src/app')
const {Member}=require('../src/entity/member')
const {MemberPlan}=require('../src/entity/memberPlan')
const {StaffNote,OperationsAudit,BillingCharge}=require('../src/entity/cubitOperations')
const {Waiver,WaiverVersion,WaiverSignature}=require('../src/entity/waiver')
const {verifiedCompletion,docusealConfig,validateTemplate,createSigning,retrieveSigning}=require('../src/waivers/docuseal')

async function main(){
  assert.equal(docusealConfig().enabled,false,'Integration tests must use the offline demo')
  for(const url of ['/api/portal','/api/waivers','/task','/ACON/getWhitelist'])assert.equal((await request(url)).status,401)
  const admin=(await request('/login',{method:'POST',body:{email:'admin@example.test',password:'LocalDemoOnly!2026'}})).json().token
  assert.equal((await request('/api/waivers',{token:admin})).status,403)
  const previewToken=(await request('/api/waivers/unlock',{method:'POST',token:admin,body:{password:process.env.WAIVER_PREVIEW_PASSWORD||'test'}})).json().token
  assert.equal((await request('/login',{method:'POST',body:{email:{bad:true},password:1}})).status,401)
  await db.initialize()
  const id=randomUUID(),other=randomUUID(),prefix='portal-'+randomUUID(),waiverIds=[]
  let token
  const call=async(url,method='GET',body,who=token,status=200)=>{const r=await request(url,{method,body,token:who,previewToken});assert.equal(r.status,status,r.text);return status===200||status===201?r.json():r}
  try{
    const password=await hash('PortalTestOnly!2026',10)
    for(const [memberId,name] of [[id,'Portal'],[other,'Other']])await db.manager.save(Member,{id:memberId,firstName:name,lastName:'Fixture',email:`${prefix}-${name}@example.test`.toLowerCase(),paypalEmail:'',password,role:'member',phone:'202-555-0199'})
    await db.manager.save(MemberPlan,{memberId:id,planId:'10000000-0000-4000-8000-000000000001',startDate:new Date(),paypalSubscriptionId:'',paypalSubscriptionPlanId:''})
    await db.manager.save(StaffNote,{memberId:id,text:'PRIVATE STAFF NOTE',author:'Test'})
    const login=await call('/login','POST',{email:`${prefix}-portal@example.test`,password:'PortalTestOnly!2026'},undefined)
    token=login.token
    assert.deepEqual(Object.keys(login.member).sort(),['email','firstName','id','lastName','role'])
    for(const url of ['/member','/member/'+other,'/plan','/transaction','/key','/task','/ACON/getWhitelist','/api/cubit/members','/api/cubit/reports','/api/waivers'])await call(url,'GET',undefined,token,403)
    const initial=await call('/api/portal?memberId='+other)
    assert.equal(initial.profile.firstName,'Portal');assert.equal(initial.status,'Active');assert.ok(initial.plans[0].current)
    assert.ok(!JSON.stringify(initial).includes('PRIVATE STAFF NOTE'));assert.equal(initial.password,undefined)
    assert.ok(!JSON.stringify(initial).includes('recordedBy'));assert.ok(!JSON.stringify(initial).includes('author'))
    await call('/api/portal/profile','PUT',{...initial.profile,role:'admin'},token,400)
    await call('/api/portal/profile','PUT',{...initial.profile,id:other},token,400)
    await call('/api/portal/profile','PUT',{...initial.profile,email:'ADMIN@EXAMPLE.TEST'},token,409)
    await call('/api/portal/profile','PUT',{...initial.profile,email:'invalid'},token,400)
    const updated={...initial.profile,email:`${prefix}-changed@example.test`,phone:'202-555-0111',emergencyContact:'Test Contact',emergencyEmail:'contact@example.test',emergencyPhone:'202-555-0123'}
    await call('/api/portal/profile','PUT',updated)
    assert.deepEqual((await call('/api/portal')).profile,updated,'ID based session survives an email update')
    assert.equal((await db.manager.findOneByOrFail(Member,{id:other})).phone,'202-555-0199')
    await call('/login','POST',{email:updated.email,password:'PortalTestOnly!2026'},undefined)
    assert.ok(!('preferences' in (await call('/api/portal'))))
    await call('/api/portal/preferences','PUT',{renewalReminders:true,waiverReminders:true},token,404)
    const input={name:prefix,description:'Test waiver',required:true,provider:'demo',demoText:'Test only. No legal effect.'}
    await call('/api/waivers','POST',input,token,403)
    const w=await call('/api/waivers','POST',input,admin,201);waiverIds.push(w.id)
    const start=()=>call(`/api/portal/waivers/${w.version.id}/start`,'POST',{})
    const requests=await Promise.all([start(),start(),start()]);assert.ok(requests.every(s=>s.id===requests[0].id))
    const otherToken=(await call('/login','POST',{email:`${prefix}-other@example.test`,password:'PortalTestOnly!2026'},undefined)).token
    await call(`/api/portal/signatures/${requests[0].id}/demo-complete`,'POST',{name:'Forged',acknowledged:true},otherToken,404)
    await call(`/api/portal/signatures/${requests[0].id}/sync`,'POST',{},otherToken,404)
    await call(`/api/portal/signatures/${requests[0].id}/demo-complete`,'POST',{name:'Portal Fixture',acknowledged:false},token,400)
    const signed=await call(`/api/portal/signatures/${requests[0].id}/demo-complete`,'POST',{name:'Portal Fixture',acknowledged:true})
    assert.equal(signed.status,'Signed')
    const repeated=await call(`/api/portal/signatures/${requests[0].id}/demo-complete`,'POST',{name:'Changed',acknowledged:true})
    assert.equal(repeated.signerName,'Portal Fixture')
    let portal=await call('/api/portal');assert.equal(portal.waivers.current.find(x=>x.id===w.id).signature.status,'Signed')
    let staff=await call('/api/waivers','GET',undefined,admin)
    assert.ok(!staff.compliance.find(m=>m.id===id).missing.some(x=>x.id===w.id))
    const v2=await call(`/api/waivers/${w.id}/versions`,'POST',{...input,revision:w.revision,demoText:'Version two'},admin,201)
    await call(`/api/waivers/${w.id}/versions`,'POST',{...input,revision:w.revision},admin,409)
    await call(`/api/portal/waivers/${w.version.id}/start`,'POST',{},token,409)
    portal=await call('/api/portal');assert.equal(portal.waivers.current.find(x=>x.id===w.id).signature,null)
    assert.ok(portal.waivers.history.some(s=>s.version.id===w.version.id))
    staff=await call('/api/waivers','GET',undefined,admin)
    assert.ok(staff.compliance.find(m=>m.id===id).missing.some(x=>x.id===w.id))
    const pending=await call(`/api/portal/waivers/${v2.version.id}/start`,'POST',{})
    const archived=await call(`/api/waivers/${w.id}/archive`,'POST',{archived:true,revision:v2.revision},admin)
    await call(`/api/portal/signatures/${pending.id}/demo-complete`,'POST',{name:'Portal',acknowledged:true},token,409)
    assert.ok(!(await call('/api/portal')).waivers.current.some(x=>x.id===w.id))
    await call(`/api/waivers/${w.id}/archive`,'POST',{archived:false,revision:archived.revision},admin)
    assert.ok((await call('/api/portal')).waivers.current.some(x=>x.id===w.id))
    await call('/api/waivers','POST',{...input,provider:'docuseal',docusealTemplateId:123,signerRole:'Member'},admin,503)

    // Never trust browser callbacks or unrelated DocuSeal signatures as completion evidence.
    const signature={id:'correlation',signerEmail:'test@example.test',submissionId:10}
    const version={docusealTemplateId:20}
    const response={id:10,template:{id:20},status:'completed',documents:[{url:'https://docuseal.com/file/test.pdf'}],submitters:[{id:30,slug:'abc123',external_id:'correlation',email:'test@example.test',status:'completed',completed_at:'2026-09-22T12:00:00Z'}]}
    assert.equal(verifiedCompletion(response,signature,version).status,'Signed')
    assert.equal(verifiedCompletion({...response,status:'pending'},signature,version).status,'Pending')
    assert.throws(()=>verifiedCompletion({...response,template:{id:21}},signature,version))
    assert.throws(()=>verifiedCompletion(response,{...signature,signerEmail:'other@example.test'},version))
    assert.equal(verifiedCompletion({...response,documents:[{url:'https://evil.example/doc.pdf'}]},signature,version).documentUrl,null)
    const axios=require('axios'),originalAdapter=axios.defaults.adapter
    const oldEnabled=process.env.DOCUSEAL_ENABLED,oldKey=process.env.DOCUSEAL_API_KEY
    const calls=[]
    try {
      process.env.DOCUSEAL_ENABLED='true';process.env.DOCUSEAL_API_KEY='offline-mock-key'
      axios.defaults.adapter=async config=>{
        calls.push(config)
        assert.equal(config.headers['X-Auth-Token'],'offline-mock-key')
        let data
        if(config.url.endsWith('/templates/20'))data={submitters:[{name:'Member'}]}
        else if(config.url.endsWith('/submissions')&&config.method==='post'){
          const body=JSON.parse(config.data);assert.equal(body.send_email,false);assert.equal(body.send_sms,false)
          assert.equal(body.submitters[0].external_id,'correlation');assert.equal(body.submitters[0].email,'test@example.test')
          data=[{id:30,submission_id:10,slug:'abc123'}]
        }else if(config.url.includes('/submitters?external_id='))data={data:[{submission_id:10}]}
        else if(config.url.endsWith('/submissions/10'))data=response
        else throw Error('Unexpected outbound request')
        return {data,status:200,statusText:'OK',headers:{},config}
      }
      await validateTemplate(20,'Member')
      assert.equal((await createSigning({...version,signerRole:'Member'},{...signature,signerName:'Test'})).id,30)
      assert.equal((await retrieveSigning({...signature,submissionId:null})).id,10)
      assert.equal(calls.filter(c=>c.method==='post').length,1,'Recovery must not create a duplicate request')
    }finally{
      axios.defaults.adapter=originalAdapter
      if(oldEnabled===undefined)delete process.env.DOCUSEAL_ENABLED;else process.env.DOCUSEAL_ENABLED=oldEnabled
      if(oldKey===undefined)delete process.env.DOCUSEAL_API_KEY;else process.env.DOCUSEAL_API_KEY=oldKey
    }
    console.log('PASS: member data isolation, staff restrictions, contact validation, email change/login, removed notification settings, versioned waivers, concurrent signing, audit preservation, compliance, archive/restore, and verified DocuSeal completion.')
  }finally{
    for(const memberId of [id,other])for(const entity of [WaiverSignature,StaffNote,OperationsAudit,BillingCharge,MemberPlan])await db.manager.delete(entity,{memberId})
    for(const waiverId of waiverIds){await db.manager.delete(WaiverSignature,{waiverId});await db.manager.delete(WaiverVersion,{waiverId});await db.manager.delete(Waiver,{id:waiverId});await db.manager.createQueryBuilder().delete().from(OperationsAudit).where('detail LIKE :id',{id:`%${waiverId}%`}).execute()}
    await db.manager.delete(Member,[id,other]);await db.destroy()
  }
}
main().catch(e=>{console.error(e);process.exitCode=1})
