// One-time, offline logical upgrade. Never points MySQL 8.4 at an 8.0 data directory.
const fs = require('fs'), path = require('path'), assert = require('assert/strict')
const { spawn, spawnSync } = require('child_process')
const mysql = require('../CubitServices/node_modules/mysql2/promise')
const { mysqlBase } = require('./runtime.cjs')
const root = path.resolve(__dirname, '..'), state = path.join(root, '.private/native')
const oldBase = path.join(root, '.private/tools/mysql/mysql-8.0.19-winx64')
const data = path.join(state, 'mysql-data'), fresh = path.join(state, 'mysql-data-8.4-upgrade')
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const slash = value => value.replace(/\\/g, '/')
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
let processDB, connection
function launch(base, ini, extra = []) {
  const fd = fs.openSync(path.join(state, 'upgrade-mysql.log'), 'a')
  processDB = spawn(path.join(base, 'bin/mysqld.exe'), [`--defaults-file=${ini}`, ...extra], { windowsHide: true, stdio: ['ignore', fd, fd] })
  fs.closeSync(fd)
}
async function connect(port, password, expected) {
  for (let i = 0; i < 90; i++) {
    try {
      const db = await mysql.createConnection({ host:'127.0.0.1', port, user:'root', password })
      const [[info]] = await db.query('SELECT @@datadir AS dir')
      if (path.resolve(info.dir).toLowerCase() !== expected.toLowerCase()) { await db.end(); throw Error('Wrong database instance') }
      return db
    } catch (err) { if (err.message === 'Wrong database instance' || processDB.exitCode !== null || i === 89) throw Error('Upgrade database unavailable; inspect private upgrade log'); await sleep(500) }
  }
}
async function shutdown() {
  if (connection) { await connection.query('SHUTDOWN'); await connection.end(); connection = null }
  if (processDB && processDB.exitCode === null) await new Promise(resolve => processDB.once('exit', resolve))
  processDB = null
}
async function counts(db, schemas) {
  const result = {}
  for (const schema of schemas) {
    const [tables] = await db.query('SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_TYPE=\'BASE TABLE\' ORDER BY TABLE_NAME', [schema])
    for (const table of tables) {
      const [[row]] = await db.query('SELECT COUNT(*) AS count FROM ?? . ??', [schema, table.name])
      result[`${schema}.${table.name}`] = Number(row.count)
    }
  }
  return result
}
function moveWithinState(source, destination) {
  for (const candidate of [source,destination]) if (!path.resolve(candidate).startsWith(state + path.sep)) throw Error('Move target is outside the native workspace')
  if (fs.existsSync(destination)) throw Error('Refusing to replace a data directory')
  fs.renameSync(source,destination)
}
async function main() {
  if (fs.existsSync(path.join(state,'app.pid'))) throw Error('Stop Cubit with dev/stop-local.cmd before upgrading.')
  if (fs.existsSync(fresh)) throw Error('A previous upgrade directory exists; inspect it before retrying.')
  if (!fs.readFileSync(path.join(state,'initialized.flag'),'utf8').includes('8.0.19')) throw Error('This upgrade is only for the previous 8.0.19 local database.')
  const settings = JSON.parse(fs.readFileSync(path.join(state,'settings.json'),'utf8').replace(/^\uFEFF/,''))
  if (![settings.rootPassword,settings.appPassword].every(v=>/^[a-f0-9]{32,64}$/.test(v))) throw Error('Invalid private credential format')
  launch(oldBase,path.join(state,'mysql.ini'),['--read-only=ON','--super-read-only=ON'])
  connection = await connect(3307,settings.rootPassword,data)
  const [rows] = await connection.query("SELECT SCHEMA_NAME AS name FROM information_schema.SCHEMATA WHERE LOWER(SCHEMA_NAME) IN ('toniclocaldev','toniclocalreview') ORDER BY SCHEMA_NAME")
  const schemas = rows.map(row=>row.name)
  if (!schemas.length) throw Error('No local workspace schemas found')
  const before = await counts(connection,schemas)
  const backup = path.join(root,'.private/backups',`before-mysql-8.4-${stamp}.sql`)
  fs.mkdirSync(path.dirname(backup),{recursive:true})
  const dumped = spawnSync(path.join(oldBase,'bin/mysqldump.exe'),['--host=127.0.0.1','--port=3307','--user=root','--single-transaction','--no-tablespaces','--set-gtid-purged=OFF',`--result-file=${backup}`,'--databases',...schemas],{windowsHide:true,stdio:'pipe',env:{...process.env,MYSQL_PWD:settings.rootPassword}})
  if (dumped.status !== 0 || fs.statSync(backup).size < 1000) throw Error('Logical backup failed')
  await shutdown()
  const ini = path.join(state,'upgrade-8.4.ini'), init = path.join(state,'upgrade-8.4-init.sql')
  fs.writeFileSync(ini,`[mysqld]\nbasedir="${slash(mysqlBase)}"\ndatadir="${slash(fresh)}"\nbind-address=127.0.0.1\nport=3311\nmysqlx=OFF\nskip-name-resolve\nskip-log-bin\ninnodb-buffer-pool-size=128M\n`)
  const initialized = spawnSync(path.join(mysqlBase,'bin/mysqld.exe'),[`--defaults-file=${ini}`,'--initialize-insecure'],{windowsHide:true,stdio:'pipe'})
  if (initialized.status !== 0) throw Error('MySQL 8.4 initialization failed')
  const sql = [`ALTER USER 'root'@'localhost' IDENTIFIED WITH caching_sha2_password BY '${settings.rootPassword}';`, `CREATE USER 'root'@'127.0.0.1' IDENTIFIED WITH caching_sha2_password BY '${settings.rootPassword}';`, "GRANT ALL ON *.* TO 'root'@'127.0.0.1' WITH GRANT OPTION;"]
  for (const host of ['localhost','127.0.0.1']) {
    sql.push(`CREATE USER 'tonic_local'@'${host}' IDENTIFIED WITH caching_sha2_password BY '${settings.appPassword}';`)
    for (const schema of schemas) sql.push(`GRANT ALL ON \`${schema}\`.* TO 'tonic_local'@'${host}';`)
  }
  fs.writeFileSync(init,sql.join('\n'))
  try {
    launch(mysqlBase,ini,[`--init-file=${slash(init)}`])
    connection = await connect(3311,settings.rootPassword,fresh)
    const input = fs.openSync(backup,'r')
    let restored
    try { restored = spawnSync(path.join(mysqlBase,'bin/mysql.exe'),['--host=127.0.0.1','--port=3311','--user=root','--binary-mode'],{windowsHide:true,stdio:[input,'pipe','pipe'],env:{...process.env,MYSQL_PWD:settings.rootPassword}}) } finally { fs.closeSync(input) }
    if (restored.status !== 0) throw Error('Restore failed; original data and logical backup retained')
    assert.deepEqual(await counts(connection,schemas),before,'Restored table counts differ')
    const [[version]] = await connection.query('SELECT VERSION() AS version')
    if (!version.version.startsWith('8.4.')) throw Error('Unexpected restored server version')
    await shutdown()
    const rollback = path.join(state,`mysql-data-8.0-rollback-${stamp}`)
    moveWithinState(data,rollback)
    try { moveWithinState(fresh,data) } catch (err) { moveWithinState(rollback,data); throw err }
    fs.writeFileSync(path.join(state,'initialized.flag'),'MySQL 8.4.11 initialized')
    fs.writeFileSync(path.join(state,'mysql-upgrade.json'),JSON.stringify({from:'8.0.19',to:version.version,backup,rollback,verifiedTables:Object.keys(before).length,completedAt:new Date().toISOString()},null,2))
    console.log(`MySQL ${version.version}: restored and verified ${Object.keys(before).length} tables. Original data and logical backup retained privately.`)
  } finally { if(fs.existsSync(init))fs.unlinkSync(init) }
}
main().catch(err=>{console.error(err.message);process.exitCode=1}).finally(async()=>{try{await shutdown()}catch{console.error('Check the private upgrade log before restarting.')}})
