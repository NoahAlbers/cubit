import 'reflect-metadata';
import { DataSource } from 'typeorm';
import path from 'path';
import { localConfig } from './dev/config';
import { WindowsNamingStrategy } from './dev/windows-naming';
import { migrations } from './migrations/review-baseline';

const extension = __filename.endsWith('.js') ? 'js' : 'ts';
export const AppDataSource = new DataSource({
  type: 'mysql',
  host: localConfig.host,
  port: localConfig.databasePort,
  username: localConfig.username,
  password: localConfig.password,
  database: localConfig.database,
  namingStrategy: new WindowsNamingStrategy(),
  synchronize: false,
  migrationsRun: false,
  logging: false,
  entities: [path.join(__dirname, `entity/**/*.${extension}`)],
  migrations,
  migrationsTableName: 'cubit_migrations',
  migrationsTransactionMode: 'none',
  subscribers: [path.join(__dirname, `subscriber/**/*.${extension}`)],
});

// Do not use showMigrations here: TypeORM may create its tracking table while
// checking it. Application startup must work with SELECT/INSERT/UPDATE/DELETE only.
export async function assertSchemaReady(source: DataSource) {
  const exists = await source.query(
    "SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='cubit_migrations'",
  );
  if (!exists.length)
    throw Error(
      'Database migrations are required. Run the operator migration:run command before starting Cubit.',
    );
  const applied = new Set(
    (await source.query('SELECT name FROM cubit_migrations')).map(
      (row: { name: string }) => row.name,
    ),
  );
  if (migrations.some((migration) => !applied.has(migration.name)))
    throw Error(
      'Pending database migrations. Run the operator migration:run command before starting Cubit.',
    );
}
