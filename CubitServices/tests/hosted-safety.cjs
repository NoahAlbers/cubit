const assert = require('assert/strict')
Object.assign(process.env, { CUBIT_MODE:'hosted-review', LOCAL_DEVELOPMENT:'false',
  DATABASE_URI:'127.0.0.1', DATABASE_NAME:'cubit_review', DATABASE_USERNAME:'cubit_app',
  DATABASE_PASSWORD:'test-only', JWT_SECRET:'x'.repeat(48), HOST:'127.0.0.1' })
require('ts-node/register')
const { readHostedReviewConfig } = require('../src/dev/config')
const { app, AppDataSource } = require('../src/app')
const { loginLimit } = require('../src/api/common/login-limit')
async function main() {
  assert.equal(readHostedReviewConfig(process.env).dataMode,'imported')
  for (const override of [{HOST:'0.0.0.0'}, {DATABASE_URI:'example.com'},
    {DATABASE_NAME:'wordpress'}, {DATABASE_USERNAME:'root'}, {LOCAL_DEVELOPMENT:'true'},
    {DOCUSEAL_ENABLED:'true'}, {JWT_SECRET:'short'}]) {
    assert.throws(()=>readHostedReviewConfig({...process.env,...override}))
  }
  await AppDataSource.buildMetadatas()
  assert.ok(AppDataSource.entityMetadatas.length >= 10)
  assert.ok(AppDataSource.entityMetadatas.every(m=>m.tableName===m.tableName.toLowerCase()))
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))})
  try {
    const base=`http://127.0.0.1:${server.address().port}`
    for (const route of ['/ACON','/ACON/whitelist','/paypal/update']) {
      assert.equal((await fetch(base+route)).status,403)
    }
    for (const route of ['/member','/key','/api/portal','/api/backups']) {
      assert.equal((await fetch(base+route)).status,401)
    }
    assert.equal((await fetch(base+'/api/backups/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'backup'})})).status,401)
    const health=await fetch(base+'/health')
    assert.equal(health.status,503)
    assert.equal((await health.json()).mode,'hosted-review')
    assert.equal(health.headers.get('access-control-allow-origin'),null)
  } finally { await new Promise(resolve=>server.close(resolve)) }
  let time=0, passed=0, status=0
  const limit=loginLimit(()=>time)
  const res={setHeader(){},status(value){status=value;return this},json(){}}
  for(let i=0;i<21;i++) limit({ip:'127.0.0.1'},res,()=>passed++)
  assert.equal(passed,20); assert.equal(status,429)
  time=15*60*1000
  limit({ip:'127.0.0.1'},res,()=>passed++)
  assert.equal(passed,21)
  assert.equal(AppDataSource.isInitialized,false)
  console.log('PASS: hosted config, lowercase metadata, protected routes, integration blocks and login throttling. No DB connected.')
}
main().catch(err=>{console.error(err);process.exitCode=1})
