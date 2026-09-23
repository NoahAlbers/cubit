// Run in the legacy server application working directory. Does not load the application,
// synchronize schemas, refresh balances, or call PayPal/door/email integrations.
const fs = require('fs')
const path = require('path')
const { createRequire } = require('module')
const { once } = require('events')
const appRequire = createRequire(path.join(process.cwd(), 'package.json'))
const mysql = appRequire('mysql2/promise')
const dotenv = appRequire('dotenv')

const tables = {
  member: ['id','firstName','lastName','email','paypalEmail','emergencyContact','emergencyEmail','emergencyPhone','phone','picture','status','statusReason','balance','role'],
  plan: ['id','name','monthlyCost'],
  member_plan: ['id','startDate','endDate','finalBillingDate','memberId','planId','paypalSubscriptionId','paypalSubscriptionPlanId','billingRate','billingName'],
  transaction: ['id','amount','confirmation','transactionDate','description','memberId','method','paypalEmail','paypalMemberId','paypalName'],
  member_key: ['id','serialNumber','memberId','status'],
  access_log: ['id','memberId','message','accessGranted','timestamp'],
}
const required = {
  member:['id','firstName','lastName','email'], plan:['id','name','monthlyCost'],
  member_plan:['id','memberId','planId','startDate','endDate'],
  transaction:['id','memberId','amount','transactionDate'],
  member_key:['id','memberId','serialNumber','status'], access_log:['id','memberId','timestamp','accessGranted'],
}
const normalize = value => value.replace(/_/g, '').toLowerCase()
const identifier = value => '`' + value.replace(/`/g, '``') + '`'

async function main() {
  const args = process.argv.slice(2)
  const options = {}
  while (args.length) {
    const flag = args.shift(), value = args.shift()
    if (!['--env-file','--output'].includes(flag) || !value) throw Error('Use --env-file <path> and/or --output <new-file> only.')
    options[flag] = value
  }
  const envPath = path.resolve(options['--env-file'] || '.env')
  const env = { ...(fs.existsSync(envPath) ? dotenv.parse(fs.readFileSync(envPath)) : {}), ...process.env }
  for (const key of ['DATABASE_URI','DATABASE_NAME','DATABASE_USERNAME','DATABASE_PASSWORD']) if (!env[key]) throw Error('Missing '+key+' in the application environment.')
  const db = await mysql.createConnection({
    host:env.DATABASE_URI, port:Number(env.DATABASE_PORT || 3306), database:env.DATABASE_NAME,
    user:env.DATABASE_USERNAME, password:env.DATABASE_PASSWORD, dateStrings:true,
    supportBigNumbers:true, bigNumberStrings:true, connectTimeout:10000,
  })
  let out
  try {
    const [available] = await db.query('SELECT TABLE_NAME AS name, ENGINE AS engine FROM information_schema.tables WHERE table_schema=DATABASE() AND TABLE_TYPE=\'BASE TABLE\'')
    const mapping = {}
    for (const [key, allowed] of Object.entries(tables)) {
      const matches = available.filter(t => normalize(t.name) === normalize(key))
      if (matches.length !== 1) throw Error('Expected one table for '+key+'; found '+matches.length+'. Stop and review the schema.')
      const table = matches[0]
      if (table.engine !== 'InnoDB') throw Error(key+' is not InnoDB; a consistent export needs review.')
      const [columns] = await db.query('SELECT COLUMN_NAME AS name, COLUMN_TYPE AS type FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? ORDER BY ORDINAL_POSITION',[table.name])
      const selected = allowed.map(name => ({name, column:columns.find(c => c.name.toLowerCase() === name.toLowerCase())})).filter(c => c.column)
      for (const name of required[key]) if (!selected.some(c => c.name === name)) throw Error('Missing expected column '+key+'.'+name)
      mapping[key] = { table:table.name, columns:selected.map(c => ({name:c.name, source:c.column.name, type:c.column.type})), omittedColumns:columns.filter(c => !selected.some(s => s.column.name===c.name)).map(c => c.name) }
    }
    await db.query('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ')
    await db.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY')
    const [[source]] = await db.query('SELECT DATABASE() AS databaseName, VERSION() AS mysqlVersion, @@session.time_zone AS sessionTimeZone, @@system_time_zone AS systemTimeZone, UTC_TIMESTAMP() AS snapshotUtc')
    const fd = options['--output'] ? fs.openSync(path.resolve(options['--output']), 'wx', 0o600) : null
    out = fd === null ? process.stdout : fs.createWriteStream(null, {fd})
    const write = async value => { if (!out.write(value)) await once(out,'drain') }
    const counts = {}
    await write(JSON.stringify({format:'cubit-tonic-export',version:1,source,schema:mapping}).slice(0,-1)+',"tables":{')
    let firstTable = true
    for (const [key, info] of Object.entries(mapping)) {
      await write((firstTable?'':',')+JSON.stringify(key)+':[')
      firstTable=false
      let lastId=null, count=0
      const selected=info.columns.map(c=>identifier(c.source)+' AS '+identifier(c.name)).join(',')
      const id=identifier(info.columns.find(c=>c.name==='id').source)
      while(true) {
        const [rows] = await db.query('SELECT '+selected+' FROM '+identifier(info.table)+(lastId===null?'':' WHERE '+id+' > ?')+' ORDER BY '+id+' LIMIT 1000',lastId===null?[]:[lastId])
        if(!rows.length)break
        for(const row of rows) {await write((count?',':'')+JSON.stringify(row));count++}
        lastId=rows[rows.length-1].id
      }
      await write(']')
      counts[key]=count
      console.error(key+': '+count+' rows')
    }
    await db.rollback()
    await write('},"counts":'+JSON.stringify(counts)+',"complete":true}\n')
    if(out!==process.stdout) {out.end();await once(out,'finish')}
    console.error('Export complete. No passwords exported and no database rows changed.')
  } finally {await db.end()}
}
main().catch(error => {
  // Database errors can contain query values; print only their stable error code.
  console.error('Export failed: '+(error.code || error.message))
  process.exitCode=1
})
