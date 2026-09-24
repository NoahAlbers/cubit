import {AppDataSource, assertSchemaReady} from '../database'
import {localConfig} from '../dev/config'

export async function seedLocal() {
  if(localConfig.runtimeMode!=='local'||localConfig.dataMode!=='demo')throw Error('Synthetic seeding is restricted to the local demo database.')
  await AppDataSource.initialize()
  try {
    await assertSchemaReady(AppDataSource)
    await (await import('../dev/seed')).seedLocalData()
    await (await import('../dev/seed-scenarios')).seedScenarios()
    await (await import('../dev/seed-plan-catalog')).seedPlanCatalog()
    await (await import('../billing/store')).initializeBilling()
    await (await import('../dev/seed-waivers')).seedWaivers()
  } finally {await AppDataSource.destroy()}
}
if(require.main===module)seedLocal().catch(error=>{console.error(error.message);process.exitCode=1})
