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
  const before=postedLedger([],[],[],'2026-09-30'),after=postedLedger([],[],[],'2026-10-01');
  const canceled=[{startDate:'2026-09-01',finalBillingDate:'2026-09-30'}];
  assert.equal(accessDecision({},canceled,before,60).status,'Active','Final billing date remains inclusive');
  assert.equal(accessDecision({},canceled,after,60).status,'Canceled','Cancellation ends eligibility even without debt');
  assert.equal(accessDecision({},[],after,60).status,'Inactive','No current membership cannot grant access');
  assert.equal(accessDecision({},[{startDate:'2026-11-01'}],after,60).status,'Inactive','Future plans cannot grant early access');
  assert.equal(accessDecision({accessHold:true},plans,paid,365).status,'Inactive','Longer grace never clears a staff block');
  const atGrace=postedLedger([{id:'charge',memberPlanId:'p',dueDate:'2026-09-01',amount:60}],[],[],'2026-10-31');
  const expired=postedLedger([{id:'charge',memberPlanId:'p',dueDate:'2026-09-01',amount:60}],[],[],'2026-11-01');
  assert.equal(accessDecision({},plans,atGrace,60).status,'Active');assert.equal(accessDecision({},plans,expired,60).status,'Inactive');
  console.log('PASS: plan tiers, grace off/on, payment restoration, staff access blocks. No DB connected.')
}
main().catch(e=>{console.error(e);process.exitCode=1})
