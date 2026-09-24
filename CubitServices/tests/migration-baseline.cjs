// Run only against an explicitly selected, empty disposable database.
const assert = require('node:assert/strict');
require('ts-node/register');
const {AppDataSource: db} = require('../src/app');
const {migrations} = require('../src/migrations/review-baseline');
db.setOptions({migrations, migrationsTableName: 'cubit_migrations', migrationsTransactionMode: 'none'});
(async () => {
  assert.equal(process.env.CUBIT_MIGRATION_TEST, 'disposable', 'Requires explicit disposable migration-test opt-in');
  await db.initialize();
  assert.equal((await db.query('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()')).length, 0, 'Refusing a nonempty database');
  await db.runMigrations({transaction: 'none'});
  assert.equal((await db.driver.createSchemaBuilder().log()).upQueries.length, 0, 'Entity/schema drift');
  assert.equal((await db.runMigrations({transaction: 'none'})).length, 0, 'Second migration run must be a no-op');
  console.log('Fresh baseline matches entities; repeated migration run is a no-op.');
})().catch(error => { console.error(error); process.exitCode = 1; })
  .finally(() => db.isInitialized ? db.destroy() : undefined);
