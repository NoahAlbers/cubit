const assert=require('assert/strict'),{randomUUID}=require('crypto');
module.exports=async({request,db})=>{
  const {Member}=require('../src/entity/member'),{Plan}=require('../src/entity/plan'),{MemberPlan}=require('../src/entity/memberPlan'),{MemberKey}=require('../src/entity/memberKey');
  const {day}=require('../src/billing/ledger');
  async function ok(path,body){const r=await request(path,body);assert.equal(r.status,200,`${path}: ${JSON.stringify(r.data)}`);return r.data;}
  let settings=(await ok('/api/cubit/automation')).settings;const original={...settings};
  const p=await db.manager.save(Plan,db.manager.create(Plan,{id:randomUUID(),name:'Grace fixture',monthlyCost:60,available:true}));
  const member=await db.manager.save(Member,db.manager.create(Member,{firstName:'Grace',lastName:'Fixture',email:'grace-fixture@example.test',paypalEmail:'grace-fixture@example.test',role:'member',password:'Not Set'}));
  const start=day(new Date(Date.now()-45*86400000));
  const assignment=await db.manager.save(MemberPlan,db.manager.create(MemberPlan,{id:randomUUID(),memberId:member.id,planId:p.id,startDate:new Date(start+'T12:00:00Z'),billingRate:60,billingName:p.name,paypalSubscriptionId:'',paypalSubscriptionPlanId:''}));
  const keys=await db.manager.save(MemberKey,[db.manager.create(MemberKey,{id:randomUUID(),memberId:member.id,serialNumber:'grace-enabled',status:'Active'}),db.manager.create(MemberKey,{id:randomUUID(),memberId:member.id,serialNumber:'grace-disabled',status:'Inactive'})]);
  const billing=()=>ok('/api/cubit/members/'+member.id+'/billing');
  const set=async days=>{settings=await ok('/api/cubit/automation/settings',{...settings,graceDays:days,dailyEnabled:false});};
  try{
    await set(60);const before=await billing();assert.equal(before.status,'Active');
    await set(0);assert.equal((await billing()).status,'Inactive');
    await set(90);assert.equal((await billing()).status,'Active','Increasing grace restores billing eligibility without a processing run');
    await ok('/api/cubit/members/'+member.id+'/operations',{accessHold:true,reason:'Manual staff block'});
    await set(0);await set(90);assert.equal((await billing()).status,'Inactive','Manual staff block survives grace changes');
    assert.equal((await db.manager.findOneByOrFail(Member,{id:member.id})).accessHold,true);
    await ok('/api/cubit/members/'+member.id+'/operations',{accessHold:false,reason:'Release fixture block'});
    assert.equal((await billing()).status,'Active');
    assert.deepEqual((await db.manager.findBy(MemberKey,{memberId:member.id})).sort((a,b)=>a.serialNumber.localeCompare(b.serialNumber)).map(k=>k.status),['Inactive','Active'],'Grace never changes individual key settings');
    const preview=await ok('/api/cubit/plans/'+assignment.id+'/cutoff',{finalBillingDate:start,reason:'Cancel fixture plan',preview:true,expectedDate:null});assert.ok(preview.after);
    await ok('/api/cubit/plans/'+assignment.id+'/cutoff',{finalBillingDate:start,reason:'Cancel fixture plan',preview:false,expectedDate:null});
    await set(365);assert.equal((await billing()).status,'Canceled','Grace does not reactivate a canceled plan');
  }finally{await set(original.graceDays);}
  console.log('PASS: grace can be disabled, extended and reversed immediately; manual blocks, individually disabled keys and cancellation remain authoritative.');
};
