// Run only against an EMPTY disposable cubit_demo schema. No imported DB allowed.
const assert=require('assert/strict'),{randomUUID}=require('crypto');
if(process.env.CUBIT_TEST_EMPTY_DATABASE!=='yes'||process.env.CUBIT_MODE!=='hosted-demo'||process.env.DATABASE_NAME!=='cubit_demo'||process.env.DATABASE_USERNAME!=='cubit_demo')throw Error('This test requires an explicitly disposable, isolated demo database.');
require('ts-node/register');
const {app,AppDataSource:db}=require('../src/app');
const {Member}=require('../src/entity/member'),{Plan}=require('../src/entity/plan'),{MemberPlan}=require('../src/entity/memberPlan');
const {OperationsSettings,BillingCharge,PaymentEvent,OperationsAudit}=require('../src/entity/cubitOperations');
const {Transaction}=require('../src/entity/transaction');
const {jwtHelper}=require('../src/api/common/jwtHelper');
const {day}=require('../src/billing/ledger');
let server,base,token;
async function request(path,body,method,auth=token){const r=await fetch(base+path,{method:method||(body?'POST':'GET'),headers:{Accept:'application/json',...(auth?{Authorization:'Bearer '+auth}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const text=await r.text();let data;try{data=JSON.parse(text)}catch{data=text}return {status:r.status,data};}
async function ok(path,body,method){const r=await request(path,body,method);assert.ok(r.status>=200&&r.status<300,`${path}: ${r.status} ${JSON.stringify(r.data)}`);return r.data;}
const event=(overrides={})=>({id:'event-'+randomUUID(),resourceId:'capture-'+randomUUID(),kind:'payment',amount:60,eventDate:day(new Date()),payerEmail:'unknown@example.test',...overrides});
const add=e=>ok('/api/cubit/automation/events/simulate',e);
const reconcile=(e,body)=>ok('/api/cubit/automation/events/'+e.id+'/process',body);
const attempt=(e,body)=>request('/api/cubit/automation/events/'+e.id+'/process',body);
async function main(){
 await db.initialize();assert.equal((await db.query('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()')).length,0,'Refusing a nonempty database');
 await db.synchronize();await db.manager.save(OperationsSettings,{id:'default',graceDays:60,dailyEnabled:false});
 const members=[];for(const [firstName,role]of [['Staff','admin'],['Existing','member'],['Another','member'],['Future','member']])members.push(await db.manager.save(Member,db.manager.create(Member,{firstName,lastName:'Fixture',email:firstName.toLowerCase()+'@example.test',paypalEmail:firstName.toLowerCase()+'.billing@example.test',role,password:'Not Set'})));
 const [staff,existing,another,future]=members;token=jwtHelper.GenerateJWT(staff);
 server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});base=`http://127.0.0.1:${server.address().port}`;
 for(const path of ['/api/cubit/plan-catalog','/api/cubit/payment-matching','/api/cubit/matching-members?q=existing']){assert.equal((await request(path,null,'GET',null)).status,401);assert.equal((await request(path,null,'GET',jwtHelper.GenerateJWT(existing))).status,403);}
 let p=await ok('/api/cubit/plan-catalog',{id:randomUUID(),name:'Test Standard',monthlyCost:60,available:true});
 assert.equal((await request('/api/cubit/plan-catalog/'+p.id,{...p,monthlyCost:-5},'PUT')).status,400);
 const start=day(new Date()).slice(0,8)+'01';
 const assignment=await ok('/plan/memberplan',{id:'New',memberId:existing.id,planId:p.id,startDate:start});
 const beforeCharges=JSON.stringify(await db.manager.findBy(BillingCharge,{memberId:existing.id}));
 const legacy=await db.manager.save(MemberPlan,db.manager.create(MemberPlan,{memberId:future.id,planId:p.id,startDate:new Date('2090-01-01T12:00:00Z'),paypalSubscriptionId:'legacy-subscription',paypalSubscriptionPlanId:''}));
 const before={...p};p=await ok('/api/cubit/plan-catalog/'+p.id,{...p,name:'Test Standard Updated',monthlyCost:80},'PUT');
 assert.equal((await request('/plan/memberplan',{id:'New',memberId:staff.id,planId:p.id,startDate:start,catalogRevision:before.revision})).status,409,'Assignment requires the displayed catalog price');
 assert.equal((await request('/api/cubit/plan-catalog/'+p.id,{...before,monthlyCost:90},'PUT')).status,409,'Stale catalog edit');
 assert.equal(JSON.stringify(await db.manager.findBy(BillingCharge,{memberId:existing.id})),beforeCharges,'Posted charges unchanged');
 for(const id of [assignment.id,legacy.id]){const m=await db.manager.findOneByOrFail(MemberPlan,{id});assert.equal(Number(m.billingRate),60);assert.equal(m.billingName,'Test Standard');}
 const newAssignment=await ok('/plan/memberplan',{id:'New',memberId:another.id,planId:p.id,startDate:start});assert.equal(Number(newAssignment.billingRate),80);
 p=await ok('/api/cubit/plan-catalog/'+p.id,{...p,available:false},'PUT');
 assert.equal((await request('/plan/memberplan',{id:'New',memberId:staff.id,planId:p.id,startDate:start})).status,400);
 assert.equal((await db.manager.findOneByOrFail(MemberPlan,{id:assignment.id})).endDate,null);
 p=await ok('/api/cubit/plan-catalog/'+p.id,{...p,available:true},'PUT');assert.equal(p.available,true);
 assert.equal((await ok('/api/cubit/plan-catalog')).history.length,4);
 const counts={members:await db.manager.count(Member),payments:await db.manager.count(Transaction)};
 const unknown=await add(event());assert.equal(await db.manager.count(Member),counts.members);assert.equal(await db.manager.count(Transaction),counts.payments);
 assert.equal((await attempt(unknown,{})).status,400,'No automatic member creation or selection');
 assert.equal((await request('/api/cubit/automation/events/simulate',event({currency:'EUR'}))).status,400);
 const hint=await add(event({payerEmail:' EXISTING.BILLING@example.test ',subscriptionId:'legacy-subscription'}));
 const context=await ok('/api/cubit/payment-matching/'+hint.id);assert.equal(context.candidates.length,2,'Conflicting email/subscription shown, not auto matched');
 assert.equal((await attempt(hint,{})).status,400);
 await reconcile(unknown,{memberId:existing.id});await reconcile(unknown,{memberId:existing.id});assert.equal(await db.manager.count(Transaction),counts.payments+1);
 assert.equal((await attempt(unknown,{memberId:another.id})).status,409,'Cannot reassign processed event');
 const same=await add(event({resourceId:unknown.resourceId}));await reconcile(same,{memberId:existing.id});assert.equal(await db.manager.count(Transaction),counts.payments+1);
 const conflict=await add(event({resourceId:unknown.resourceId,amount:61}));assert.equal((await attempt(conflict,{memberId:existing.id})).status,409);
 const fresh=await add(event({payerEmail:'new.payer@example.test'}));
 assert.equal((await attempt(fresh,{createMember:{firstName:'New',lastName:'Fixture',email:'new.contact@example.test'}})).status,400);
 assert.equal((await attempt(fresh,{createMember:{firstName:'New',lastName:'Fixture',email:existing.email,confirmCreate:true}})).status,409);
 const create={createMember:{firstName:'New',lastName:'Fixture',email:'new.contact@example.test',confirmCreate:true}};
 const created=await reconcile(fresh,create);await reconcile(fresh,create);assert.equal(await db.manager.count(Member),counts.members+1);
 const m=await db.manager.findOneByOrFail(Member,{id:created.memberId});assert.equal(m.paypalEmail,'new.payer@example.test');assert.equal(m.password,'Not Set');assert.equal(await db.manager.countBy(MemberPlan,{memberId:m.id}),0);
 const dupCreate=await add(event({resourceId:fresh.resourceId,payerEmail:'different@example.test'}));assert.equal((await attempt(dupCreate,{createMember:{firstName:'Other',lastName:'Fixture',email:'other@example.test',confirmCreate:true}})).status,409);assert.equal(await db.manager.count(Member),counts.members+1);
 const capture='capture-'+randomUUID(),parallel=await Promise.all([add(event({resourceId:capture})),add(event({resourceId:capture}))]);
 await Promise.all(parallel.map(e=>reconcile(e,{memberId:existing.id})));assert.equal(await db.manager.countBy(Transaction,{requestKey:'paypal:payment:'+capture}),1,'Concurrent capture processed once');
 const race=await Promise.all([add(event({payerEmail:'race@example.test'})),add(event({payerEmail:'race@example.test'}))]);
 const raceResults=await Promise.all(race.map(e=>attempt(e,{createMember:{firstName:'Race',lastName:'Fixture',email:'race@example.test',confirmCreate:true}})));assert.deepEqual(raceResults.map(r=>r.status).sort(),[200,409]);assert.equal(await db.manager.countBy(Member,{email:'race@example.test'}),1);
 assert.equal((await request('/member',{id:another.id,email:'race@example.test'},'PUT')).status,409,'Profile edits cannot claim an existing contact email');
 const bad=await add(event({payerEmail:'rollback@example.test'}));await db.manager.update(PaymentEvent,bad.id,{amount:0});
 assert.equal((await attempt(bad,{createMember:{firstName:'Rollback',lastName:'Fixture',email:'rollback@example.test',confirmCreate:true}})).status,400);assert.equal(await db.manager.countBy(Member,{email:'rollback@example.test'}),0,'Failed payment rolls back member creation');
 const refund=await add(event({kind:'refund',amount:30,parentResourceId:unknown.resourceId}));await reconcile(refund,{memberId:existing.id});
 const excessive=await add(event({kind:'refund',amount:40,parentResourceId:unknown.resourceId}));assert.equal((await attempt(excessive,{memberId:existing.id})).status,400);
 assert.ok(await db.manager.countBy(OperationsAudit,{kind:'Member created from payment'}));
 console.log('PASS: explicit matching, ambiguity, atomic member creation, duplicate/concurrent capture and identity guards, refunds, permissions, catalog changes/retirement/restoration, stale edits and preserved historical/future rates and charges.');
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(server)await new Promise(resolve=>server.close(resolve));if(db.isInitialized)await db.destroy();});
