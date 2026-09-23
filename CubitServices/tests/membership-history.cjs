require('ts-node/register')
const assert=require('assert/strict')
const {activeMembersAt}=require('../src/billing/membership-history')
const members=[{id:'a',accessHold:true},{id:'b'},{id:'c'}]
const plans=[{memberId:'a',startDate:'2026-01-01',finalBillingDate:'2026-03-31'},
  {memberId:'a',startDate:'2026-01-15',finalBillingDate:'2026-03-31'},
  {memberId:'b',startDate:'2026-04-01'}, {memberId:'c',startDate:'2026-01-01'}]
const charges=[{id:'a-charge',memberId:'a',memberPlanId:'a-plan',dueDate:'2026-01-01',amount:60},
  {id:'c-charge',memberId:'c',memberPlanId:'c-plan',dueDate:'2026-01-01',amount:60}]
const payments=[{memberId:'a',transactionDate:'2026-03-15',amount:60}]
const count=(date,today='2026-04-20')=>activeMembersAt(members,plans,charges,payments,[],60,date,today)
assert.equal(count('2025-12-31'),0)
assert.equal(count('2026-01-31'),2,'Unique members, not number of plans; future plans excluded')
assert.equal(count('2026-03-02'),2,'Inclusive grace boundary')
assert.equal(count('2026-03-03'),0,'Future payments cannot erase historical arrears')
assert.equal(count('2026-03-31'),1,'Payment restores access; final billing date inclusive')
assert.equal(count('2026-04-01'),1,'Ended plan excluded; new plan included')
assert.equal(count('2026-01-31','2026-01-31'),1,'Current manual holds count; unknown historical holds do not')
assert.equal(activeMembersAt(members,plans,charges,payments,[{memberId:'c',chargeId:'c-charge',credit:60}],60,'2026-03-31'),2,'Historical estimates use corrected ledger')
console.log('PASS: monthly active-member reconstruction, unique members, dates, grace boundaries, payment timing, corrections and current holds.')
