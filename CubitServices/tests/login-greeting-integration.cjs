const assert = require('node:assert/strict')
Object.assign(process.env, {
  LOCAL_DEVELOPMENT: 'true', DATABASE_URI: '127.0.0.1', DATABASE_NAME: 'TonicLocalDev',
  DATABASE_USERNAME: 'tonic_local', DATABASE_PASSWORD: 'test-only', JWT_SECRET: 'test-only-greeting-key',
})
require('ts-node/register')
const { app, AppDataSource } = require('../src/app')
const { Member } = require('../src/entity/member')
const { jwtHelper } = require('../src/api/common/jwtHelper')
require('../src/security/accounts').authenticateSecondFactor = async member => member // MFA/session locking is covered with a disposable database.
require('../src/security/login-history').recordLogin = async () => {} // Persistence is covered by database integration tests.
let lookups = 0
Member.prototype.GetMemberByEmailAndPass = async (email, password) => {
  if (email !== 'noah@example.test' || password !== 'test-password') throw Error('Invalid')
  return { id: 'fixture-member', email, firstName: 'Noah', lastName: 'Fixture', role: 'member' }
}
AppDataSource.getRepository = entity => {
  assert.equal(entity, Member)
  return { findOne: async options => {
    lookups++
    assert.deepEqual(options, {where: {id: 'fixture-member', email: 'noah@example.test'}, select: {firstName: true}})
    return {firstName: 'Noah'}
  } }
}
async function main() {
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)) })
  try {
    const base = `http://127.0.0.1:${server.address().port}`
    const post = (route, body, headers = {}) => fetch(base + route, {method: 'POST', headers: {'Content-Type': 'application/json', ...headers}, body: JSON.stringify(body)})
    const failed = await post('/login', {email: 'noah@example.test', password: 'wrong'})
    assert.equal(failed.status, 401)
    assert.equal(failed.headers.get('set-cookie'), null)
    const success = await post('/login', {email: 'noah@example.test', password: 'test-password'})
    assert.equal(success.status, 200)
    const setCookie = success.headers.get('set-cookie')
    assert.match(setCookie, /HttpOnly/)
    assert.match(setCookie, /SameSite=Strict/)
    assert.match(setCookie, /Path=\/login\/greeting/)
    const cookie = setCookie.split(';')[0]
    assert.throws(() => jwtHelper.ValidateJWT(cookie.split('=')[1]), 'Greeting cookie cannot authorize API access')
    const greeting = await post('/login/greeting', {email: 'noah@example.test'}, {Cookie: cookie})
    assert.deepEqual(await greeting.json(), {firstName: 'Noah'})
    assert.equal(greeting.headers.get('cache-control'), 'no-store')
    const throttled = await post('/login/greeting', {email: 'noah@example.test'}, {Cookie: cookie, 'X-Forwarded-For': '203.0.113.99'})
    assert.deepEqual(await throttled.json(), {firstName: null})
    assert.equal(lookups, 1, 'Spoofing forwarded IP in local mode cannot bypass the limit')
    assert.equal((await post('/login', {email: 'noah@example.test', password: 'test-password'})).status, 200, 'Greeting throttle does not block sign-in')
    assert.equal(AppDataSource.isInitialized, false)
    console.log('PASS: actual login/greeting routes, cookie issued only after authentication, minimal DB selection, IP throttling and JWT separation. No database connected.')
  } finally { await new Promise(resolve => server.close(resolve)) }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
