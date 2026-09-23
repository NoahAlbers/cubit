require('ts-node/register')
const assert=require('assert/strict')
const {directoryBilling,byMember}=require('../src/billing/directory-snapshot')
const member={id:'a',status:'Active',balance:0,billingSuspended:false,statusReason:'Current'}
const plan={id:'p',memberId:'a',startDate:'2026-01-31',billingRate:60,billingName:'Standard'}
const charge={id:'c',memberId:'a',memberPlanId:'p',dueDate:'2026-01-31',amount:60}
const payment={memberId:'a',transactionDate:'2026-01-31',amount:60}
const run=(m=member,p=[plan],c=[charge],pay=[payment],adj=[],date='2026-02-01')=>directoryBilling(m,p,c,pay,adj,60,date)
assert.equal(run().needsRefresh,false,'No database writes for unchanged member')
assert.equal(run(member,[plan],[charge],[payment],[],'2026-02-28').needsRefresh,true,'Month-end anniversary posts new dues')
assert.equal(run(member,[{...plan,finalBillingDate:'2026-02-15'}],[charge],[payment],[],'2026-02-28').needsRefresh,true,'Access changes on final billing date')
assert.equal(run(member,[{...plan,billingRate:null}]).needsRefresh,true,'Missing rate snapshot requires locked posting')
assert.equal(run({...member,balance:60}).needsRefresh,true,'Outdated stored balance is refreshed')
assert.equal(run({...member,accessHold:true,accessHoldReason:'Manual hold'}).needsRefresh,true,'Manual holds are respected')
assert.equal(run(member,[plan],[{...charge,voided:true}],[],[]).needsRefresh,false,'Voided charge is not regenerated')
assert.equal(run(member,[plan],[charge],[],[{memberId:'a',chargeId:'c',credit:60}]).needsRefresh,false,'Charge corrections count')
assert.equal(run(member,[plan],[charge],[{...payment,transactionDate:'2026-03-01'}]).ledger.totalPaid,0,'Future payment excluded')
assert.equal(run(member,[{...plan,finalBillingDate:'2026-01-31'}]).status,'Canceled')
assert.equal(run({...member,balance:60,statusReason:'Within billing grace period'},[plan],[charge],[]).needsRefresh,false)
const later=run(member,[{...plan,startDate:'2026-01-01'}],[{...charge,dueDate:'2026-01-01'}],[],[],'2026-03-03')
assert.equal(later.status,'Inactive');assert.equal(later.needsRefresh,true)
assert.deepEqual([...byMember([{memberId:'a',x:1},{memberId:'b',x:2},{memberId:'a',x:3}]).get('a')].map(r=>r.x),[1,3])
console.log('PASS: batched directory eligibility, unchanged accounts, due dates, cutoffs, manual holds, corrections, future payments and grouping.')
