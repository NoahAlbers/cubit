// Read-oriented integration checks for the real-data LOCAL review copy.
// Never posts payments, changes contact details, signs waivers or contacts providers.
const fs=require('fs'),path=require('path'),zlib=require('zlib'),assert=require('assert/strict'),http=require('http')
const mysql=require('../CubitServices/node_modules/mysql2/promise')
const root=path.resolve(__dirname,'..'),dir=path.join(root,'.private/imports')
const source=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir,'tonic-current-data.json.gz'))))
const credentials=JSON.parse(fs.readFileSync(path.join(dir,'local-access.json')))
const settings=JSON.parse(fs.readFileSync(path.join(root,'.private/native/settings.json'),'utf8').replace(/^\uFEFF/,''))
const cents=value=>Math.round(Number(value||0)*100)
async function request(route,token,body){return new Promise((resolve,reject)=>{
  const data=body?JSON.stringify(body):undefined
  const req=http.request({host:'127.0.0.1',port:5001,path:route,method:data?'POST':'GET',headers:{Accept:'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(data?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}:{})}},res=>{
    let text='';res.setEncoding('utf8');res.on('data',chunk=>text+=chunk);res.on('end',()=>resolve({status:res.statusCode,json:()=>JSON.parse(text)}))
  });req.setTimeout(30000,()=>req.destroy(Error('Local API timeout')));req.on('error',reject);req.end(data)
})}
async function main(){
  const health=await request('/health');assert.equal(health.status,200);assert.equal(health.json().dataMode,'imported')
  const staffLogin=await request('/login',null,credentials.staff);assert.equal(staffLogin.status,200)
  const memberLogin=await request('/login',null,credentials.member);assert.equal(memberLogin.status,200)
  const staff=staffLogin.json().token,member=memberLogin.json().token
  assert.equal(staffLogin.json().member.role,'admin');assert.equal(memberLogin.json().member.role,'member')
  const get=async(route,token=staff)=>{const r=await request(route,token);assert.equal(r.status,200,route);return r.json()}
  const started=Date.now(),roster=await get('/api/cubit/members?pageSize=100')
  assert.equal(roster.total,source.counts.member);assert.equal(roster.summary.active,175)
  const directoryMs=Date.now()-started
  const search=await get('/api/cubit/members?field=email&q='+encodeURIComponent(credentials.member.email))
  assert.ok(search.rows.some(m=>m.id===credentials.member.id))
  const portal=await get('/api/portal',member)
  assert.equal(portal.profile.email,credentials.member.email)
  assert.ok(!('preferences'in portal)&&!('password'in portal.profile))
  assert.equal(portal.waivers.history.length,0);assert.equal(portal.waivers.current.length,0)
  const payments=source.tables.transaction.filter(p=>p.memberId===credentials.member.id)
  assert.equal(portal.billing.payments.length,payments.filter(p=>Number(p.amount)!==0).length)
  const bill=await get('/api/cubit/members/'+credentials.member.id+'/billing')
  assert.equal(bill.payments.reduce((n,p)=>n+cents(p.amount),0),payments.reduce((n,p)=>n+cents(p.amount),0))
  assert.equal((await request('/api/cubit/reports',member)).status,403)
  assert.equal((await request('/api/cubit/members/'+credentials.staff.id+'/billing',member)).status,403)
  const report=await get('/api/cubit/reports');assert.equal(report.summary.members,542);assert.equal(report.summary.active,175)
  assert.equal(report.months.at(-1).activeMembers,175)
  const automation=await get('/api/cubit/automation');assert.equal(automation.imported,true);assert.equal(automation.settings.dailyEnabled,false)
  assert.equal(automation.runs.length,0);assert.equal(automation.events.length,0)
  const waivers=await get('/api/waivers');assert.equal(waivers.docusealConnected,false);assert.equal(waivers.waivers.length,0)
  assert.equal((await request('/paypal/update')).status,403)
  assert.equal((await request('/login',null,{email:'admin@example.test',password:'LocalDemoOnly!2026'})).status,401)
  const db=await mysql.createConnection({host:'127.0.0.1',port:3307,user:'root',password:settings.rootPassword,dateStrings:true})
  try{
    const [[server]]=await db.query('SELECT @@datadir AS dir');assert.equal(path.resolve(server.dir).toLowerCase(),path.join(root,'.private/native/mysql-data').toLowerCase())
    for(const [src,target]of Object.entries({member:'member',plan:'plan',member_plan:'member_plan',transaction:'transaction',member_key:'memberkey',access_log:'access_log'})){
      const [[count]]=await db.query('SELECT COUNT(*) AS n FROM toniclocalreview.`'+target+'`');assert.equal(count.n,source.counts[src])
    }
    const [[total]]=await db.query('SELECT SUM(amount) AS n FROM toniclocalreview.transaction');assert.equal(cents(total.n),source.tables.transaction.reduce((n,p)=>n+cents(p.amount),0))
    const [[unassigned]]=await db.query('SELECT COUNT(*) AS n,SUM(amount) AS amount FROM toniclocalreview.transaction WHERE memberId IS NULL');assert.equal(unassigned.n,28);assert.equal(cents(unassigned.amount),120000)
    const [[fake]]=await db.query("SELECT COUNT(*) AS n FROM toniclocalreview.member WHERE id LIKE '20000000-0000-4000-8000-%'");assert.equal(fake.n,0)
    const [[demo]]=await db.query('SELECT COUNT(*) AS n FROM toniclocaldev.member');assert.equal(demo.n,75)
    const [[hashes]]=await db.query("SELECT COUNT(*) AS n FROM toniclocalreview.member WHERE password != 'Not Set'");assert.equal(hashes.n,2)
    const [keys]=await db.query('SELECT id,serialNumber,status FROM toniclocalreview.memberkey');const keyMap=new Map(keys.map(k=>[k.id,k]));for(const k of source.tables.member_key){assert.equal(keyMap.get(k.id).serialNumber,k.serialNumber);assert.equal(keyMap.get(k.id).status,k.status)}
    const [[signatures]]=await db.query('SELECT COUNT(*) AS n FROM toniclocalreview.waiver_signature');assert.equal(signatures.n,0)
  }finally{await db.end()}
  console.log('PASS: imported record counts and payment totals, unchanged keys, no fake members/signatures, preserved demo database, staff/member login, search, billing, portal isolation, reports, paused scheduling and disconnected integrations. Directory load: '+directoryMs+' ms.')
}
main().catch(e=>{console.error(e.code||e.message);process.exitCode=1})
