const assert=require('node:assert/strict');
module.exports=async({request,staffToken,memberToken})=>{
 const {capacityStatus,systemHealth}=require('../src/system/health');
 assert.equal(capacityStatus(84.9),'ok');assert.equal(capacityStatus(85),'warning');assert.equal(capacityStatus(95),'critical');
 assert.equal((await request('/api/system-health',null,'GET',null)).status,401);
 assert.equal((await request('/api/system-health',null,'GET',memberToken)).status,403);
 const demo=await request('/api/system-health',null,'GET',staffToken);
 assert.equal(demo.status,200);assert.equal(demo.data.demo,true);assert.deepEqual(demo.data.checks,[]);
 const {localConfig}=require('../src/dev/config'),mode=localConfig.runtimeMode;
 try {localConfig.runtimeMode='local';const live=await systemHealth();assert.ok(live.checks.some(c=>c.name==='Database'&&c.status==='ok'));assert.ok(live.checks.some(c=>c.name==='Server storage'));assert.equal(await systemHealth(),live,'Repeated reads use the cached snapshot');}
 finally{localConfig.runtimeMode=mode;}
 assert.deepEqual((await systemHealth()).checks,[],'Demo must not inherit the cached real-server snapshot');
 console.log('PASS: staff-only health, capacity thresholds, cached diagnostics and demo isolation.');
};
