// Immutable snapshot publisher. Only the operator worker uses this module's writes.
const crypto = require('crypto');
const fields = {
  member: ['id','firstName','lastName','email','paypalEmail','emergencyContact','emergencyEmail','emergencyPhone','phone','picture','status','statusReason','balance','role'],
  plan: ['id','name','monthlyCost'],
  member_plan: ['id','startDate','endDate','finalBillingDate','memberId','planId','paypalSubscriptionId','paypalSubscriptionPlanId','billingRate','billingName'],
  transaction: ['id','amount','confirmation','transactionDate','description','memberId','method','paypalEmail','paypalMemberId','paypalName'],
  member_key: ['id','serialNumber','memberId','status'],
  access_log: ['id','memberId','message','accessGranted','timestamp'],
};
const kinds = Object.keys(fields);
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const fail = message => { throw Error(message); };
const date = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\d(?:[ T]\d\d:\d\d:\d\d(?:\.\d{1,6})?Z?)?$/.test(value)) fail('Invalid source date');
  const parsed = new Date(value.length === 10 ? value+'T00:00:00Z' : value.replace(' ','T').replace(/Z?$/,'Z'));
  if (!Number.isFinite(+parsed) || parsed.toISOString().slice(0,10) !== value.slice(0,10) || +parsed < Date.UTC(1900,0,1) || +parsed > Date.UTC(2101,0,1)) fail('Invalid source date');
  return parsed;
};
function validate(bytes) {
  if (bytes.length > 64*1024*1024) fail('Snapshot exceeds 64 MB');
  let input;try{input=JSON.parse(bytes.toString('utf8'));}catch{fail('Invalid snapshot JSON');}
  if (!input || input.format !== 'cubit-tonic-export' || input.version !== 1 || input.complete !== true) fail('Incomplete or unsupported snapshot');
  const timestamp = date(input.source?.snapshotUtc);
  if (+timestamp > Date.now()+300000) fail('Snapshot timestamp is in the future');
  if (input.source.systemTimeZone !== 'UTC' || !['SYSTEM','UTC','+00:00'].includes(input.source.sessionTimeZone)) fail('Source timezone needs an explicit mapping');
  if (JSON.stringify(Object.keys(input.tables||{}).sort()) !== JSON.stringify([...kinds].sort())) fail('Unexpected datasets');
  const records = [], maps = {};
  for (const kind of kinds) {
    const rows=input.tables[kind];
    if (!Array.isArray(rows) || rows.length>250000 || input.counts?.[kind]!==rows.length) fail('Invalid dataset count: '+kind);
    maps[kind] = new Map();
    for (const row of rows) {
      if (!row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).some(k=>!fields[kind].includes(k))) fail('Unexpected source field: '+kind);
      if (typeof row.id!=='string' || (row.id.length<1 || row.id.length>255 || /[\x00-\x1f]/.test(row.id)) || maps[kind].has(row.id)) fail('Invalid/duplicate source identity: '+kind);
      for (const value of Object.values(row)) if (value!==null && !['string','number','boolean'].includes(typeof value) || typeof value==='string'&&value.length>2048 || typeof value==='number'&&!Number.isFinite(value)) fail('Invalid field value: '+kind);
      if (kind==='member' && ['firstName','lastName','email','paypalEmail'].some(k=>typeof row[k]!=='string')) fail('Missing member fields');
      if (kind==='plan' && typeof row.name!=='string') fail('Missing plan name');
      if (kind==='member_key' && typeof row.serialNumber!=='string') fail('Missing key serial');
      for (const key of ['startDate','endDate','finalBillingDate','transactionDate','timestamp']) if (row[key]!=null) date(row[key]);
      const requiredDate = ({member_plan:'startDate',transaction:'transactionDate',access_log:'timestamp'})[kind];
      if (requiredDate && !row[requiredDate]) fail('Missing required date');
      for (const key of ['amount','monthlyCost','billingRate','balance']) if (row[key]!=null && (!/^-?\d+(?:\.\d{1,2})?$/.test(String(row[key])) || Math.abs(Number(row[key]))>99999999)) fail('Invalid money');
      if (kind==='transaction'&&row.amount==null || kind==='plan'&&row.monthlyCost==null) fail('Missing amount');
      if (kind==='access_log' && ![null,true,false,0,1].includes(row.accessGranted)) fail('Invalid access outcome');
      const clean=Object.fromEntries(fields[kind].filter(k=>Object.hasOwn(row,k)).map(k=>[k,row[k]]));
      const payload=JSON.stringify(clean), hash=sha(payload);
      maps[kind].set(row.id,clean);
      records.push({kind,id:row.id,memberId:row.memberId||null,dateValue:row.timestamp||row.transactionDate||row.startDate||null,search:[row.firstName,row.lastName,row.email,row.paypalEmail,row.phone,row.name].filter(Boolean).join(' ').slice(0,1400),payload,hash});
    }
  }
  if (!maps.member.size || !maps.plan.size) fail('Empty membership baseline');
  for (const kind of ['member_plan','member_key','transaction','access_log']) for (const row of maps[kind].values()) {
    if (row.memberId && !maps.member.has(row.memberId)) fail('Orphan member reference: '+kind);
    if (['member_plan','member_key'].includes(kind)&&!row.memberId) fail('Missing member reference');
    if (kind==='member_plan'&&!maps.plan.has(row.planId)) fail('Orphan plan reference');
  }
  const totals={};
  for(const kind of kinds)totals[kind]=maps[kind].size;
  totals.paymentCents=[...maps.transaction.values()].reduce((n,r)=>n+Math.round(Number(r.amount)*100),0);
  return {id:sha(bytes),timestamp,records,totals,source:input.source};
}
const schema = [
 `CREATE TABLE IF NOT EXISTS parallel_generation (id CHAR(64) PRIMARY KEY, sourceTime DATETIME(3) NOT NULL, importedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), counts JSON NOT NULL, changes JSON NOT NULL) ENGINE=InnoDB`,
 `CREATE TABLE IF NOT EXISTS parallel_current (id INT PRIMARY KEY, generation CHAR(64) NULL) ENGINE=InnoDB`,
 `INSERT IGNORE INTO parallel_current(id,generation) VALUES(1,NULL)`,
 `CREATE TABLE IF NOT EXISTS parallel_record (generation CHAR(64) NOT NULL, kind VARCHAR(20) NOT NULL, sourceId VARCHAR(255) COLLATE utf8mb4_bin NOT NULL, memberId VARCHAR(255) COLLATE utf8mb4_bin NULL, dateValue DATETIME(3) NULL, searchText VARCHAR(1400) NOT NULL, payload JSON NOT NULL, hash CHAR(64) NOT NULL, PRIMARY KEY(generation,kind,sourceId), INDEX idx_parallel_member(generation,kind,memberId), INDEX idx_parallel_date(generation,kind,dateValue), FOREIGN KEY(generation) REFERENCES parallel_generation(id) ON DELETE CASCADE) ENGINE=InnoDB`,
 `CREATE TABLE IF NOT EXISTS parallel_change (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, generation CHAR(64) NOT NULL, kind VARCHAR(20) NOT NULL, sourceId VARCHAR(255) COLLATE utf8mb4_bin NOT NULL, action VARCHAR(12) NOT NULL, beforeValue JSON NULL, afterValue JSON NULL, recordedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), INDEX idx_parallel_changes(recordedAt)) ENGINE=InnoDB`,
 `CREATE TABLE IF NOT EXISTS parallel_run (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, snapshot CHAR(64) NULL, status VARCHAR(16) NOT NULL, detail VARCHAR(255) NOT NULL, createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)) ENGINE=InnoDB`,
];
async function initialize(db){for(const sql of schema)await db.query(sql);}
async function publish(db, bytes) {
  const input=validate(bytes);
  const [[lock]]=await db.query("SELECT GET_LOCK('cubit_parallel_publish',0) AS acquired");
  if (!lock.acquired) fail('Another snapshot is being published');
  try {
    await db.beginTransaction();
    const [[current]]=await db.query('SELECT g.* FROM parallel_current c JOIN parallel_generation g ON g.id=c.generation WHERE c.id=1 FOR UPDATE');
    if (current?.id===input.id) {await db.rollback();return {status:'Duplicate',id:input.id};}
    if(current && +new Date(String(current.sourceTime).replace(' ','T').replace(/Z?$/,'Z'))>=+input.timestamp)fail('Older or conflicting snapshot');
    const [previous]=current?await db.query('SELECT kind,sourceId,hash,payload FROM parallel_record WHERE generation=?',[current.id]):[[]];
    const old=new Map(previous.map(r=>[r.kind+':'+r.sourceId,r])),changes={added:0,updated:0,removed:0};
    const diffs=[];
    for(const row of input.records){const key=row.kind+':'+row.id,before=old.get(key);old.delete(key);if(!before)changes.added++;else if(before.hash!==row.hash)changes.updated++;else continue;
      if(current)diffs.push([input.id,row.kind,row.id,before?'updated':'added',before?JSON.stringify(typeof before.payload==='string'?JSON.parse(before.payload):before.payload):null,row.payload]);}
    for(const row of old.values()){changes.removed++;diffs.push([input.id,row.kind,row.sourceId,'removed',JSON.stringify(typeof row.payload==='string'?JSON.parse(row.payload):row.payload),null]);}
    await db.query('INSERT INTO parallel_generation(id,sourceTime,counts,changes) VALUES(?,?,?,?)',[input.id,input.timestamp,JSON.stringify(input.totals),JSON.stringify(changes)]);
    for(let i=0;i<input.records.length;i+=200)await db.query('INSERT INTO parallel_record(generation,kind,sourceId,memberId,dateValue,searchText,payload,hash) VALUES ?',[input.records.slice(i,i+200).map(r=>[input.id,r.kind,r.id,r.memberId,r.dateValue?date(r.dateValue):null,r.search,r.payload,r.hash])]);
    for(let i=0;i<diffs.length;i+=100)await db.query('INSERT INTO parallel_change(generation,kind,sourceId,action,beforeValue,afterValue) VALUES ?',[diffs.slice(i,i+100)]);
    await db.query('UPDATE parallel_current SET generation=? WHERE id=1',[input.id]);
    await db.query("INSERT INTO parallel_run(snapshot,status,detail) VALUES(?,'Published','Complete snapshot validated and published')",[input.id]);
    await db.commit();
    return {status:'Published',id:input.id,counts:input.totals,changes};
  }catch(error){await db.rollback();throw error;}
  finally{await db.query("SELECT RELEASE_LOCK('cubit_parallel_publish')");}
}
async function retain(db){
  const [rows]=await db.query('SELECT id FROM parallel_generation ORDER BY sourceTime DESC');
  for(const row of rows.slice(3))await db.query('DELETE FROM parallel_generation WHERE id=? AND id NOT IN(SELECT generation FROM parallel_current WHERE generation IS NOT NULL)',[row.id]);
  await db.query('DELETE FROM parallel_change WHERE recordedAt<UTC_TIMESTAMP()-INTERVAL 90 DAY');
  await db.query('DELETE FROM parallel_run WHERE createdAt<UTC_TIMESTAMP()-INTERVAL 90 DAY');
}
module.exports={fields,kinds,validate,date,initialize,publish,retain};
