const assert=require('assert/strict')
Object.assign(process.env,{LOCAL_DEVELOPMENT:'true',DATABASE_URI:'127.0.0.1',DATABASE_NAME:'TonicLocalDev',DATABASE_USERNAME:'tonic_local',DATABASE_PASSWORD:'test-only',JWT_SECRET:'unit-test-key',WAIVER_PREVIEW_PASSWORD:'fixture-preview'})
require('ts-node/register')
const express=require('express'),jwt=require('jsonwebtoken')
const {sortPlans}=require('../src/billing/plan-order')
const {postedLedger,accessDecision}=require('../src/billing/posted-ledger')
const {unlockWaiverPreview,requireWaiverPreview}=require('../src/waivers/preview')
async function main(){
  const input=[{name:'Legacy Student',monthlyCost:5},{name:'Honorary',monthlyCost:0},{name:'Standard + 1 Key',monthlyCost:90},{name:'Founder',monthlyCost:0},{name:'Standard',monthlyCost:60},{name:'Student',monthlyCost:30}]
  assert.deepEqual(sortPlans(input).map(p=>p.name),['Student','Standard','Standard + 1 Key','Founder','Honorary','Legacy Student'])
  assert.equal(input[0].name,'Legacy Student')
  const ledger=postedLedger([{id:'charge',memberPlanId:'p',dueDate:'2026-09-01',amount:60}],[],[],'2026-09-02')
  const plans=[{startDate:'2026-09-01'}]
  assert.equal(accessDecision({},plans,ledger,0).status,'Inactive')
  assert.equal(accessDecision({},plans,ledger,60).status,'Active')
  const paid=postedLedger([{id:'charge',memberPlanId:'p',dueDate:'2026-09-01',amount:60}],[{transactionDate:'2026-09-02',amount:60}],[],'2026-09-02')
  assert.equal(accessDecision({},plans,paid,0).status,'Active')
  assert.equal(accessDecision({accessHold:true},plans,paid,0).status,'Inactive')
  const app=express();app.use(express.json());app.use((req,res,next)=>{req.member={id:req.headers['test-member']||'staff-one'};next()})
  app.post('/unlock',unlockWaiverPreview);app.get('/preview',requireWaiverPreview,(req,res)=>res.json({ok:true}))
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))})
  const base=`http://127.0.0.1:${server.address().port}`
  try{
    assert.equal((await fetch(base+'/preview')).status,403)
    const unlock=password=>fetch(base+'/unlock',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})})
    assert.equal((await unlock('wrong')).status,403)
    assert.equal((await unlock({bad:true})).status,403)
    const result=await unlock('fixture-preview');assert.equal(result.status,200);const {token}=await result.json()
    assert.throws(()=>jwt.verify(token,process.env.JWT_SECRET),'Preview token cannot be used as a login token')
    assert.equal((await fetch(base+'/preview',{headers:{'X-Cubit-Waiver-Preview':token}})).status,200)
    assert.equal((await fetch(base+'/preview',{headers:{'X-Cubit-Waiver-Preview':token,'test-member':'staff-two'}})).status,403)
    assert.equal((await fetch(base+'/preview',{headers:{'X-Cubit-Waiver-Preview':token+'tampered'}})).status,403)
    assert.equal((await fetch(base+'/preview',{headers:{'X-Cubit-Waiver-Preview':jwt.sign({id:'staff-one'},process.env.JWT_SECRET)}})).status,403)
  }finally{await new Promise(resolve=>server.close(resolve))}
  console.log('PASS: plan tiers, grace off/on, payment restoration, staff blocks and account-bound waiver preview gate. No DB connected.')
}
main().catch(e=>{console.error(e);process.exitCode=1})
