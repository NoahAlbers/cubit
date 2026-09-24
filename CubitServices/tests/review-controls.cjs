const assert=require('assert/strict')
Object.assign(process.env,{LOCAL_DEVELOPMENT:'true',DATABASE_URI:'127.0.0.1',DATABASE_NAME:'TonicLocalDev',DATABASE_USERNAME:'tonic_local',DATABASE_PASSWORD:'test-only',JWT_SECRET:'unit-test-key'})
require('ts-node/register')
const {sortPlans}=require('../src/billing/plan-order')
const {postedLedger,accessDecision}=require('../src/billing/posted-ledger')
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
  console.log('PASS: plan tiers, grace off/on, payment restoration, staff access blocks. No DB connected.')
}
main().catch(e=>{console.error(e);process.exitCode=1})
