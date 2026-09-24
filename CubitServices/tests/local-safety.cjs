const assert = require('assert/strict')
const http = require('http')

Object.assign(process.env, {
  LOCAL_DEVELOPMENT: 'true', DATABASE_URI: '127.0.0.1',
  DATABASE_NAME: 'TonicLocalDev', DATABASE_USERNAME: 'tonic_local',
  DATABASE_PASSWORD: 'local-test-only', JWT_SECRET: 'local-test-signing-key',
})
require('ts-node/register')
const { readLocalConfig } = require('../src/dev/config')
const { app, AppDataSource } = require('../src/app')

function request(port, route, method = 'GET', headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: route, method, headers }, res => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', chunk => body += chunk)
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }))
    })
    req.on('error', reject)
    req.end()
  })
}

async function main() {
  for (const override of [
    { LOCAL_DEVELOPMENT: 'false' }, { DATABASE_URI: '198.199.65.211' },
    { DATABASE_URI: 'crm.melbournemakerspace.com' }, { DATABASE_NAME: 'TonicProd' },
    { DATABASE_USERNAME: 'root' }, { JWT_SECRET: '' }, { DATABASE_PASSWORD: '' },
  ]) assert.throws(() => readLocalConfig({ ...process.env, ...override }))
  assert.equal(readLocalConfig(process.env).database, process.platform === 'win32' ? 'toniclocaldev' : 'TonicLocalDev')
  const review={...process.env,DATABASE_NAME:'TonicLocalReview',HOST:'127.0.0.1'}
  assert.equal(readLocalConfig(review).dataMode,'imported')
  assert.throws(()=>readLocalConfig({...review,DATABASE_URI:'mysql'}))
  assert.throws(()=>readLocalConfig({...review,HOST:'0.0.0.0'}))

  // TypeORM validates all entity relationships and MySQL column types offline.
  await AppDataSource.buildMetadatas()
  assert.ok(AppDataSource.entityMetadatas.length >= 10)
  assert.equal(AppDataSource.isInitialized, false)

  assert.ok(!AppDataSource.entityMetadatas.some(m=>m.name==='NotificationDraft'))
  const memberMetadata=AppDataSource.entityMetadatas.find(m=>m.name==='Member')
  assert.ok(!memberMetadata.columns.some(c=>/reminder/i.test(c.propertyName)))
  const settingsMetadata=AppDataSource.entityMetadatas.find(m=>m.name==='OperationsSettings')
  assert.ok(!settingsMetadata.columns.some(c=>/reminder|digest/i.test(c.propertyName)))
  const server = await new Promise(resolve => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server))
  })
  try {
    const port = server.address().port
    for (const method of ['GET', 'POST']) {
      assert.equal((await request(port, '/paypal/update', method)).status, 403)
    }
    assert.equal((await request(port, '/paypal/future-route')).status, 403)
    const health = await request(port, '/health')
    assert.equal(health.status, 503)
    assert.equal(JSON.parse(health.body).databaseReady, false)
    const home = await request(port, '/')
    assert.equal(home.status, 200)
    assert.equal(home.headers['content-security-policy'], "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; connect-src 'self'")
    assert.match(home.body, /Cubit/)
    for (const route of ['/memberlist', '/member/demo-id', '/accessLog']) {
      const navigation = await request(port, route, 'GET', { Accept: 'text/html' })
      assert.equal(navigation.status, 200)
      assert.match(navigation.body, /Cubit/)
    }
    const scripts = [...home.body.matchAll(/<script src="([^"]+)"/g)].map(match => match[1])
    // The application builder emits main/polyfills without a separate webpack runtime.
    assert.ok(scripts.some(script => /^main[-.].*\.js$/.test(script)))
    assert.ok(scripts.some(script => /^polyfills[-.].*\.js$/.test(script)))
    for (const script of scripts) {
      const result = await request(port, '/' + script)
      assert.equal(result.status, 200)
      assert.doesNotMatch(result.body, /crm\.melbournemakerspace\.com:5001/)
    }
    assert.equal(AppDataSource.isInitialized, false)
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
  console.log('PASS: local config guards, entity metadata, retired notification schema, PayPal blocking, health and frontend assets. No DB connected.')
}

main().catch(err => { console.error(err); process.exitCode = 1 })
