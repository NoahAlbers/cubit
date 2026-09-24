const fs = require('fs')
const path = require('path')
const https = require('https')
const crypto = require('crypto')
const { pipeline } = require('stream/promises')
const { spawn } = require('child_process')
const root = path.resolve(__dirname, '..')
const tools = path.join(root, '.private/tools')

async function digest(file, algorithm) {
  const hash = crypto.createHash(algorithm)
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk)
  return hash.digest('hex')
}
function response(url, remaining = 5) {
  return new Promise((resolve, reject) => {
    if (!url.startsWith('https://')) return reject(new Error('Downloads require HTTPS'))
    https.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && remaining) {
        res.resume()
        resolve(response(new URL(res.headers.location, url).href, remaining - 1))
      } else if (res.statusCode === 200) resolve(res)
      else { res.resume(); reject(new Error(`Download failed: HTTP ${res.statusCode}`)) }
    }).on('error', reject)
  })
}
async function verifiedDownload(url, destination, hash, algorithm = 'sha256') {
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  if (!fs.existsSync(destination)) {
    console.log(`Downloading ${path.basename(destination)}...`)
    const temporary = destination + '.download'
    await pipeline(await response(url), fs.createWriteStream(temporary))
    if (await digest(temporary, algorithm) !== hash) throw new Error(`Checksum mismatch for ${destination}`)
    fs.renameSync(temporary, destination)
  }
  if (await digest(destination, algorithm) !== hash) throw new Error(`Checksum mismatch for ${destination}`)
}
function run(exe, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { windowsHide: true, stdio: 'inherit', ...options })
    child.on('error', reject)
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${path.basename(exe)} exited with code ${code}`)))
  })
}

async function main() {
  const mysqlArchive = path.join(tools, 'mysql/mysql-8.4.11-winx64.zip')
  await verifiedDownload('https://cdn.mysql.com/Downloads/MySQL-8.4/mysql-8.4.11-winx64.zip', mysqlArchive, 'a492371d687d2bab088b0062581144a0044b8964baefdf4faa579292b423d25c')
  if (!fs.existsSync(path.join(tools, 'mysql/mysql-8.4.11-winx64/bin/mysqld.exe'))) {
    console.log('Extracting portable MySQL...')
    await run('tar.exe', ['-xf', mysqlArchive, '-C', path.dirname(mysqlArchive)])
  }
  const node22 = path.join(tools, 'node22-22.23.3/node.exe')
  await verifiedDownload('https://nodejs.org/dist/v22.23.3/win-x64/node.exe', node22, '9c9245166b4a8e182e0b797da9c20136117ff24368eaff1fec8343a123c8db0e')
  const pnpmArchive = path.join(tools, 'pnpm9/pnpm-9.15.9.tgz')
  const pnpmHash = Buffer.from('aARhQYk8ZvrQHAeSMRKOmvuJ74fiaR1p5NQO7iKJiClf1GghgbrlW1hBjDolO95lpQXsfF+UA+zlzDzTfc8lMQ==', 'base64').toString('hex')
  await verifiedDownload('https://registry.npmjs.org/pnpm/-/pnpm-9.15.9.tgz', pnpmArchive, pnpmHash, 'sha512')
  const pnpm = path.join(tools, 'pnpm9/package/bin/pnpm.cjs')
  if (!fs.existsSync(pnpm)) await run('tar.exe', ['-xzf', pnpmArchive, '-C', path.dirname(pnpmArchive)])
  const env = { ...process.env }
  const pathKey = Object.keys(env).find(key => key.toLowerCase() === 'path') || 'PATH'
  env[pathKey] = `${path.dirname(node22)};${env[pathKey] || ''}`
  const cwd = path.join(root, 'CubitServices')
  await run(node22, [pnpm, 'install', '--frozen-lockfile', '--force', '--store-dir', path.join(root, '.private/pnpm-native-store')], { cwd, env })
  await run(node22, ['node_modules/typescript/bin/tsc', '--noEmit'], { cwd })
  await run(node22, ['tests/local-safety.cjs'], { cwd })
  console.log('Native tools are ready. Run dev\\start-local.cmd.')
}
main().catch(err => { console.error(err.message); process.exitCode = 1 })
