const fs = require('fs')
const path = require('path')
const net = require('net')
const http = require('http')
const crypto = require('crypto')
const { spawn, execFileSync } = require('child_process')
const root = path.resolve(__dirname, '..')
const state = path.join(root, '.private/native')
const appDirectory = path.join(root, 'CubitServices')
const { nodeExe, mysqlBase } = require('./runtime.cjs')
const mysqlExe = path.join(mysqlBase, 'bin/mysqld.exe')
const nodemonScript = path.join(appDirectory, 'node_modules/nodemon/bin/nodemon.js')
const appPidFile = path.join(state, 'app.pid')
const dbHelper = path.join(__dirname, 'native-db.cjs')
const slash = value => value.replace(/\\/g, '/')
const write = (file, text) => fs.writeFileSync(file, text, 'utf8')
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

function run(exe, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { windowsHide: true, stdio: 'inherit', ...options })
    child.on('error', reject)
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${path.basename(exe)} exited with code ${code}`)))
  })
}
function processDetails(pid) {
  if (!Number.isInteger(pid) || pid < 1) throw new Error('Invalid recorded process ID')
  // Read only; no PowerShell script file or execution-policy change is needed.
  const query = `Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}' | Select-Object ExecutablePath,CommandLine | ConvertTo-Json -Compress`
  const output = execFileSync('powershell.exe', ['-NoProfile', '-Command', query], { encoding: 'utf8', windowsHide: true }).trim()
  return output ? JSON.parse(output) : null
}
function verifyAppProcess(pid) {
  const info = processDetails(pid)
  if (info && (info.ExecutablePath?.toLowerCase() !== nodeExe.toLowerCase() || !info.CommandLine?.includes(nodemonScript))) {
    throw new Error('Recorded process no longer belongs to this workspace; refusing to stop or reuse it.')
  }
  return info
}
function portOpen(port) {
  return new Promise(resolve => {
    const socket = net.createConnection({ host: '127.0.0.1', port })
    let done = false
    const finish = result => { if (!done) { done = true; socket.destroy(); resolve(result) } }
    socket.setTimeout(1000)
    socket.once('connect', () => finish(true))
    socket.once('error', () => finish(false))
    socket.once('timeout', () => finish(false))
  })
}
function launch(exe, args, cwd, logPrefix, env = process.env) {
  // Start-Process gives these Windows console programs a separate hidden console
  // so closing the launcher does not take the database down with it.
  const quote = value => "'" + value.replace(/'/g, "''") + "'"
  const argumentLine = args.map(value => '"' + value + '"').join(' ')
  const launchPidFile = path.join(state, logPrefix + '.launch.pid')
  const command = `$ErrorActionPreference = 'Stop'; $p = Start-Process -FilePath ${quote(exe)} -ArgumentList ${quote(argumentLine)} -WorkingDirectory ${quote(cwd)} -WindowStyle Hidden -PassThru -RedirectStandardOutput ${quote(path.join(state, logPrefix + '.stdout.log'))} -RedirectStandardError ${quote(path.join(state, logPrefix + '.stderr.log'))}; [IO.File]::WriteAllText(${quote(launchPidFile)}, $p.Id.ToString())`
  // No inherited stdout pipe: long-running descendants must not keep the
  // launcher's output pipe open and prevent execFileSync from returning.
  execFileSync('powershell.exe', ['-NoProfile', '-Command', command], { stdio: 'ignore', windowsHide: true, env })
  const pid = Number(fs.readFileSync(launchPidFile, 'utf8'))
  fs.unlinkSync(launchPidFile)
  if (!Number.isInteger(pid) || pid < 1) throw new Error(`Could not start ${logPrefix}`)
  return pid
}
function health() {
  return new Promise(resolve => {
    const req = http.get('http://127.0.0.1:5001/health', res => {
      let text = ''
      res.on('data', chunk => text += chunk)
      res.on('end', () => {
        try { const result = JSON.parse(text); resolve(res.statusCode === 200 && result.mode === 'local-development' && result.databaseReady) }
        catch { resolve(false) }
      })
    })
    req.setTimeout(1500, () => req.destroy())
    req.on('error', () => resolve(false))
  })
}

async function start() {
  for (const file of [nodeExe, mysqlExe, nodemonScript]) {
    if (!fs.existsSync(file)) throw new Error('Run dev\\setup-local.cmd first.')
  }
  fs.mkdirSync(state, { recursive: true })
  const settingsFile = path.join(state, 'settings.json')
  const dataDirectory = path.join(state, 'mysql-data')
  const versionMarker = path.join(state, 'initialized.flag')
  if (fs.existsSync(dataDirectory) && (!fs.existsSync(versionMarker) || !fs.readFileSync(versionMarker,'utf8').includes('8.4.'))) {
    throw new Error('Existing local data needs the offline upgrade: node dev/upgrade-native-mysql.cjs. Back up and stop the old local app first.')
  }
  if (!fs.existsSync(settingsFile)) {
    if (fs.existsSync(dataDirectory)) throw new Error('Existing MySQL data has no local settings; refusing to replace credentials.')
    write(settingsFile, JSON.stringify({ rootPassword: crypto.randomBytes(24).toString('hex'), appPassword: crypto.randomBytes(24).toString('hex'), jwtSecret: crypto.randomBytes(32).toString('hex') }, null, 2))
  }
  const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8').replace(/^\uFEFF/, ''))
  const database = settings.database || 'TonicLocalDev'
  if (!['TonicLocalDev','TonicLocalReview'].includes(database)) throw Error('Invalid workspace database selection.')
  if (![settings.rootPassword, settings.appPassword, settings.jwtSecret].every(value => typeof value === 'string' && /^[a-f0-9]{32,64}$/.test(value))) {
    throw new Error('Invalid local settings format.')
  }
  const mysqlConfig = path.join(state, 'mysql.ini')
  write(mysqlConfig, `[mysqld]\nbasedir="${slash(mysqlBase)}"\ndatadir="${slash(dataDirectory)}"\nbind-address=127.0.0.1\nport=3307\nmysqlx=OFF\nskip-name-resolve\nskip-log-bin\ninnodb-buffer-pool-size=128M\nlog-error="${slash(path.join(state, 'mysql-error.log'))}"\npid-file="${slash(path.join(state, 'mysql.pid'))}"\n`)
  if (await portOpen(3307)) {
    await run(nodeExe, [dbHelper, 'check'])
  } else {
    const marker = path.join(state, 'initialized.flag')
    if (!fs.existsSync(marker)) {
      console.log('Initializing the workspace MySQL database...')
      await run(mysqlExe, [`--defaults-file=${mysqlConfig}`, '--initialize-insecure'])
      write(marker, 'MySQL 8.4.11 initialized')
    }
    const bootstrap = path.join(state, 'bootstrap.sql')
    const statements = ['CREATE DATABASE IF NOT EXISTS TonicLocalDev CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;']
    for (const host of ['127.0.0.1', 'localhost']) {
      statements.push(`CREATE USER IF NOT EXISTS 'tonic_local'@'${host}' IDENTIFIED WITH caching_sha2_password BY '${settings.appPassword}';`, `ALTER USER 'tonic_local'@'${host}' IDENTIFIED WITH caching_sha2_password BY '${settings.appPassword}';`, `GRANT ALL PRIVILEGES ON TonicLocalDev.* TO 'tonic_local'@'${host}';`)
      statements.push(`GRANT ALL PRIVILEGES ON TonicLocalReview.* TO 'tonic_local'@'${host}';`)
    }
    statements.push(`CREATE USER IF NOT EXISTS 'root'@'127.0.0.1' IDENTIFIED WITH caching_sha2_password BY '${settings.rootPassword}';`, `ALTER USER 'root'@'127.0.0.1' IDENTIFIED WITH caching_sha2_password BY '${settings.rootPassword}';`, "GRANT ALL PRIVILEGES ON *.* TO 'root'@'127.0.0.1';", `ALTER USER 'root'@'localhost' IDENTIFIED WITH caching_sha2_password BY '${settings.rootPassword}';`)
    write(bootstrap, statements.join('\n') + '\n')
    launch(mysqlExe, [`--defaults-file=${mysqlConfig}`, `--init-file=${bootstrap}`], state, 'mysql')
    await run(nodeExe, [dbHelper, 'wait'])
    fs.unlinkSync(bootstrap)
  }
  write(path.join(appDirectory, '.env.local'), `LOCAL_DEVELOPMENT=true\nDATABASE_URI=127.0.0.1\nDATABASE_PORT=3307\nDATABASE_NAME=${database}\nDATABASE_USERNAME=tonic_local\nDATABASE_PASSWORD=${settings.appPassword}\nJWT_SECRET=${settings.jwtSecret}\nHOST=127.0.0.1\nPORT=5001\n`)

  let existing = null
  if (fs.existsSync(appPidFile)) existing = verifyAppProcess(Number(fs.readFileSync(appPidFile, 'utf8')))
  if (await portOpen(5001)) {
    if (!existing) throw new Error('Port 5001 is occupied by an unrecognized process.')
  } else {
    // A previous crash can leave nodemon alive without an application listener.
    if (existing) execFileSync('taskkill.exe', ['/PID', fs.readFileSync(appPidFile, 'utf8').trim(), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
    const env = { ...process.env }
    // Windows environment keys are case-insensitive; retain one PATH key only.
    const pathKey = Object.keys(env).find(key => key.toLowerCase() === 'path') || 'PATH'
    env[pathKey] = `${path.dirname(nodeExe)};${path.join(appDirectory, 'node_modules/.bin')};${env[pathKey] || ''}`
    const pid = launch(nodeExe, [nodemonScript, '--legacy-watch'], appDirectory, 'app', env)
    write(appPidFile, String(pid))
  }
  for (let attempt = 0; attempt < 45; attempt++) {
    if (await health()) {
      console.log('Cubit is running at http://localhost:5001')
      console.log(database==='TonicLocalDev'?'Demo login: admin@example.test / LocalDemoOnly!2026':'Imported-data review. Local test login details: .private/imports/local-access.txt')
      console.log('Stop it with dev\\stop-local.cmd')
      return
    }
    await sleep(500)
  }
  throw new Error('Cubit did not become ready. Inspect .private/native/app.stderr.log and app.stdout.log.')
}

async function stop() {
  if (fs.existsSync(appPidFile)) {
    const pid = Number(fs.readFileSync(appPidFile, 'utf8'))
    if (verifyAppProcess(pid)) execFileSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
    fs.unlinkSync(appPidFile)
  }
  const mysqlPidFile = path.join(state, 'mysql.pid')
  if (fs.existsSync(mysqlPidFile)) {
    if (await portOpen(3307)) {
      await run(nodeExe, [dbHelper, 'stop'])
      for (let attempt = 0; attempt < 40 && await portOpen(3307); attempt++) await sleep(250)
      if (await portOpen(3307)) throw new Error('MySQL has not finished shutting down.')
    } else if (processDetails(Number(fs.readFileSync(mysqlPidFile, 'utf8')))) {
      throw new Error('Recorded MySQL process is not responding; inspect its log before stopping it.')
    } else fs.unlinkSync(mysqlPidFile)
  }
  console.log('Local Cubit stopped. Database files have been preserved.')
}

const command = process.argv[2]
if (!['start', 'stop'].includes(command)) { console.error('Usage: native-local.cjs start|stop'); process.exitCode = 1 }
else (command === 'start' ? start() : stop()).catch(err => { console.error(err.message); process.exitCode = 1 })
