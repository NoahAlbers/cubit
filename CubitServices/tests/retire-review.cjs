const assert=require('node:assert/strict');
module.exports=async()=>{
  assert.equal(process.env.CUBIT_TEST_EMPTY_DATABASE,'yes');
  assert.equal(process.env.DATABASE_NAME,'cubit_demo');
  const db=await require('mysql2/promise').createConnection({host:'127.0.0.1',port:Number(process.env.DATABASE_PORT),user:process.env.DATABASE_USERNAME,password:process.env.DATABASE_PASSWORD,database:'cubit_demo'});
  const {preview,retire}=require('../../dev/retire-review-data.cjs');
  try {
    const before=await preview(db);
    const [[audit]]=await db.query('SELECT COUNT(*) AS n FROM operations_audit');
    await assert.rejects(()=>retire(db,{...before,staffCount:-1}),/changed since preview/);
    const broken=new Proxy(db,{get(t,k){if(k==='query')return (...args)=>String(args[0]).startsWith('DELETE FROM `plan`')?Promise.reject(Error('Injected failure')):t.query(...args);const v=t[k];return typeof v==='function'?v.bind(t):v;}});
    await assert.rejects(()=>retire(broken,before),/Injected failure/);
    assert.deepEqual(await preview(db),before,'Failed cleanup rolls back every deletion');
    const result=await retire(db,before);assert.equal(result.staffRetained,before.staffCount);
    const after=await preview(db);assert.ok(Object.values(after.counts).every(n=>n===0));assert.equal(after.staffFingerprint,before.staffFingerprint);
    assert.equal((await db.query('SELECT COUNT(*) AS n FROM operations_audit'))[0][0].n,audit.n,'Audit history retained');
    console.log('PASS: review retirement rolls back on failure, preserves staff credentials and audit history, and removes old business rows.');
  } finally {await db.end();}
};
