const assert=require('assert/strict')
const fs=require('fs')
const path=require('path')
const vm=require('vm')
const ts=require('typescript')
const source=fs.readFileSync(path.resolve(__dirname,'../../CubitWeb/src/app/components/member/billing-history.ts'),'utf8')
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
const context={exports:{},Date};vm.runInNewContext(compiled,context)
const {billingRows}=context.exports
const data={asOf:'2026-09-22',charges:[
  {id:'charge-old',dueDate:'2026-07-01',planName:'Standard',amount:60,outstanding:0},
  {id:'charge-waived',dueDate:'2026-08-01',planName:'Standard',amount:0,outstanding:0},
  {id:'charge-new',dueDate:'2026-09-01',planName:'Standard',amount:60,outstanding:20},
],payments:[
  {id:'original',amount:50,transactionDate:'2026-07-01T12:00:00',correctedBy:'replacement'},
  {id:'reversal',amount:-50,transactionDate:'2026-07-01T12:00:00',reversalOf:'original'},
  {id:'replacement',amount:100,transactionDate:'2026-07-01T12:00:00'},
  {id:'refund',amount:-10,transactionDate:'2026-09-20T12:00:00',requestKey:'paypal:refund:abc'},
  {id:'removed',amount:0,transactionDate:'2026-09-21T12:00:00'},
]}
const rows=billingRows(data)
assert.equal(rows.length,5)
assert.equal(rows[0].id,'refund')
assert.equal(rows[0].amount,10)
assert.equal(rows[0].editable,false)
assert.equal(rows.find(r=>r.id==='charge-waived').status,'Waived')
assert.equal(rows.find(r=>r.id==='charge-new').status,'Part-paid')
assert.equal(rows.find(r=>r.id==='replacement').amount,-100)
assert.equal(rows.reduce((sum,r)=>sum+r.amount,0),30,'Displayed effective entries must reconcile to the balance')
assert.ok(billingRows(data,'asc').every((r,i,a)=>!i||a[i-1].date<=r.date))
assert.ok(rows.every((r,i,a)=>!i||a[i-1].date>=r.date))
console.log('PASS: unified history combines charges/payments/refunds, hides superseded entries, preserves waived charges, reconciles totals and sorts both ways.')
