const assert=require('assert/strict'),{spawnSync}=require('child_process')
Object.assign(process.env,{LOCAL_DEVELOPMENT:'true',DATABASE_URI:'127.0.0.1',DATABASE_NAME:'TonicLocalDev',DATABASE_USERNAME:'tonic_local',DATABASE_PASSWORD:'unit-test-only',JWT_SECRET:'review-unit-key'})
delete process.env.CUBIT_MODE
require('ts-node/register')
const express=require('express'),jwt=require('jsonwebtoken')
const {readHostedDemoConfig}=require('../src/dev/config')
const {demoProxy}=require('../src/demo/proxy')
require('../src/app')
const {jwtHelper}=require('../src/api/common/jwtHelper')
const config={CUBIT_MODE:'hosted-demo',LOCAL_DEVELOPMENT:'false',DATABASE_URI:'127.0.0.1',DATABASE_NAME:'cubit_demo',DATABASE_USERNAME:'cubit_demo',DATABASE_PASSWORD:'demo-unit-password',JWT_SECRET:'d'.repeat(64),HOST:'127.0.0.1',PORT:'5002'}
assert.equal(readHostedDemoConfig(config).dataMode,'demo')
for(const change of [{DATABASE_NAME:'cubit_review'},{DATABASE_USERNAME:'cubit_app'},{HOST:'0.0.0.0'},{DATABASE_URI:'mysql'},{PORT:'5001'},{DOCUSEAL_ENABLED:'true'},{JWT_SECRET:'short'},{LOCAL_DEVELOPMENT:'true'}])assert.throws(()=>readHostedDemoConfig({...config,...change}))
assert.throws(()=>jwtHelper.ValidateJWT(jwt.sign({id:'demo',aud:'cubit-demo'},process.env.JWT_SECRET)), 'Review auth rejects a demo audience even if keys are accidentally reused')
const child=spawnSync(process.execPath,['-r','ts-node/register','-e',`
 const assert=require('assert/strict'),jwt=require('jsonwebtoken');
 require('./src/app');
 const {jwtHelper}=require('./src/api/common/jwtHelper');
 const t=jwtHelper.GenerateJWT({id:'demo-only',email:'test@test.example',role:'admin'});
 assert.equal(jwtHelper.ValidateJWT(t).aud,'cubit-demo');
 assert.throws(()=>jwtHelper.ValidateJWT(jwt.sign({id:'review'},'review-unit-key')));
 assert.throws(()=>jwtHelper.ValidateJWT(jwt.sign({id:'review'},process.env.JWT_SECRET)));
`],{cwd:require('path').resolve(__dirname,'..'),env:{...process.env,...config},encoding:'utf8'})
assert.equal(child.status,0,child.stderr)
const listen=app=>new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))})
const close=s=>new Promise(resolve=>s.close(resolve))
async function main(){
  let reviewCalls=0
  const demo=express();demo.use(express.json())
  demo.post('/login',(req,res)=>res.json({workspace:'synthetic',email:req.body.email}))
  demo.use((req,res,next)=>{try{jwt.verify(req.headers.authorization?.slice(7),config.JWT_SECRET,{audience:'cubit-demo',algorithms:['HS256']});next()}catch{res.status(401).json({message:'Unauthorized'})}})
  demo.get('/reports.csv',(req,res)=>res.type('text/csv').attachment('demo.csv').send('name\nFictional Member\n'))
  demo.post('/upload',express.raw({type:'application/octet-stream'}),(req,res)=>res.type('application/octet-stream').send(req.body))
  demo.use((req,res)=>res.json({workspace:'synthetic',method:req.method,body:req.body}))
  const upstream=await listen(demo)
  const gateway=express();gateway.use(express.json());gateway.use(demoProxy(true,upstream.address().port));gateway.use((req,res)=>{reviewCalls++;res.json({workspace:'review'})})
  const server=await listen(gateway),base=`http://127.0.0.1:${server.address().port}`
  const token=jwt.sign({id:'demo-only',aud:'cubit-demo'},config.JWT_SECRET)
  const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'}
  try{
    let r=await fetch(base+'/login',{method:'POST',headers,body:JSON.stringify({email:' TEST@test.example ',password:'fixture'})});assert.equal((await r.json()).workspace,'synthetic')
    for(const route of ['/api/cubit/members','/member/real-id','/api/portal','/api/waivers','/health','/key']){
      r=await fetch(base+route,{headers});assert.equal((await r.json()).workspace,'synthetic')
    }
    r=await fetch(base+'/api/cubit/members/fake/notes',{method:'POST',headers,body:JSON.stringify({text:'Fictional note'})});assert.deepEqual((await r.json()).body,{text:'Fictional note'})
    r=await fetch(base+'/reports.csv',{headers});assert.match(r.headers.get('content-disposition'),/demo.csv/);assert.match(await r.text(),/Fictional Member/)
    const bytes=Buffer.from([0,255,3,128,7]);r=await fetch(base+'/upload',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/octet-stream'},body:bytes});assert.deepEqual(Buffer.from(await r.arrayBuffer()),bytes)
    r=await fetch(base+'/api/cubit/members',{headers:{Authorization:'Bearer '+token+'bad'}});assert.equal(r.status,401)
    assert.equal(reviewCalls,0,'No demo request reached the review handlers')
    r=await fetch(base+'/login',{method:'POST',headers,body:JSON.stringify({email:'staff@example.test',password:'fixture'})});assert.equal((await r.json()).workspace,'review','Fresh login is routed by identity, not an old token')
    const baseline=reviewCalls
    await close(upstream)
    r=await fetch(base+'/api/cubit/members',{headers});assert.equal(r.status,503);assert.equal(reviewCalls,baseline,'Unavailable demo never falls back to review')
  }finally{await close(server);if(upstream.listening)await close(upstream)}
  const disabled=express();disabled.use(express.json());disabled.use(demoProxy(false));disabled.use((req,res)=>res.sendStatus(599))
  const off=await listen(disabled)
  try{const r=await fetch(`http://127.0.0.1:${off.address().port}/api/cubit/members`,{headers});assert.equal(r.status,503)}finally{await close(off)}
  console.log('PASS: isolated demo configuration, separate session audience/keys, full API/CSV routing, login switching, and fail-closed behavior. No DB connected.')
}
main().catch(e=>{console.error(e);process.exitCode=1})
