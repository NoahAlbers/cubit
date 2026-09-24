import { hash } from 'bcrypt'
import { AppDataSource, assertSchemaReady } from '../database'
import { localConfig } from '../dev/config'
import { Member, ROLES } from '../entity/member'
import { OperationsSettings } from '../entity/cubitOperations'
import { demoEmail, demoMemberId } from './identity'

// Operator-only initialization. Never read from or copy an imported database.
export async function initializeHostedDemo(password: string) {
  if(localConfig.runtimeMode!=='hosted-demo'||localConfig.database!=='cubit_demo'||localConfig.username!=='cubit_demo')
    throw Error('Demo initialization requires the separate synthetic database.')
  if(!password || password.length<10)throw Error('Supply a demo password of at least 10 characters.')
  await AppDataSource.initialize()
  try {
    await assertSchemaReady(AppDataSource)
    if(await AppDataSource.manager.count(Member))throw Error('Demo initialization requires an empty member table; existing data was not changed.')
    await (await import('../dev/seed')).seedLocalData()
    await (await import('../dev/seed-scenarios')).seedScenarios()
    await (await import('../dev/seed-plan-catalog')).seedPlanCatalog()
    await (await import('../billing/store')).initializeBilling()
    await AppDataSource.transaction(async manager=>{
      await manager.createQueryBuilder().update(Member).set({password:'Not Set'}).execute()
      await manager.update(Member,demoMemberId,{email:demoEmail,paypalEmail:demoEmail,
        firstName:'Demo',lastName:'Administrator',role:ROLES.ADMIN,password:await hash(password,12)})
      await manager.update(OperationsSettings,'default',{dailyEnabled:false})
    })
    await (await import('../dev/seed-waivers')).seedWaivers()
    await AppDataSource.query("INSERT INTO cubit_demo_manifest (id, complete) VALUES ('synthetic-v1', TRUE)")
    console.log('Synthetic demo initialized. No imported database was accessed.')
  } finally { await AppDataSource.destroy() }
}

if(require.main===module) initializeHostedDemo(process.env.DEMO_LOGIN_PASSWORD || '').catch(error=>{
  console.error(error.message);process.exitCode=1
})
