const assert=require('node:assert/strict');
module.exports=async({db})=>{
 const {mergeHealthBucket,persistHealth,healthHistory}=require('../src/system/history'),{HealthSample}=require('../src/entity/healthSample'),{localConfig}=require('../src/dev/config');
 const snapshot=(at,value,status='ok')=>({checkedAt:at,demo:false,message:'',checks:[{name:'Server storage',value,unit:'% used',status,detail:status}]});
 const now=new Date('2026-09-25T12:55:00Z'),a=snapshot('2026-09-25T12:00:00Z',95,'critical'),b=snapshot('2026-09-25T12:05:00Z',25);
 const merged=mergeHealthBucket(mergeHealthBucket(undefined,a),b);assert.equal(merged.checks[0].status,'critical');assert.equal(merged.checks[0].max,95);assert.equal(merged.checks[0].min,25);assert.equal(merged.count,2);assert.equal(mergeHealthBucket(merged,b),merged);assert.equal(mergeHealthBucket(merged,snapshot('2026-09-25T12:20:00Z',30)).gap,true);
 const mode=localConfig.runtimeMode;
 try{
  localConfig.runtimeMode='local';
  await persistHealth(snapshot('2026-01-01T00:00:00Z',40));await persistHealth(a);await persistHealth(b);await persistHealth(b);
  assert.equal(await db.manager.count(HealthSample),3,'Old data is pruned and duplicate timestamps do not create extra buckets');
  const daily=await healthHistory('24h',now);assert.equal(daily.points.length,2);assert.equal(daily.points[0].count,1);
  const long=await healthHistory('90d',now);assert.equal(long.points.length,1);assert.equal(long.points[0].checks[0].max,95);assert.equal(long.points[0].checks[0].status,'critical');assert.equal(long.points[0].count,2);
  localConfig.runtimeMode='hosted-demo';assert.deepEqual((await healthHistory('90d',now)).points,[]);await persistHealth(snapshot(now.toISOString(),99));assert.equal(await db.manager.count(HealthSample),3);
 }finally{localConfig.runtimeMode=mode;await db.manager.clear(HealthSample);}
 console.log('PASS: health sampling, deduplication, retained peaks/warnings, coverage gaps, retention and demo privacy.');
};
