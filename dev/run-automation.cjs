// A scheduler-friendly entry point. It uses the guarded local database only.
const path = require('path')
process.chdir(path.resolve(__dirname, '../TonicServices'))
require('../TonicServices/node_modules/ts-node/register')
const { AppDataSource } = require('../TonicServices/src/app')
const { runAutomation } = require('../TonicServices/src/billing/automation')
async function main() {
  await AppDataSource.initialize()
  try { console.log(JSON.stringify(await runAutomation(process.argv.includes('--preview'), 'Scheduler command', !process.argv.includes('--preview')), null, 2)) }
  finally { await AppDataSource.destroy() }
}
main().catch(err => { console.error(err.message); process.exitCode = 1 })
