const assert=require('node:assert/strict');
module.exports=async function verifyReadOnlyStartup(db){
  assert.equal(process.env.CUBIT_TEST_EMPTY_DATABASE,'yes');
  const {startLocalApp}=require('../src/app'),{assertSchemaReady}=require('../src/database');
  const {localConfig}=require('../src/dev/config');
  assert.equal((await db.runMigrations({transaction:'none'})).length,0,'Migration rerun is a no-op');
  await db.query("INSERT INTO cubit_demo_manifest (id,complete) VALUES ('synthetic-v1',TRUE)");
  const initialize=db.initialize,query=db.query,port=localConfig.port;
  let server,queries=[];
  try {
    db.initialize=async()=>db;localConfig.port=0;
    db.query=async function(sql,...args){
      assert.match(sql.trim(),/^SELECT\b/i,'Startup must not issue DDL, seed data or normalize records');
      queries.push(sql);return query.call(this,sql,...args);
    };
    server=await startLocalApp();
    assert.ok(queries.some(sql=>sql.includes('cubit_migrations')),'Startup verifies the migration version');
    assert.ok(queries.some(sql=>sql.includes('cubit_demo_manifest')),'Demo isolation marker is still checked');
  }finally{
    db.initialize=initialize;db.query=query;localConfig.port=port;
    if(server)await new Promise(resolve=>server.close(resolve));
    await db.query("DELETE FROM cubit_demo_manifest WHERE id='synthetic-v1'");
  }
  await db.query('RENAME TABLE cubit_migrations TO missing_migration_fixture');
  try{
    await assert.rejects(assertSchemaReady(db),/migrations are required/);
    const tables=await db.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='cubit_migrations'");
    assert.equal(tables.length,0,'Readiness check must not create a tracking table');
  }finally{await db.query('RENAME TABLE missing_migration_fixture TO cubit_migrations');}
  console.log('PASS: migration reruns do nothing; startup performs only reads and refuses an unmigrated schema without creating tables.');
};
