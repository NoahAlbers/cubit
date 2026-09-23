// Local-only timing/query-count comparison. Prints no member records or SQL.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto')
const root=path.resolve(__dirname,'..');process.chdir(path.join(root,'CubitServices'))
require('../CubitServices/node_modules/ts-node/register')
const {localConfig}=require('../CubitServices/src/dev/config')
assert.equal(localConfig.dataMode,'imported');assert.equal(localConfig.host,'127.0.0.1')
const {AppDataSource:db}=require('../CubitServices/src/app')
const {directoryRows}=require('../CubitServices/src/billing/directory')
const {day}=require('../CubitServices/src/billing/ledger')
const file=path.join(root,'.private/imports/directory-performance-before.json')
async function main(){
 await db.initialize()
 try{
  let queries=0,writes=0
  db.logger.logQuery=(sql)=>{queries++;if(/^\s*(UPDATE|INSERT|DELETE)/i.test(sql))writes++}
  const samples=[];let digest
  for(let i=0;i<2;i++){
   queries=0;writes=0;const start=performance.now(),rows=await directoryRows()
   const fields=['id','status','statusReason','balance','pastDue','daysPastDue','oldestUnpaidDate','unallocatedDebit','planName','planId','finalBillingDate','lastKeyUsage','lastAttempt','checkedIn30Days','enabledKeys','accessAllowed']
   const values=rows.sort((a,b)=>a.id.localeCompare(b.id)).map(r=>fields.map(f=>r[f]))
   digest=crypto.createHash('sha256').update(JSON.stringify(values)).digest('hex')
   samples.push({ms:Math.round(performance.now()-start),queries,writes,members:rows.length})
  }
  const result={day:day(new Date()),digest,samples}
  if(process.argv.includes('--capture'))fs.writeFileSync(file,JSON.stringify(result,null,2)+'\n')
  else {const before=JSON.parse(fs.readFileSync(file));assert.equal(result.day,before.day);assert.equal(digest,before.digest,'Every member billing/access/directory result must match the baseline');console.log('Before: '+JSON.stringify(before.samples))}
  console.log('Current: '+JSON.stringify(samples))
 }finally{await db.destroy()}
}
main().catch(e=>{console.error(e.message);process.exitCode=1})
