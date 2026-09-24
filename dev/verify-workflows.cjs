// Called only by billing-tools-db.cjs against its disposable synthetic database.
const assert = require('node:assert/strict')
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || '../CubitWeb/node_modules/playwright')

module.exports = async function verifyWorkflows({base, staff, member, password}) {
  assert.equal(process.env.CUBIT_TEST_EMPTY_DATABASE, 'yes')
  assert.equal(process.env.CUBIT_MODE, 'hosted-demo')
  assert.equal(process.env.DATABASE_NAME, 'cubit_demo')
  assert.equal(new URL(base).hostname, '127.0.0.1')
  const browser = await chromium.launch({headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? {channel: process.env.PLAYWRIGHT_CHANNEL} : {})})
  const errors = []
  try {
    const context = await browser.newContext({viewport: {width: 1440, height: 1000}, reducedMotion: 'reduce'})
    await context.route('**/*', route => route.request().url().startsWith(base + '/') ? route.continue() : route.abort())
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
    async function login(account) {
      await page.goto(base)
      await page.locator('#email').fill(account.email)
      await page.locator('#password').fill(password)
      await page.locator('button[type=submit]').click()
      await page.waitForURL(account.role === 'admin' ? '**/memberlist*' : '**/portal')
    }
    await login(staff)
    const searched = page.waitForResponse(r => new URL(r.url()).pathname === '/api/cubit/members' && new URL(r.url()).searchParams.get('q') === member.email)
    await page.getByRole('searchbox', {name: 'Search members'}).fill(member.email)
    assert.equal((await searched).status(), 200)
    await page.waitForURL(url => url.searchParams.get('q') === member.email)
    const memberLink = page.locator('.directory-desktop .member-name').filter({hasText: 'Browser Member'})
    await memberLink.waitFor()
    assert.equal(await page.locator('.directory-desktop .member-identicon path').count() > 0, true, 'Real browser renders identicons')
    const directoryUrl = page.url()
    await memberLink.click()
    await page.locator('input[formcontrolname=phone]').fill('321-555-0110')
    const saved = page.waitForResponse(r => r.url().endsWith('/member') && r.request().method() === 'PUT')
    await page.getByRole('button', {name: 'Save contact details', exact: true}).click()
    assert.equal((await saved).status(), 200)
    await page.getByText('Contact details saved', {exact: true}).waitFor()
    await page.getByRole('link', {name: 'Audit log for Browser Member'}).click()
    await page.getByRole('link', {name: 'Back to Browser Member', exact: true}).click()
    await page.getByRole('link', {name: 'Back to Members', exact: true}).click()
    await page.waitForURL(directoryUrl)
    assert.equal(await page.getByRole('searchbox', {name: 'Search members'}).inputValue(), member.email)

    // Read every staff area; provider connections remain disabled in the demo config.
    for (const route of ['/overdue', '/payments', '/accessLog', '/audit', '/reports', '/automation', '/plans', '/waivers', '/staff/settings', '/account/security']) {
      await page.goto(base + route)
      await page.locator('main').waitFor()
      await page.waitForLoadState('networkidle')
      assert.equal(await page.locator('main app-loading').count(), 0, `${route} finished loading`)
      assert.equal(await page.locator('main [role=alert]').count(), 0, `${route} has no load error`)
    }
    await page.getByRole('button', {name: 'Sign out', exact: true}).click()
    await page.locator('#email').waitFor()
    await login(member)
    for (const route of ['/portal', '/portal/billing', '/portal/waivers', '/portal/profile']) {
      await page.goto(base + route)
      await page.waitForLoadState('networkidle')
      assert.equal(await page.locator('main app-loading').count(), 0)
      assert.equal(await page.locator('main [role=alert]').count(), 0)
    }
    assert.equal(await page.locator('input[name=phone]').inputValue(), '321-555-0110', 'Staff save reaches the member portal through the database')
    await page.locator('input[name=emergencyContact]').fill('Browser Emergency Fixture')
    const portalSave = page.waitForResponse(r => r.url().endsWith('/api/portal/profile') && r.request().method() === 'PUT')
    await page.getByRole('button', {name: 'Save contact details', exact: true}).click()
    assert.equal((await portalSave).status(), 200)
    await page.reload()
    await page.waitForLoadState('networkidle')
    assert.equal(await page.locator('input[name=emergencyContact]').inputValue(), 'Browser Emergency Fixture')
    await page.goto(base + '/memberlist')
    await page.waitForURL('**/portal')
    assert.deepEqual(errors, [], 'No uncaught browser errors')
    console.log('PASS: synthetic staff/member login, all main screens, profile/audit/list return context, real identicons, database-backed contact saves and member routing isolation.')
  } finally {await browser.close()}
}
