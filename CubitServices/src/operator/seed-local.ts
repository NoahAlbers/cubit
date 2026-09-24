import { seedLocalData } from '../dev/seed'
import { seedScenarios } from '../dev/seed-scenarios'
import { seedPlanCatalog } from '../dev/seed-plan-catalog'
import { initializeBilling } from '../billing/store'
import { seedWaivers } from '../dev/seed-waivers'
import {AppDataSource, assertSchemaReady} from '../database'
import {localConfig} from '../dev/config'

export async function seedLocal() {
  if(localConfig.runtimeMode!=='local'||localConfig.dataMode!=='demo')throw Error('Synthetic seeding is restricted to the local demo database.')
  await AppDataSource.initialize()
  try {
    await assertSchemaReady(AppDataSource)
    await seedLocalData()
    await seedScenarios()
    await seedPlanCatalog()
    await initializeBilling()
    await seedWaivers()
  } finally {await AppDataSource.destroy()}
}
if(require.main===module)seedLocal().catch(error=>{console.error(error.message);process.exitCode=1})
