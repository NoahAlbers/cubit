// Local imported-data checks for the audit changes. No production connection or member details printed.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict')
const root=path.resolve(__dirname,'..');process.chdir(path.join(root,'TonicServices'))
require('../TonicServices/node_modules/ts-node/register')
const {localConfig}=require('../TonicServices/src/dev/config')
assert.equal(localConfig.host,'127.0.0.1');assert.equal(localConfig.dataMode,'imported')
const {AppDataSource:db}=require('../TonicServices/src/app')
const credentials=JSON.parse(fs.readFileSync(path.join(root,'.private/imports/local-access.json')))
function request(route,token,body){return new Promise((resolve,reject)=>{
 const data=body?JSON.stringify(body):undefined
 const req=http.request({host:'127.0.0.1',port:5001,path:route,method:data?'POST':'GET',headers:{Accept:'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(data?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}:{})}},res=>{
  let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(text)}))
 });req.setTimeout(10000,()=>req.destroy(Error('Local request timed out')));req.on('error',reject);req.end(data)
})}
async function main(){
 await db.initialize()
 try{
  for(const role of ['staff','member']){
   const login=await request('/login',null,credentials[role]);assert.equal(login.status,200)
   const portal=await request('/api/portal',login.body.token);assert.equal(portal.status,200)
   const [{keys}]=await db.query("SELECT COUNT(*) AS `keys` FROM memberkey WHERE memberId=? AND status='Active'",[credentials[role].id])
   assert.equal(portal.body.enabledKeys,Number(keys));assert.equal(portal.body.entryAllowed,portal.body.status==='Active'&&Number(keys)>0)
   if(role==='member')assert.equal((await request('/accessLog/events',login.body.token)).status,403)
  }
  if(process.argv.includes('--cleanup-fixture')){
   // Only the disposable contact created by the browser verification in this audit.
   const id='1d3063d8-effe-f068-be6a-24c4a27e4248',email='cubit-ux-audit-20260923@example.test'
   await db.transaction(async manager=>{
    const rows=await manager.query('SELECT phone, firstName, lastName FROM member WHERE id=? AND email=?',[id,email]);assert.equal(rows.length,1)
    assert.equal(rows[0].firstName,'Cubit UX');assert.equal(rows[0].lastName,'Temporary Fixture');assert.equal(rows[0].phone,'555-0103','Browser save-and-leave persisted the contact update')
    for(const metadata of db.entityMetadatas){
     const column=metadata.columns.find(c=>c.databaseName==='memberId');if(!column)continue
     const [{n}]=await manager.query('SELECT COUNT(*) AS n FROM `'+metadata.tableName+'` WHERE `memberId`=?',[id]);assert.equal(Number(n),0,'Fixture must have no related operational records before removal')
    }
    const result=await manager.query('DELETE FROM member WHERE id=? AND email=?',[id,email]);assert.equal(result.affectedRows,1)
   })
   console.log('PASS: temporary browser fixture contact changes persisted; fixture removed with no related records.')
  }
  console.log('PASS: staff/member portal eligibility agrees with enabled keys; member cannot access the staff log.')
 }finally{await db.destroy()}
}
main().catch(e=>{console.error(e.message);process.exitCode=1})
