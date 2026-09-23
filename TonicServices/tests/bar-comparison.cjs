require('ts-node/register')
const assert=require('assert/strict')
const {barComparison}=require('../../CubitWeb/src/app/components/reports/bar-comparison')
const rows=[{month:'2026-07',netPayments:100.15,visits:20,activeMembers:150,membershipEstimated:true},
 {month:'2026-08',netPayments:25.25,visits:0,activeMembers:160,membershipEstimated:true},
 {month:'2026-09',netPayments:80.10,visits:10,activeMembers:155}]
const pay=barComparison(rows,'netPayments',0,2)
assert.equal(pay.change,-20.05);assert.equal(pay.total,205.5)
assert.deepEqual(barComparison(rows,'netPayments',2,0),pay,'Dragging upward compares the same chronological period')
assert.equal(barComparison(rows,'visits',0,2).percent,-50)
assert.equal(barComparison(rows,'visits',1,2).percent,null,'No divide-by-zero percentage')
assert.equal(barComparison(rows,'visits',1,1).percent,0)
const members=barComparison(rows,'activeMembers',0,2)
assert.equal(members.change,5);assert.equal(members.total,null,'Membership snapshots must not be summed');assert.equal(members.estimated,true)
const negative=barComparison([{month:'a',netPayments:-30},{month:'b',netPayments:20}],'netPayments',0,1)
assert.equal(negative.change,50);assert.equal(negative.percent,null)
assert.equal(barComparison([],'visits',0,1),null)
console.log('PASS: forward/reverse ranges, currency cents, gain/loss, zero/negative baselines, estimates and snapshot-versus-flow totals.')
