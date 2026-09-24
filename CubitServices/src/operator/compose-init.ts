import { localConfig } from '../dev/config';
import { migrate, operatorDataSource } from './migrate';
import { seedLocal } from './seed-local';

async function initialize() {
  if (
    localConfig.runtimeMode !== 'local' ||
    localConfig.dataMode !== 'demo' ||
    localConfig.database !== 'TonicLocalDev' ||
    localConfig.username !== 'tonic_local'
  )
    throw Error(
      'Compose initialization is restricted to the isolated synthetic development database.',
    );
  await migrate();
  const operator = operatorDataSource();
  await operator.initialize();
  try {
    await operator.query("REVOKE ALL PRIVILEGES ON TonicLocalDev.* FROM 'tonic_local'@'%'");
    await operator.query(
      "GRANT SELECT, INSERT, UPDATE, DELETE ON TonicLocalDev.* TO 'tonic_local'@'%'",
    );
  } finally {
    await operator.destroy();
  }
  await seedLocal();
}
initialize().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
