// Run only against an explicitly selected, empty disposable database.
const assert = require('node:assert/strict');
require('ts-node/register');
const {AppDataSource: db} = require('../src/app');
const {migrations} = require('../src/migrations/review-baseline');
db.setOptions({migrations, migrationsTableName: 'cubit_migrations', migrationsTransactionMode: 'none'});
let ownsSchema=false;
(async () => {
  assert.equal(process.env.CUBIT_MIGRATION_TEST, 'disposable', 'Requires explicit disposable migration-test opt-in');
  await db.initialize();
  assert.equal((await db.query('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()')).length, 0, 'Refusing a nonempty database');
  ownsSchema=true;
  await db.runMigrations({transaction: 'none'});
  assert.equal((await db.driver.createSchemaBuilder().log()).upQueries.length, 0, 'Entity/schema drift');
  assert.equal((await db.runMigrations({transaction: 'none'})).length, 0, 'Second migration run must be a no-op');
  const {randomUUID}=require('node:crypto');
  const memberId=randomUUID(), paymentId=randomUUID(), keyId=randomUUID();
  await db.query("INSERT INTO member (id,firstName,lastName,email,paypalEmail,balance) VALUES (?,'Migration','Fixture','migration@test.example','migration@test.example',12.34)",[memberId]);
  await db.query("INSERT INTO `transaction` (id,memberId,amount,transactionDate) VALUES (?,?,12.34,'2026-09-01')",[paymentId,memberId]);
  await db.query("INSERT INTO memberkey (id,memberId,serialNumber) VALUES (?,?,'migration-fixture')",[keyId,memberId]);
  // Reproduce supported pre-migration differences without ever using a real DB.
  await db.query('DROP TABLE cubit_migrations');
  await db.query('ALTER TABLE member MODIFY balance FLOAT NULL, DROP COLUMN tokenVersion, DROP COLUMN loginDisabled, DROP COLUMN staffVersion');
  await db.query('DROP TABLE organization_settings');
  await db.query('ALTER TABLE waiver_version DROP COLUMN providerFingerprint');
  await db.query('ALTER TABLE account_link RENAME INDEX idx_account_link_member TO previous_generated_index');
  await db.runMigrations({transaction:'none'});
  assert.equal((await db.driver.createSchemaBuilder().log()).upQueries.length,0,'Existing schema upgrade has no drift');
  assert.equal((await db.query('SELECT balance FROM member WHERE id=?',[memberId]))[0].balance,'12.34');
  assert.equal((await db.query('SELECT amount FROM `transaction` WHERE id=? AND memberId=?',[paymentId,memberId]))[0].amount,'12.34');
  assert.equal((await db.query('SELECT id FROM memberkey WHERE id=? AND memberId=?',[keyId,memberId]))[0].id,keyId);
  assert.equal((await db.runMigrations({transaction:'none'})).length,0);
  console.log('Fresh baseline and existing-schema upgrade match entities; member/payment/key IDs and money are preserved; reruns do nothing.');
})().catch(error => { console.error(error); process.exitCode = 1; })
  .finally(async () => {
    if(db.isInitialized) {
      try {if(ownsSchema)await db.dropDatabase();}
      finally {await db.destroy();}
    }
  });
