// Operator-only, explicitly invoked after a verified backup. Never part of startup.
const crypto = require('node:crypto');
const businessTables = ['waiver_document','waiver_signature','staff_note','charge_adjustment','billing_change','billing_charge','payment_event','access_log','memberkey','member_plan','transaction','task','plan'];
const accountTables = ['account_link','account_mfa','account_notice','trusted_computer','staff_alert_preference'];
const staff = "role IN ('admin','staff')";
async function preview(db) {
  const [[schema]] = await db.query('SELECT DATABASE() AS name');
  if(schema.name !== 'cubit_review' && !(process.env.CUBIT_TEST_EMPTY_DATABASE==='yes' && schema.name==='cubit_demo')) throw Error('Not the explicitly allowed review database');
  const counts = {};
  const [found]=await db.query("SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()");
  const present=new Set(found.map(t=>t.name));
  for(const table of businessTables) {
    if(table==='task'&&!present.has(table))continue;
    const where=table==='waiver_document'?' WHERE memberId IS NOT NULL':'';
    const [[row]]=await db.query('SELECT COUNT(*) AS n FROM `'+table+'`'+where); counts[table]=row.n;
  }
  const [[members]]=await db.query("SELECT COUNT(*) AS n FROM member WHERE role IS NULL OR NOT ("+staff+")");
  counts.member=members.n;
  const [staffRows]=await db.query('SELECT id,password,tokenVersion,role,loginDisabled FROM member WHERE '+staff+' ORDER BY id');
  if(!staffRows.some(s=>s.role==='admin'&&!s.loginDisabled))throw Error('An enabled administrator must remain');
  return {counts,staffCount:staffRows.length,staffFingerprint:crypto.createHash('sha256').update(JSON.stringify(staffRows)).digest('hex')};
}
async function retire(db, expected) {
  await db.beginTransaction();
  try {
    await db.query('SELECT id FROM member FOR UPDATE');
    const before=await preview(db);
    if(JSON.stringify(before)!==JSON.stringify(expected))throw Error('Review changed since preview; inspect again');
    // Keep signed-document templates; member documents remain in the recovery archive.
    for(const table of Object.keys(before.counts).filter(t=>t!=='member')) await db.query('DELETE FROM `'+table+'`'+(table==='waiver_document'?' WHERE memberId IS NOT NULL':''));
    for(const table of accountTables) {
      const column=table==='staff_alert_preference'?'staffId':'memberId';
      await db.query('DELETE FROM `'+table+'` WHERE `'+column+'` NOT IN (SELECT id FROM member WHERE '+staff+')');
    }
    await db.query("DELETE FROM member WHERE role IS NULL OR NOT ("+staff+")");
    await db.query("UPDATE member SET balance=0,status='Inactive',accessHold=0,accessHoldReason='',billingSuspended=0 WHERE "+staff);
    await db.query("UPDATE operations_settings SET dailyEnabled=0,migrationSummary=NULL,version=version+1 WHERE id='default'");
    const after=await preview(db);
    if(Object.values(after.counts).some(n=>n!==0)||after.staffFingerprint!==before.staffFingerprint)throw Error('Retirement verification failed');
    await db.commit();return {removed:before.counts,staffRetained:after.staffCount};
  } catch(error) {await db.rollback();throw error;}
}
module.exports={preview,retire};
