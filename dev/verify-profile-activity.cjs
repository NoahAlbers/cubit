// Local-only checks. Synthetic key/log records are always rolled back.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict'),crypto=require('crypto')
const root=path.resolve(__dirname,'..');process.chdir(path.join(root,'TonicServices'))
require('../TonicServices/node_modules/ts-node/register')
const {localConfig}=require('../TonicServices/src/dev/config')
assert.equal(localConfig.host,'127.0.0.1');assert.equal(localConfig.dataMode,'imported')
const {AppDataSource:db}=require('../TonicServices/src/app')
const {memberActivity}=require('../TonicServices/src/billing/member-activity')
const {AccessLog}=require('../TonicServices/src/entity/accessLog')
const {MemberKey}=require('../TonicServices/src/entity/memberKey')
const credentials=JSON.parse(fs.readFileSync(path.join(root,'.private/imports/local-access.json')))
function request(route,token,body){return new Promise((resolve,reject)=>{
 const data=body?JSON.stringify(body):undefined
 const req=http.request({host:'127.0.0.1',port:5001,path:route,method:data?'POST':'GET',headers:{Accept:'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(data?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}:{})}},res=>{
  let text='';res.on('data',c=>text+=c);res.on('end',()=>{try{resolve({status:res.statusCode,body:JSON.parse(text)})}catch(e){reject(e)}})
 });req.setTimeout(10000,()=>req.destroy(Error('Local request timed out')));req.on('error',reject);req.end(data)
})}
async function main(){
 await db.initialize()
 try{
  const login=await request('/login',null,credentials.staff);assert.equal(login.status,200)
  const route='/key/memberActivity/'+credentials.staff.id
  const response=await request(route,login.body.token);assert.equal(response.status,200)
  const expected=await memberActivity(db.manager,credentials.staff.id)
  assert.deepEqual(response.body,JSON.parse(JSON.stringify(expected)))
  const memberLogin=await request('/login',null,credentials.member)
  assert.equal((await request(route,memberLogin.body.token)).status,403)
  const runner=db.createQueryRunner();await runner.connect();await runner.startTransaction()
  try{
   const memberId=credentials.staff.id,keyA=crypto.randomUUID(),keyB=crypto.randomUUID(),keyC=crypto.randomUUID()
   for(const id of [keyA,keyB,keyC])await runner.manager.insert(MemberKey,{id,memberId,serialNumber:'TEST-'+id,status:'Inactive'})
   const now=new Date('2090-01-15T12:00:00Z')
   const add=(memberKeyId,timestamp,accessGranted=true)=>runner.manager.insert(AccessLog,{id:crypto.randomUUID(),member:{id:memberId},memberKeyId,timestamp:new Date(timestamp),accessGranted,message:'Temporary rollback-only activity verification'})
   await add(keyA,'2090-01-10T12:00:00Z');await add(keyA,'2090-01-14T12:00:00Z',false)
   await add(keyB,'2090-01-11T12:00:00Z');await add(keyB,'2090-01-16T12:00:00Z')
   await add(null,'2090-01-12T12:00:00Z')
   const result=await memberActivity(runner.manager,memberId,now)
   assert.equal(result.lastEntry,'2090-01-12T12:00:00.000Z','Legacy member-level entries count without attributing them to a key')
   assert.equal(result.keys.find(k=>k.id===keyA).lastUsed,'2090-01-10T12:00:00.000Z','Denied attempts do not count as entry')
   assert.equal(result.keys.find(k=>k.id===keyB).lastUsed,'2090-01-11T12:00:00.000Z','Future timestamps are excluded')
   assert.equal(result.keys.find(k=>k.id===keyC).lastUsed,null,'A key with no recorded usage stays unknown')
  }finally{await runner.rollbackTransaction();await runner.release()}
  console.log('PASS: authenticated activity API, staff access boundary, per-key attribution, legacy history, denied/future exclusions. Test records rolled back.')
 }finally{await db.destroy()}
}
main().catch(e=>{console.error(e.message);process.exitCode=1})
