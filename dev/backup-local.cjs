const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const mysql = require('../TonicServices/node_modules/mysql2/promise')
async function main() {
  const root = path.resolve(__dirname, '..')
  const settings = JSON.parse(fs.readFileSync(path.join(root, '.private/native/settings.json'), 'utf8').replace(/^\uFEFF/, ''))
  const database=settings.database||'TonicLocalDev'
  if(!['TonicLocalDev','TonicLocalReview'].includes(database))throw Error('Invalid workspace database selection')
  const db = await mysql.createConnection({ host: '127.0.0.1', port: 3307, user: 'root', password: settings.rootPassword })
  try {
    const [[row]] = await db.query('SELECT @@datadir AS dir')
    if (path.resolve(row.dir).toLowerCase() !== path.join(root, '.private/native/mysql-data').toLowerCase()) throw Error('Not the workspace database')
    const target = path.join(root, '.private/backups')
    fs.mkdirSync(target, { recursive: true })
    const file = path.join(target, `cubit-${new Date().toISOString().replace(/[:.]/g, '-')}.sql`)
    execFileSync(path.join(root, '.private/tools/mysql/mysql-8.0.19-winx64/bin/mysqldump.exe'),
      ['--host=127.0.0.1', '--port=3307', '--user=root', '--single-transaction', '--no-tablespaces', '--set-gtid-purged=OFF', `--result-file=${file}`, database.toLowerCase()],
      { env: { ...process.env, MYSQL_PWD: settings.rootPassword }, windowsHide: true, stdio: 'pipe' })
    if (fs.statSync(file).size < 1000) throw Error('Backup is unexpectedly small')
    console.log(`Local database backup saved: ${file}`)
  } finally { await db.end() }
}
main().catch(err => { console.error(err.message); process.exitCode = 1 })
