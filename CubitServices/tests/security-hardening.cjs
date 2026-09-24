const assert=require('assert/strict'),{EventEmitter}=require('events'),{performance}=require('perf_hooks');
Object.assign(process.env,{CUBIT_MODE:'hosted-review',LOCAL_DEVELOPMENT:'false',DATABASE_URI:'127.0.0.1',DATABASE_NAME:'cubit_review',DATABASE_USERNAME:'cubit_app',DATABASE_PASSWORD:'test-only',JWT_SECRET:'x'.repeat(48),HOST:'127.0.0.1'});
require('ts-node/register');
const {AppDataSource}=require('../src/app'),{loginLimit}=require('../src/api/common/login-limit'),{Member}=require('../src/entity/member');
const express=require('express'),bcrypt=require('bcrypt');
async function main(){
 let time=0;const limiter=loginLimit(()=>time,2);
 const attempt=(ip,email,status=401)=>{const res=new EventEmitter();res.statusCode=status;res.setHeader=()=>{};res.status=n=>{res.statusCode=n;return res};res.json=()=>{};let passed=false;limiter({ip,body:{email}},res,()=>{passed=true;res.emit('finish')});return {passed,status:res.statusCode}};
 assert.ok(attempt('a','one@example.test').passed);assert.ok(attempt('b','two@example.test').passed);assert.ok(attempt('c','three@example.test').passed,'Full IP/account maps evict, not globally deny');
 for(let i=0;i<10;i++)assert.ok(attempt('ip'+i,'target@example.test').passed);
 assert.equal(attempt('new-ip','target@example.test').status,429,'Account cooldown applies across IPs');
 time=5*60*1000;assert.ok(attempt('other','target@example.test',200).passed);
 const app=express();app.use(express.json());app.use((req,res,next)=>{req.member={id:'staff',email:'staff@example.test'};next()});app.use('/member',require('../src/api/routes/member'));app.use((err,req,res,next)=>res.status(err.status||500).json({message:err.status?err.message:'The request could not be completed.'}));
 let lookups=0;AppDataSource.manager.findOneBy=async()=>{lookups++;throw Error('private database detail')};
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{for(const [method,body]of [['PUT',{}],['PUT',{id:null}],['PUT',{id:123}],['PUT',{id:'member',role:'superuser'}],['PUT',{id:'member',picture:{url:'x'}}],['PUT',{id:'member',unexpected:true}],['POST',{id:'existing'}],['POST',{id:'New',firstName:'A',lastName:'B',email:'a@example.test',accessHold:true}]]){
  const response=await fetch(`http://127.0.0.1:${server.address().port}/member`,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(response.status,400,JSON.stringify(body));assert.doesNotMatch(await response.text(),/private database/);
 }assert.equal(lookups,0,'Invalid input is rejected before any identity lookup');}finally{await new Promise(r=>server.close(r))}
 const hash=await bcrypt.hash('correct-test-password',10),timings=[];
 for(const member of [null,{password:'Not Set'},{password:hash}]){const samples=[];AppDataSource.manager.find=async()=>member?[member]:[];for(let i=0;i<3;i++){const start=performance.now();await assert.rejects(new Member().GetMemberByEmailAndPass('a@example.test','wrong-test-password'));samples.push(performance.now()-start)}timings.push(samples.sort((a,b)=>a-b)[1])}
 AppDataSource.manager.find=async()=>[{password:hash},{password:hash}];await assert.rejects(new Member().GetMemberByEmailAndPass('a@example.test','correct-test-password'),'Ambiguous identity must not authenticate');
 assert.ok(Math.max(...timings)-Math.min(...timings)<50,`Failure timing spread: ${timings.map(Math.round)}`);
 console.log('PASS: rejected invalid member IDs/roles/unknown fields before lookup, bounded IP eviction, per-account cooldown, and comparable login failure timing. No database connected.');
}
main().catch(e=>{console.error(e);process.exitCode=1});
