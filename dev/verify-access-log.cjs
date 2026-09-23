// Read-only verification against the local imported access history. No member details are printed.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict')
const root=path.resolve(__dirname,'..');process.chdir(path.join(root,'CubitServices'))
require('../CubitServices/node_modules/ts-node/register')
const {localConfig}=require('../CubitServices/src/dev/config')
const {accessLogOptions}=require('../CubitServices/src/billing/access-log-options')
const {AppDataSource:db}=require('../CubitServices/src/app')
assert.equal(localConfig.host,'127.0.0.1');assert.equal(localConfig.dataMode,'imported')
const credentials=JSON.parse(fs.readFileSync(path.join(root,'.private/imports/local-access.json')))
function request(route,token,body){return new Promise((resolve,reject)=>{
 const data=body?JSON.stringify(body):undefined,start=performance.now()
 const req=http.request({host:'127.0.0.1',port:5001,path:route,method:data?'POST':'GET',headers:{Accept:'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(data?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}:{})}},res=>{
  let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(text),bytes:Buffer.byteLength(text),ms:Math.round(performance.now()-start)}))
 });req.setTimeout(10000,()=>req.destroy(Error('Local access log timed out')));req.on('error',reject);req.end(data)
})}
async function main(){
 const defaults=accessLogOptions({page:-2,pageSize:100000,sort:'bad',period:'bad'})
 assert.equal(defaults.page,1);assert.equal(defaults.pageSize,20);assert.equal(defaults.period,'30');assert.equal(defaults.sort,'timestamp')
 assert.equal(accessLogOptions({period:'all'}).since,null)
 const health=await request('/health');assert.equal(health.body.dataMode,'imported')
 assert.equal((await request('/accessLog/events?period=all')).status,401)
 const login=await request('/login',null,credentials.staff);assert.equal(login.status,200);const token=login.body.token
 await db.initialize()
 try{
  const [{total}]=await db.query('SELECT COUNT(*) AS total FROM access_log')
  const all=await request('/accessLog/events?period=all',token);assert.equal(all.status,200);assert.equal(all.body.total,Number(total));assert.equal(all.body.rows.length,20)
  const second=await request('/accessLog/events?period=all&page=2',token)
  assert.ok(second.body.rows.every(r=>!all.body.rows.some(a=>a.id===r.id)))
  const last=await request('/accessLog/events?period=all&page=1000000000',token);assert.equal(last.body.page,last.body.pages)
  assert.ok(last.body.rows.some(r=>Date.parse(r.timestamp)<Date.now()-365*86400000))
  const oldest=await request('/accessLog/events?period=all&order=asc',token)
  assert.ok(oldest.body.rows.every((r,i,a)=>!i||r.timestamp>=a[i-1].timestamp))
  const periods=[]
  for(const period of ['30','90','180','365']){
   const r=await request('/accessLog/events?period='+period,token);assert.equal(r.status,200)
   const [{expected}]=await db.query('SELECT COUNT(*) AS expected FROM access_log WHERE timestamp >= ?', [accessLogOptions({period}).since])
   assert.equal(r.body.total,Number(expected));assert.ok(r.body.rows.length<=20);periods.push({period,events:r.body.total,ms:r.ms})
  }
  for(const result of ['granted','denied']){
   const r=await request('/accessLog/events?period=all&result='+result+'&sort=name&order=asc&pageSize=100',token)
   const [{expected}]=await db.query('SELECT COUNT(*) AS expected FROM access_log WHERE COALESCE(accessGranted,0) = ?', [result==='granted'?1:0])
   assert.equal(r.body.total,Number(expected));assert.ok(r.body.rows.every(e=>Boolean(e.accessGranted)===(result==='granted')))
  }
  const email=all.body.rows.find(r=>r.member?.email)?.member.email;assert.ok(email)
  const search=await request('/accessLog/events?period=all&search='+encodeURIComponent(email),token)
  assert.ok(search.body.total>0);assert.ok(search.body.rows.every(r=>[r.member?.firstName,r.member?.lastName,r.member?.email,r.message].join(' ').toLowerCase().includes(email.toLowerCase())))
  const literal=await request('/accessLog/events?period=all&search=%25',token)
  assert.ok(literal.body.rows.every(r=>[r.member?.firstName,r.member?.lastName,r.member?.email,r.message].join(' ').includes('%')))
  console.log(JSON.stringify({result:'PASS: authentication, periods, totals, search, literal wildcard, result filters, ordering, non-overlapping pages and oldest history',allHistory:{events:total,rows:all.body.rows.length,bytes:all.bytes,ms:all.ms},periods}))
 }finally{await db.destroy()}
}
main().catch(e=>{console.error(e.message);process.exitCode=1})
