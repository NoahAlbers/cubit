const assert=require('assert/strict');
module.exports=async({base,db,staff,member})=>{
 const config=require('../src/dev/config').localConfig,{jwtHelper}=require('../src/api/common/jwtHelper');
 const source=require('../src/parallel/integrated-snapshot');
 const old={mode:config.runtimeMode,enabled:process.env.PARALLEL_ENABLED,integrated:process.env.PARALLEL_INTEGRATED,reader:source.integratedSnapshot};
 const fixture=require('./parallel-snapshots.cjs').fixture(new Date().toISOString().replace('T',' ').slice(0,19));
 const t=fixture.tables,oldId=t.member[0].id;
 for(const rows of Object.values(t))for(const row of rows){if(row.memberId===oldId)row.memberId=member.id;}
 t.member_key.push({id:'disabled-key',memberId:member.id,serialNumber:'0000ABCD',status:'Inactive'});
 t.member[0].id=member.id;t.member[0].status='Inactive';t.member[0].balance=999;
 const snapshot={id:'a'.repeat(64),sourceTime:new Date().toISOString(),ready:true,stale:false,counts:fixture.counts};
 const data=source.assembleSnapshot(t,snapshot,60);
 const token=()=>jwtHelper.GenerateJWT(staff);
 const get=async(path,method='GET',body,extra={},auth=token())=>{const r=await fetch(base+path,{method,headers:{Accept:'application/json',...(auth?{Authorization:'Bearer '+auth}:{}),'X-Cubit-Snapshot':snapshot.id,...extra,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const text=await r.text();let value;try{value=JSON.parse(text)}catch{value=text}return {status:r.status,data:value,headers:r.headers};};
 const fingerprint=async()=>JSON.stringify(await db.query('SELECT id,email,status,balance FROM member ORDER BY id'))+'|'+JSON.stringify(await db.query('SELECT * FROM billing_charge ORDER BY id'));
 try{
  config.runtimeMode='hosted-review';process.env.PARALLEL_ENABLED='true';process.env.PARALLEL_INTEGRATED='true';
  source.integratedSnapshot=async expected=>{if(expected!==snapshot.id)throw Object.assign(Error('Expired snapshot'),{status:409});return data;};
  const before=await fingerprint();
  assert.equal((await get('/api/cubit/members','GET',null,{},null)).status,401);
  assert.equal((await get('/api/cubit/members','GET',null,{},jwtHelper.GenerateJWT(member))).status,403);
  const list=await get('/api/cubit/members?q=demo');assert.equal(list.status,200);assert.equal(list.data.total,1);assert.equal(list.data.rows[0].email,'demo@example.test');assert.equal(list.data.rows[0].status,'Inactive');assert.equal(list.data.rows[0].sourceBalance,999);assert.equal(list.data.rows[0].balance,999);
  const profile=await get('/member/'+member.id);assert.equal(profile.data.email,'demo@example.test');
  const billing=await get('/api/cubit/members/'+member.id+'/billing');assert.equal(billing.data.estimated,true);assert.equal(billing.data.sourceBalance,999);assert.ok(billing.data.charges.every(c=>c.id.startsWith('estimate:')));
  for(const path of ['/member/plans/'+member.id,'/key/memberActivity/'+member.id,'/transaction/memberTransactions/'+member.id,'/accessLog/events?period=all','/api/cubit/reports?from=2026-08-01&to=2026-09-01','/api/cubit/plan-catalog','/api/cubit/automation'])assert.equal((await get(path)).status,200,path);
  assert.equal((await get('/key/memberActivity/'+member.id)).data.keys[0].lastUsed,null,'Do not attribute member scans to a specific key');
  const report=(await get('/api/cubit/reports?from=2026-08-01&to=2026-09-01')).data;assert.equal(report.summary.netPayments,60);assert.equal(report.summary.active,0);assert.equal(report.summary.checkins,1);
  for(const path of ['/member','/plan/memberplan','/key','/transaction','/api/cubit/automation/run','/api/cubit/automation/settings','/api/cubit/members/'+member.id+'/notes','/api/account/members/'+member.id+'/link','/api/waivers/versions','/api/portal/profile'])for(const method of ['POST','PUT','PATCH','DELETE'])assert.equal((await get(path,method,{preview:true})).status,403,path+' '+method);
  for(const path of ['/member/refreshStatus','/api/cubit/unknown-new-route','/api/cubit/payment-matching','/api/cubit/audit','/api/waivers','/api/portal'])assert.equal((await get(path)).status,409,path);
  assert.equal((await get('/api/cubit/members','GET',null,{'X-Cubit-Snapshot':''})).status,428);
  assert.equal((await get('/api/cubit/members','GET',null,{'X-Cubit-Snapshot':'b'.repeat(64)})).status,409);
  assert.equal((await get('/api/cubit/members','GET',null,{'X-Cubit-Workspace':'typo'})).status,400);
  assert.equal(await fingerprint(),before,'Parallel GETs and blocked writes leave review business rows unchanged');
  const review=await get('/member/'+member.id,'GET',null,{'X-Cubit-Workspace':'review'});assert.equal(review.data.email,member.email,'Explicit review remains a separate dataset');
  if(process.env.CUBIT_BROWSER_TESTS==='yes') await require('./parallel-integrated-browser.cjs')({base,token:token(),member,snapshot});
  process.env.PARALLEL_REQUIRED='true';assert.equal((await get('/member/'+member.id,'GET',null,{'X-Cubit-Workspace':'review'})).status,403);delete process.env.PARALLEL_REQUIRED;
  config.runtimeMode='hosted-demo';assert.equal((await get('/member/'+member.id,'GET',null,{'X-Cubit-Workspace':'parallel'})).status,503,'Demo never substitutes or exposes source data');
  console.log('PASS: integrated snapshot contracts, source/review isolation, all mutation methods denied, side-effect GET blocked, pinned generations, reports and missing-key attribution.');
 }finally{config.runtimeMode=old.mode;source.integratedSnapshot=old.reader;for(const [key,value]of [['PARALLEL_ENABLED',old.enabled],['PARALLEL_INTEGRATED',old.integrated]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
};
