const assert=require('node:assert/strict');
const {validate,initialize,publish,retain}=require('../../dev/parallel-store.cjs');
function fixture(time='2026-09-01 12:00:00'){
 const tables={member:[{id:'member-1',firstName:'Demo',lastName:'Person',email:'demo@example.test',paypalEmail:'payer@example.test',balance:0,status:'Active'}],plan:[{id:'plan-1',name:'Standard',monthlyCost:60}],member_plan:[{id:'membership-1',memberId:'member-1',planId:'plan-1',startDate:'2026-08-01 12:00:00',endDate:null,paypalSubscriptionId:'',paypalSubscriptionPlanId:''}],transaction:[{id:'payment-1',memberId:'member-1',transactionDate:'2026-08-01 12:00:00',amount:60}],member_key:[{id:'key-1',memberId:'member-1',serialNumber:'FAKEKEY',status:'Active'}],access_log:[{id:'event-1',memberId:'member-1',timestamp:'2026-09-01 11:00:00',message:'Synthetic scan',accessGranted:1}]};
 return {format:'cubit-tonic-export',version:1,source:{snapshotUtc:time,systemTimeZone:'UTC',sessionTimeZone:'SYSTEM'},tables,counts:Object.fromEntries(Object.entries(tables).map(([k,v])=>[k,v.length])),complete:true};
}
const bytes=x=>Buffer.from(JSON.stringify(x));
function unit(){
 assert.equal(validate(bytes(fixture())).totals.paymentCents,6000);
 for(const mutate of [x=>x.complete=false,x=>x.counts.member=9,x=>x.tables.member[0].password='secret',x=>x.tables.member.push(x.tables.member[0]),x=>x.tables.transaction[0].memberId='missing',x=>x.tables.member_plan[0].planId='missing',x=>x.tables.transaction[0].amount='NaN',x=>x.tables.access_log[0].timestamp='2026-02-30 00:00:00',x=>x.source.systemTimeZone='PST']){const x=fixture();mutate(x);assert.throws(()=>validate(bytes(x)));}
 assert.throws(()=>validate(Buffer.from('{"private":"truncated')),/Invalid snapshot JSON/);
 console.log('PASS: snapshot validation rejects incomplete, duplicate, secret-bearing, orphaned and malformed data.');
}
async function database(db){
 await initialize(db);
 const a=fixture(),first=await publish(db,bytes(a));assert.equal(first.status,'Published');
 assert.equal((await publish(db,bytes(a))).status,'Duplicate');
 await assert.rejects(()=>publish(db,bytes(fixture('2026-08-31 12:00:00'))),/Older/);
 const b=fixture('2026-09-01 12:15:00');b.tables.member[0].lastName='Updated';b.tables.transaction=[];b.counts.transaction=0;
 const next=await publish(db,bytes(b));assert.deepEqual(next.changes,{added:0,updated:1,removed:1});
 const [[pointer]]=await db.query('SELECT generation FROM parallel_current');assert.equal(pointer.generation,next.id);
 const [tombstones]=await db.query("SELECT action FROM parallel_change WHERE kind='transaction'");assert.equal(tombstones[0].action,'removed');
 const broken=fixture('2026-09-01 12:30:00');broken.complete=false;await assert.rejects(()=>publish(db,bytes(broken)));
 assert.equal((await db.query('SELECT generation FROM parallel_current'))[0][0].generation,next.id);
 const failing=new Proxy(db,{get(target,key){if(key==='query')return (...args)=>String(args[0]).startsWith('INSERT INTO parallel_record')?Promise.reject(Error('Injected interrupted insert')):target.query(...args);const value=target[key];return typeof value==='function'?value.bind(target):value;}});
 await assert.rejects(()=>publish(failing,bytes(fixture('2026-09-01 12:45:00'))),/Injected/);
 assert.equal((await db.query('SELECT generation FROM parallel_current'))[0][0].generation,next.id);
 assert.equal((await db.query('SELECT COUNT(*) AS n FROM parallel_generation'))[0][0].n,2);
 for(let i=1;i<=3;i++)await publish(db,bytes(fixture('2026-09-02 12:'+String(i*15).padStart(2,'0')+':00')));
 await retain(db);assert.equal((await db.query('SELECT COUNT(*) AS n FROM parallel_generation'))[0][0].n,3);
 assert.equal((await db.query("SELECT COUNT(*) AS n FROM parallel_change WHERE action='removed'"))[0][0].n,1);
 console.log('PASS: atomic publication, retry deduplication, old-batch rejection, changed rows, removal history, last-good preservation and bounded retention.');
}
if(require.main===module)unit();
module.exports={unit,database,fixture,bytes};
