// A scheduler-friendly entry point. It uses the guarded local database only.
const path = require('path')
process.chdir(path.resolve(__dirname, '../CubitServices'))
require('../CubitServices/node_modules/ts-node/register')
const { AppDataSource } = require('../CubitServices/src/app')
const { runAutomation } = require('../CubitServices/src/billing/automation')
async function main() {
  await AppDataSource.initialize()
  try { console.log(JSON.stringify(await runAutomation(process.argv.includes('--preview'), 'Scheduler command', !process.argv.includes('--preview')), null, 2)) }
  finally { await AppDataSource.destroy() }
}
main().catch(err => { console.error(err.message); process.exitCode = 1 })
