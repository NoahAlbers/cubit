// Stage an immutable export in a NEW local review schema. Never replaces the demo
// database, connects to production, or activates the review application itself.
const fs=require('fs'),path=require('path'),zlib=require('zlib'),crypto=require('crypto'),assert=require('assert/strict')
const root=path.resolve(__dirname,'..'),app=path.join(root,'CubitServices')
const mysql=require('../CubitServices/node_modules/mysql2/promise')
const bcrypt=require('../CubitServices/node_modules/bcrypt')
const settings=JSON.parse(fs.readFileSync(path.join(root,'.private/native/settings.json'),'utf8').replace(/^\uFEFF/,''))
const schema='toniclocalreview',folder=path.join(root,'.private/imports')
const sourceFile=path.join(folder,'tonic-current-data.json.gz')
const money=value=>Math.round(Number(value||0)*100)
const normalized=value=>path.resolve(value).replace(/\\/g,'/').toLowerCase().replace(/\/$/,'')
const q=value=>'`'+value.replace(/`/g,'``')+'`'

async function main(){
  const packed=fs.readFileSync(sourceFile),source=JSON.parse(zlib.gunzipSync(packed)),t=source.tables
  assert.equal(source.format,'cubit-tonic-export');assert.equal(source.version,1);assert.equal(source.complete,true)
  assert.equal(source.source.systemTimeZone,'UTC','Review dates currently require a UTC source')
  const hash=crypto.createHash('sha256').update(packed).digest('hex')
  for(const name of ['member','plan','member_plan','transaction','member_key','access_log']){
    assert.ok(Array.isArray(t[name]));assert.equal(t[name].length,source.counts[name]);assert.equal(new Set(t[name].map(r=>r.id)).size,t[name].length)
    for(const row of t[name]){assert.ok(typeof row.id==='string'&&row.id.length>0);assert.ok(!Object.keys(row).some(k=>/password|secret|token/i.test(k)))}
  }
  const members=new Map(t.member.map(m=>[m.id,m])),plans=new Map(t.plan.map(p=>[p.id,p]))
  for(const p of t.member_plan){assert.ok(members.has(p.memberId)&&plans.has(p.planId));assert.ok(/^\d{4}-\d{2}-\d{2}/.test(p.startDate));assert.ok(!p.endDate||/^\d{4}-\d{2}-\d{2}/.test(p.endDate))}
  for(const name of ['transaction','member_key','access_log'])for(const row of t[name])assert.ok(!row.memberId||members.has(row.memberId),'Orphan '+name)
  for(const row of t.transaction)assert.ok(Number.isFinite(Number(row.amount))&&/^\d{4}-\d{2}-\d{2}/.test(row.transactionDate))
  const conn=await mysql.createConnection({host:'127.0.0.1',port:3307,user:'root',password:settings.rootPassword,dateStrings:true})
  let db
  try{
    const [[server]]=await conn.query('SELECT @@datadir AS dir, @@port AS port')
    assert.equal(normalized(server.dir),normalized(path.join(root,'.private/native/mysql-data')));assert.equal(server.port,3307)
    const [existing]=await conn.query('SELECT SCHEMA_NAME FROM information_schema.schemata WHERE schema_name=?',[schema])
    if(existing.length){
      const [[state]]=await conn.query('SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema=?',[schema])
      assert.equal(state.n,0,'Review database contains tables; refusing to overwrite it')
    }else await conn.query('CREATE DATABASE '+q(schema)+' CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci')
    process.chdir(app)
    Object.assign(process.env,{LOCAL_DEVELOPMENT:'true',DATABASE_URI:'127.0.0.1',DATABASE_PORT:'3307',DATABASE_NAME:'TonicLocalReview',DATABASE_USERNAME:'tonic_local',DATABASE_PASSWORD:settings.appPassword,JWT_SECRET:settings.jwtSecret,TZ:'UTC'})
    require('../CubitServices/node_modules/ts-node/register')
    db=require('../CubitServices/src/app').AppDataSource
    await db.initialize();await db.synchronize()
    const {billingLedger}=require('../CubitServices/src/billing/ledger')
    const {postedLedger,accessDecision}=require('../CubitServices/src/billing/posted-ledger')
    const stamp=source.source.snapshotUtc,asOf=stamp.slice(0,10)
    const emailCounts=new Map()
    for(const m of t.member){const email=(m.email||'').trim().toLowerCase();emailCounts.set(email,(emailCounts.get(email)||0)+1)}
    const normalizedRole=role=>['officer','admin'].includes((role||'').toLowerCase())?'admin':'member'
    const uniqueEmail=m=>m.email&&emailCounts.get(m.email.trim().toLowerCase())===1&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email)
    const staff=t.member.find(m=>normalizedRole(m.role)==='admin'&&uniqueEmail(m))
    const portal=t.member.find(m=>normalizedRole(m.role)==='member'&&uniqueEmail(m)&&m.status==='Active')
    assert.ok(staff&&portal,'Need unambiguous local test accounts')
    const staffPassword=crypto.randomBytes(18).toString('base64url'),memberPassword=crypto.randomBytes(18).toString('base64url')
    const staffHash=await bcrypt.hash(staffPassword,10),memberHash=await bcrypt.hash(memberPassword,10)
    const batches=async(manager,table,rows)=>{
      if(!rows.length)return
      const columns=Object.keys(rows[0])
      for(let offset=0;offset<rows.length;offset+=500){const values=rows.slice(offset,offset+500).map(row=>columns.map(c=>row[c]===undefined?null:row[c]));await manager.query('INSERT INTO '+q(table)+' ('+columns.map(q).join(',')+') VALUES ?',[values])}
    }
    const billing=[],charges=[],memberRows=[]
    for(const m of t.member){
      const memberships=t.member_plan.filter(p=>p.memberId===m.id).map(p=>({...p,plan:plans.get(p.planId)}))
      const payments=t.transaction.filter(p=>p.memberId===m.id)
      const ledger=billingLedger(memberships,payments,asOf)
      const records=ledger.charges.map(c=>({id:crypto.randomUUID(),memberId:m.id,memberPlanId:c.planId,planName:c.planName,dueDate:c.dueDate,amount:c.amount,voided:false}))
      const posted=postedLedger(records,payments,[],asOf)
      assert.equal(ledger.balance,posted.balance);assert.equal(ledger.pastDue,posted.pastDue)
      const decision=accessDecision({},memberships,posted,60)
      // Independently reproduce the archived Tonic calendar rollover calculation.
      let legacyCharges=0
      for(const p of memberships){const date=new Date(p.startDate.replace(' ','T')+'Z'),end=new Date((p.endDate||stamp).replace(' ','T')+'Z');let n=0;while(date<=end){assert.ok(n++<1200);legacyCharges+=Number(p.plan.monthlyCost);date.setUTCMonth(date.getUTCMonth()+1)}}
      billing.push({memberId:m.id,name:[m.firstName,m.lastName].join(' '),email:m.email,sourceStatus:m.status,sourceStoredBalance:m.balance,
        sourceDynamicBalance:legacyCharges-payments.reduce((sum,p)=>sum+Number(p.amount),0),cubitStatus:decision.status,cubitBalance:posted.balance,pastDue:posted.pastDue,
        planCount:memberships.length,currentPlanCount:memberships.filter(p=>p.startDate.slice(0,10)<=asOf&&(!p.endDate||p.endDate.slice(0,10)>=asOf)).length})
      charges.push(...records)
      memberRows.push({...m,password:m.id===staff.id?staffHash:m.id===portal.id?memberHash:'Not Set',role:normalizedRole(m.role),status:decision.status,balance:posted.balance,
        accessHold:false,accessHoldReason:'',billingSuspended:decision.suspended,statusReason:decision.reason})
    }
    const overview={exportSha256:hash,snapshotUtc:stamp,counts:source.counts,paymentTotalCents:t.transaction.reduce((n,p)=>n+money(p.amount),0),charges:charges.length,
      unassignedPayments:t.transaction.filter(p=>!p.memberId).length,unassignedPaymentCents:t.transaction.filter(p=>!p.memberId).reduce((n,p)=>n+money(p.amount),0),
      duplicateEmailGroups:[...emailCounts].filter(([email,n])=>email&&n>1).length,blankEmails:t.member.filter(m=>!m.email?.trim()).length,
      storedBalanceDifferences:billing.filter(b=>money(b.sourceStoredBalance)!==money(b.cubitBalance)).length,
      dynamicBalanceDifferences:billing.filter(b=>money(b.sourceDynamicBalance)!==money(b.cubitBalance)).length,
      statusDifferences:billing.filter(b=>b.sourceStatus!==b.cubitStatus).length,
      sourceStatuses:Object.fromEntries([...new Set(billing.map(b=>b.sourceStatus))].map(s=>[s,billing.filter(b=>b.sourceStatus===s).length])),
      cubitStatuses:Object.fromEntries([...new Set(billing.map(b=>b.cubitStatus))].map(s=>[s,billing.filter(b=>b.cubitStatus===s).length])),
      multipleCurrentPlans:billing.filter(b=>b.currentPlanCount>1).length,
      assumptions:['Source calendar is UTC.','Officer roles map to local staff; other roles map to member.','Current catalog rates are preserved as membership rate snapshots; historic rate changes are unavailable.','Cubit uses monthly anniversaries clamped to month-end and the approved 60-day grace rule.','Existing end dates stop charges; missing cancellation dates are not inferred.','28 unassigned payments remain unassigned; no guessed matches.','No source passwords, fake members, demo waivers or signatures are imported.']}
    await db.transaction(async manager=>{
      await batches(manager,'member',memberRows)
      await batches(manager,'plan',t.plan.map(p=>({...p,available:true})))
      await batches(manager,'member_plan',t.member_plan.map(p=>({...p,billingRate:plans.get(p.planId).monthlyCost,billingName:plans.get(p.planId).name,finalBillingDate:p.finalBillingDate||null})))
      await batches(manager,'transaction',t.transaction.map(p=>({...p,memberId:p.memberId||null,createdAt:stamp})))
      await batches(manager,'memberkey',t.member_key)
      await batches(manager,'access_log',t.access_log.map(l=>({...l,memberId:l.memberId||null})))
      await batches(manager,'billing_charge',charges)
      await manager.query('INSERT INTO operations_settings (id,graceDays,dailyEnabled,version,migrationSummary) VALUES (?,60,0,1,?)',['default',JSON.stringify({members:t.member.length,charges:charges.length,reconciled:true,at:stamp.replace(' ','T')+'Z',source:'Tonic export',note:'Payment totals and generated ledger reconciled; legacy balance/status differences are documented separately.'})])
    })
    for(const [key,target]of Object.entries({member:'member',plan:'plan',member_plan:'member_plan',transaction:'transaction',member_key:'memberkey',access_log:'access_log'})){
      const [[row]]=await conn.query('SELECT COUNT(*) AS n FROM '+q(schema)+'.'+q(target));assert.equal(row.n,source.counts[key])
      const [rows]=await conn.query('SELECT * FROM '+q(schema)+'.'+q(target)+' ORDER BY id')
      const byId=new Map(rows.map(r=>[r.id,r]))
      for(const original of t[key])for(const [field,value]of Object.entries(original)){
        if(key==='member'&&['status','statusReason','balance','role'].includes(field))continue
        const actual=byId.get(original.id)[field]
        if(['amount','monthlyCost','balance','accessGranted'].includes(field)){assert.equal(value===null?null:Number(value),actual===null?null:Number(actual));continue}
        assert.equal(actual,value===''&&field==='memberId'?null:value,`Field mismatch: ${key}.${field}`)
      }
    }
    const [[total]]=await conn.query('SELECT SUM(amount) AS amount FROM '+q(schema)+'.transaction')
    assert.equal(money(total.amount),overview.paymentTotalCents)
    const roles=t.member.filter(m=>normalizedRole(m.role)==='admin').length
    assert.equal(roles,3,'Review unexpected staff-role mapping')
    await db.query('CREATE TABLE cubit_import_manifest (id VARCHAR(20) PRIMARY KEY, complete BOOLEAN NOT NULL, sha256 CHAR(64) NOT NULL, snapshotUtc DATETIME NOT NULL)')
    await db.query('INSERT INTO cubit_import_manifest VALUES (?,1,?,?)',['current',hash,stamp])
    fs.writeFileSync(path.join(folder,'import-reconciliation.json'),JSON.stringify({overview,members:billing,unassignedPayments:t.transaction.filter(p=>!p.memberId)},null,2))
    fs.writeFileSync(path.join(folder,'local-access.json'),JSON.stringify({staff:{id:staff.id,email:staff.email,password:staffPassword},member:{id:portal.id,email:portal.email,password:memberPassword}},null,2),{mode:0o600})
    fs.writeFileSync(path.join(folder,'local-access.txt'),`LOCAL TESTING ONLY — http://localhost:5001\nThese passwords work only in the imported local copy.\n\nStaff account\nEmail: ${staff.email}\nPassword: ${staffPassword}\n\nMember portal test account\nEmail: ${portal.email}\nPassword: ${memberPassword}\n\nAll other imported logins are disabled until local test access is explicitly assigned.\n`,{mode:0o600})
    console.log(JSON.stringify(overview,null,2))
    console.log('Validated staging schema: '+schema+'. Application selection has NOT changed.')
  }finally{if(db?.isInitialized)await db.destroy();await conn.end()}
}
main().catch(error=>{console.error('Import failed: '+(error.code||error.message));process.exitCode=1})
