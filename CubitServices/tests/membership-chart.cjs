require('ts-node/register')
const assert=require('assert/strict')
const {membershipChart}=require('../../CubitWeb/src/app/components/reports/membership-chart')
for(const values of [[],[0],[171],[171,171,171],[163,170,171],[1,20,13],Array.from({length:69},(_,i)=>i+100)]){
 const chart=membershipChart(values.map((activeMembers,i)=>({month:String(i),activeMembers})))
 assert.equal(chart.points.length,values.length)
 assert.ok(chart.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.y>=40&&p.y<=224))
 assert.equal(chart.ticks[0].value,values.length?Math.min(...values):0)
 if(values.length)assert.equal(Math.max(...chart.points.map(p=>p.y)),224,'Lowest count is the baseline')
 if(values.length===1)assert.equal(chart.points[0].x,316)
 if(values.length>1){assert.equal(chart.points[0].x,52);assert.equal(chart.points.at(-1).x,580)}
 assert.ok(chart.labels.length<=7)
}
console.log('PASS: actual-minimum baseline, empty, zero, single-month, flat and multi-year chart geometry.')
