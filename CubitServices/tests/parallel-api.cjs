const assert=require('assert/strict');
module.exports=async({request,staff,member})=>{
 const mode=require('../src/dev/config').localConfig,reader=require('../src/parallel/reader'),{jwtHelper}=require('../src/api/common/jwtHelper');
 const previous={mode:mode.runtimeMode,enabled:process.env.PARALLEL_ENABLED,member:reader.parallelMember,read:reader.readParallel};
 const source={snapshot:{sourceTime:new Date().toISOString(),stale:false},member:{id:'source-member',firstName:'Synthetic',lastName:'Mirror'},memberships:[{id:'source-membership',memberId:'source-member',startDate:'2026-01-01',plan:{name:'Standard',monthlyCost:60}}],keys:[],payments:[],events:[]};
 try{
  process.env.PARALLEL_ENABLED='true';
  assert.equal((await request('/api/parallel/status',null,'GET',jwtHelper.GenerateJWT(staff))).status,403,'Synthetic demo cannot see mirror');
  mode.runtimeMode='hosted-review';
  const token=jwtHelper.GenerateJWT(staff),memberToken=jwtHelper.GenerateJWT(member);
  reader.parallelMember=async id=>{if(id!=='source-member')throw Object.assign(Error('Not found'),{status:404});return source;};
  assert.equal((await request('/api/parallel/members/source-member',null,'GET',null)).status,401);
  assert.equal((await request('/api/parallel/members/source-member',null,'GET',memberToken)).status,403);
  assert.equal((await request('/api/parallel/members/source-member',null,'GET',token)).status,200);
  for(const method of ['POST','PUT','PATCH','DELETE'])assert.equal((await request('/api/parallel/records',{unsafe:true},method,token)).status,403);
  for(const method of ['POST','PUT','PATCH','DELETE'])assert.equal((await request('/api/parallel/subscription-links/source-membership',{memberId:'source-member',subscriptionId:'I-SYNTHETIC123',confirmed:true},method,token)).status,403,'Retired manual subscription endpoint must reject all writes');
  const detail=await request('/api/parallel/members/source-member',null,'GET',token);assert.equal('links' in detail.data,false,'No manual annotations returned');
  console.log('PASS: mirror staff authorization, demo isolation, business-write denial, retired subscription endpoint denial.');
 }finally{mode.runtimeMode=previous.mode;if(previous.enabled===undefined)delete process.env.PARALLEL_ENABLED;else process.env.PARALLEL_ENABLED=previous.enabled;reader.parallelMember=previous.member;reader.readParallel=previous.read;}
};
