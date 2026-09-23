// Used by the PowerShell scripts. Credentials never appear in command arguments.
const fs = require('fs')
const path = require('path')
const mysql = require('../TonicServices/node_modules/mysql2/promise')
const settingsPath = path.resolve(__dirname, '../.private/native/settings.json')
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8').replace(/^\uFEFF/, ''))
const normalize = value => path.resolve(value).replace(/\\/g, '/').replace(/\/$/, '').toLowerCase()

async function connectVerified() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1', port: 3307, user: 'root', password: settings.rootPassword,
    connectTimeout: 1500,
  })
  try {
    const [[row]] = await connection.query('SELECT @@datadir AS dataDirectory, @@port AS port')
    if (normalize(row.dataDirectory) !== normalize(path.resolve(__dirname, '../.private/native/mysql-data')) || row.port !== 3307) {
      throw new Error('Refusing to use a database outside this workspace.')
    }
    return connection
  } catch (err) {
    await connection.end()
    throw err
  }
}

async function main() {
  const command = process.argv[2]
  if (command === 'wait') {
    for (let attempt = 0; attempt < 45; attempt++) {
      try {
        const connection = await connectVerified()
        await connection.end()
        console.log('Workspace MySQL is ready on 127.0.0.1:3307.')
        return
      } catch (err) {
        if (attempt === 44) throw new Error('MySQL did not become ready; inspect .private/native/mysql-error.log.')
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
  } else if (command === 'stop') {
    const connection = await connectVerified()
    try { await connection.query('SHUTDOWN') }
    finally { await connection.end() }
    console.log('Workspace MySQL shut down.')
  } else {
    const connection = await connectVerified()
    await connection.end()
  }
}

main().catch(err => { console.error(err.message); process.exitCode = 1 })
