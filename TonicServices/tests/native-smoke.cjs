// Exercises an already running, seeded LOCAL app. Never accepts another host.
const assert = require('assert/strict')
const http = require('http')

function request(route, { method = 'GET', body, token, accept = 'application/json' } = {}) {
  return new Promise((resolve, reject) => {
    const encoded = body === undefined ? undefined : JSON.stringify(body)
    const headers = { Accept: accept }
    if (encoded) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(encoded) }
    if (token) headers.Authorization = 'Bearer ' + token
    const req = http.request({ hostname: '127.0.0.1', port: 5001, path: route, method, headers }, res => {
      let text = ''
      res.setEncoding('utf8')
      res.on('data', chunk => text += chunk)
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text, json: () => JSON.parse(text) }))
    })
    req.setTimeout(5000, () => req.destroy(new Error('Local request timed out')))
    req.on('error', reject)
    req.end(encoded)
  })
}

async function main() {
  let health
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      health = await request('/health')
      if (health.status === 200) break
    } catch (err) {
      if (attempt === 29) throw err
    }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  assert.ok(health, 'Local Tonic never became ready')
  assert.equal(health.status, 200)
  assert.equal(health.json().mode, 'local-development')
  assert.equal(health.json().databaseReady, true)

  const login = await request('/login', { method: 'POST', body: { email: 'admin@example.test', password: 'LocalDemoOnly!2026' } })
  assert.equal(login.status, 200)
  const { token, member } = login.json()
  assert.equal(member.role, 'admin')
  assert.ok(token)
  const members = (await request('/member', { token })).json()
  assert.ok(members.length >= 75)
  assert.ok(members.every(member => member.email.endsWith('@example.test')))

  const alexId = '20000000-0000-4000-8000-000000000002'
  const alex = (await request('/member/' + alexId, { token })).json()
  const originalPhone = alex.phone
  try {
    const saved = await request('/member', { method: 'PUT', token, body: { ...alex, password: '', phone: '202-555-0199' } })
    assert.equal(saved.status, 200)
    assert.equal((await request('/member/' + alexId, { token })).json().phone, '202-555-0199')
  } finally {
    const restored = await request('/member', { method: 'PUT', token, body: { ...alex, password: '', phone: originalPhone } })
    assert.equal(restored.status, 200)
  }

  assert.equal((await request('/member/balance/' + alexId, { token })).json(), 0)
  assert.equal((await request('/member/plans/' + alexId, { token })).json().length, 1)
  const whitelist = (await request('/ACON/getWhitelist', { token })).json()
  assert.ok(whitelist.some(key => key.serial === 'DEMO00000001'))
  assert.ok(whitelist.some(key => key.serial === 'DEMO00000002'))
  assert.ok(!whitelist.some(key => key.serial === 'DEMO00000003'))
  assert.equal((await request('/paypal/update')).status, 403)
  for (const route of ['/memberlist', '/member/' + alexId, '/accessLog']) {
    const page = await request(route, { accept: 'text/html' })
    assert.equal(page.status, 200)
    assert.match(page.text, /Cubit/)
  }
  console.log('PASS: local login, seeded members, edit/read/restore, balance, plan, whitelist, blocked PayPal and browser navigation redirects.')
}
if (require.main === module) main().catch(err => { console.error(err.message); process.exitCode = 1 })
module.exports = { request }
