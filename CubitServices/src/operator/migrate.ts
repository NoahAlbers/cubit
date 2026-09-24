import { DataSource } from 'typeorm';
import { AppDataSource } from '../database';
import { localConfig } from '../dev/config';

export function operatorDataSource() {
  const username = process.env.CUBIT_MIGRATION_USER;
  const password = process.env.CUBIT_MIGRATION_PASSWORD;
  const socketPath = process.env.CUBIT_MIGRATION_SOCKET;
  if (!username || username === localConfig.username || (!password && !socketPath))
    throw Error(
      'Supply a separate operator database account; application credentials cannot run migrations.',
    );
  if (
    socketPath &&
    (process.platform === 'win32' ||
      process.getuid?.() !== 0 ||
      socketPath !== '/var/run/mysqld/mysqld.sock')
  )
    throw Error('The review operator socket is available only to root on the VPS.');
  const options = AppDataSource.options;
  if (options.type !== 'mysql')
    throw Error('Operator migrations require the configured MySQL database.');
  return new DataSource({ ...options, username, password, ...(socketPath ? { socketPath } : {}) });
}

export async function migrate(command = 'run') {
  if (!['run', 'check', 'status'].includes(command))
    throw Error('Usage: migration:run | migration:check | migration:status');
  const source = operatorDataSource();
  await source.initialize();
  const lock = source.createQueryRunner();
  try {
    await lock.connect();
    const rows = await lock.query('SELECT GET_LOCK(?,30) AS acquired', [
      'cubit:migrate:' + localConfig.database,
    ]);
    if (Number(rows[0].acquired) !== 1) throw Error('Another database migration is running.');
    if (command === 'run') {
      const completed = await source.runMigrations({ transaction: 'none' });
      console.log(`Applied ${completed.length} versioned migration(s).`);
    } else if (command === 'status') {
      console.log((await source.showMigrations()) ? 'Migrations pending.' : 'Migrations current.');
    }
    if (command !== 'status') {
      const drift = await source.driver.createSchemaBuilder().log();
      if (drift.upQueries.length)
        throw Error(
          `Schema/entity drift: ${drift.upQueries.length} pending changes. Review a new migration; synchronization is disabled.`,
        );
      console.log('Schema matches entity definitions.');
    }
  } finally {
    await lock
      .query('SELECT RELEASE_LOCK(?)', ['cubit:migrate:' + localConfig.database])
      .catch(() => {});
    await lock.release();
    await source.destroy();
  }
}
if (require.main === module)
  migrate(process.argv[2]).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
