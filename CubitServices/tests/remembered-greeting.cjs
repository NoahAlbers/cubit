const assert = require('node:assert/strict')
require('ts-node/register')
const { createRememberedGreeting } = require('../src/api/common/remembered-greeting')

let time = 1000000, lookups = 0, record = 'Noah Albers'
const options = {
  secret: 'test-only-secret-not-for-deployment', workspace: 'test', secure: true, now: () => time,
  findFirstName: async (id, email) => {
    lookups++
    assert.equal(id, 'known-member')
    assert.equal(email, 'noah@example.test')
    return record
  },
}
const greeting = createRememberedGreeting(options)
let cookie, cookieOptions
greeting.remember({ cookie: (name, value, opts) => { cookie = `${name}=${value}`; cookieOptions = opts } }, {
  id: 'known-member', email: 'noah@example.test',
})
assert.equal(cookieOptions.httpOnly, true)
assert.equal(cookieOptions.secure, true)
assert.equal(cookieOptions.sameSite, 'strict')
assert.equal(cookieOptions.path, '/login/greeting')
assert.equal(cookieOptions.maxAge, 30 * 86400000)
assert.ok(!cookie.includes('noah'))

async function request({ ip = '1', email = 'noah@example.test', token = cookie, service = greeting } = {}) {
  const result = { headers: {} }
  const res = {
    setHeader: (key, value) => result.headers[key] = value,
    status: value => { result.status = value; return res },
    json: value => { result.body = value; return res },
  }
  await service.greet({ ip, body: { email }, headers: { cookie: token } }, res)
  assert.equal(result.status, 200)
  assert.equal(result.headers['Cache-Control'], 'no-store')
  assert.deepEqual(Object.keys(result.body), ['firstName'])
  return result.body
}

async function main() {
  assert.deepEqual(await request({token: ''}), {firstName: null})
  assert.deepEqual(await request(), {firstName: null}, 'An unsuccessful attempt also consumes the five-minute limit')
  assert.deepEqual(await request({ip: '2', email: 'someone@example.test'}), {firstName: null})
  assert.deepEqual(await request({ip: '3', token: cookie.slice(0, -8) + 'AAAAAAAA'}), {firstName: null})
  assert.equal(lookups, 0, 'Unverified browsers, mismatched emails and tampering cannot query members')
  assert.deepEqual(await request({ip: '4', email: ' NOAH@example.test '}), {firstName: 'Noah'})
  assert.equal(lookups, 1)
  assert.deepEqual(await request({ip: '4'}), {firstName: null})
  time += 299999
  assert.deepEqual(await request({ip: '4'}), {firstName: null})
  assert.equal(lookups, 1)
  time++
  assert.deepEqual(await request({ip: '4'}), {firstName: 'Noah'})
  assert.equal(lookups, 2)
  record = '<img onerror=alert(1)>'
  assert.deepEqual(await request({ip: '5'}), {firstName: null})
  record = 'Élodie-Marie'
  assert.deepEqual(await request({ip: '6'}), {firstName: 'Élodie-Marie'})
  record = null
  assert.deepEqual(await request({ip: '7'}), {firstName: null})
  assert.deepEqual(await request({ip: '8', service: createRememberedGreeting({...options, workspace: 'other'})}), {firstName: null})
  assert.deepEqual(await request({ip: '9', service: createRememberedGreeting({...options, secret: 'rotated'})}), {firstName: null})
  assert.deepEqual(await request({ip: '10', service: createRememberedGreeting({...options, findFirstName: async () => { throw Error('offline') }})}), {firstName: null})
  time += 30 * 86400000
  assert.deepEqual(await request({ip: '11'}), {firstName: null})
  console.log('PASS: remembered-browser binding, encrypted cookie settings, first-name-only response, five-minute IP throttle, expiry, tampering, workspace isolation and silent failure. No database connected.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
