// Exercises the built Angular login with fictional responses, never a real database.
// Set PLAYWRIGHT_MODULE to the installed Playwright package if it is not on NODE_PATH.
const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '../CubitWeb/node_modules/playwright')
const express = require('../CubitServices/node_modules/express')
const app = express()
app.use(express.json())
let greetingCalls = 0, loginCalls = 0, greetingDelay = 0, greetingName = 'Noah', greetingError = false
app.get('/health', (req, res) => res.json({mode: 'test', dataMode: 'demo'}))
app.post('/login/greeting', (req, res) => {
  greetingCalls++
  setTimeout(() => res.status(greetingError ? 503 : 200).json({firstName: greetingName}), greetingDelay)
})
app.post('/login', (req, res) => {
  loginCalls++
  setTimeout(() => res.status(401).json({message: 'Invalid email or password.'}), 750)
})
app.use(express.static(path.resolve(__dirname, '../CubitWeb/dist')))

async function main() {
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)) })
  let browser
  try {
    browser = await chromium.launch({headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? {channel: process.env.PLAYWRIGHT_CHANNEL} : {})})
    const page = await browser.newPage({viewport: {width: 1915, height: 940}})
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const base = `http://127.0.0.1:${server.address().port}`
    await page.route('**/*', route => route.request().url().startsWith(base + '/') ? route.continue() : route.abort())
    const out = path.resolve(__dirname, '../tmp/login-review')
    fs.mkdirSync(out, {recursive: true})
    await page.goto(base)
    const submit = page.locator('.submit'), email = page.locator('#email'), password = page.locator('#password')
    await submit.waitFor()
    assert.equal(await submit.isDisabled(), true)
    assert.equal(await submit.locator('app-arrow').count(), 0)
    await submit.hover({force: true})
    assert.equal(await submit.evaluate(el => getComputedStyle(el).cursor), 'not-allowed')
    assert.equal(await page.locator('.signing-spinner').count(), 0)
    assert.equal(await page.locator('.help').innerText(), 'Need access or a password reset? Contact staff here.')
    assert.equal(await page.locator('.help a').getAttribute('href'), 'mailto:webmaster@melbournemakerspace.org?subject=Cubit%20sign-in%20help')
    await page.screenshot({path: path.join(out, 'desktop-empty.png')})
    await email.fill('not-an-email')
    await password.fill('fictional-password')
    assert.equal(await submit.isDisabled(), true)
    assert.equal(greetingCalls, 0)
    await email.fill('noah@example.test')
    await password.focus()
    await page.waitForFunction(() => document.querySelector('#welcome').textContent.includes('Noah'))
    assert.equal(greetingCalls, 1)
    assert.equal(await submit.isEnabled(), true)
    assert.equal(await submit.locator('app-arrow').count(), 1)
    await page.waitForTimeout(250)
    await page.screenshot({path: path.join(out, 'desktop-ready.png')})
    await page.setViewportSize({width: 390, height: 844})
    await page.screenshot({path: path.join(out, 'mobile-ready.png'), fullPage: true})
    for (const width of [320, 390, 768, 1024, 1915, 2560]) {
      await page.setViewportSize({width, height: 940})
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Horizontal overflow at ${width}px`)
    }
    await submit.click()
    await page.locator('.signing-spinner').waitFor()
    assert.equal(await submit.isDisabled(), true)
    assert.equal(await submit.locator('app-arrow').count(), 0)
    assert.equal(await submit.evaluate(el => getComputedStyle(el).cursor), 'wait')
    await password.press('Enter')
    await page.locator('.notice.error').waitFor()
    assert.equal(loginCalls, 1, 'Repeated submission is blocked')
    assert.equal(await submit.isEnabled(), true)
    await email.fill('changed@example.test')
    await password.focus()
    assert.equal(await page.locator('#welcome').innerText(), 'Welcome back.')
    await email.fill('noah@example.test')
    await password.focus()
    assert.equal(greetingCalls, 1, 'Editing and restoring email never re-queries')
    assert.equal(await page.locator('#welcome').innerText(), 'Welcome back.')

    greetingDelay = 400
    await page.reload()
    await email.fill('noah@example.test')
    const greetingStarted = page.waitForRequest(request => request.url().endsWith('/login/greeting'))
    await password.focus()
    await greetingStarted
    await email.fill('changed@example.test')
    await page.waitForTimeout(550)
    assert.equal(await page.locator('#welcome').innerText(), 'Welcome back.', 'Stale response cannot restore a name')

    greetingDelay = 0; greetingName = null
    await page.reload()
    await email.fill('unknown@example.test')
    await password.focus()
    await page.waitForTimeout(150)
    assert.equal(await page.locator('#welcome').innerText(), 'Welcome back.')
    greetingError = true
    await page.reload()
    await email.fill('noah@example.test')
    await password.fill('fictional-password')
    await page.waitForTimeout(150)
    assert.equal(await submit.isEnabled(), true, 'Greeting failure does not block login')
    assert.equal(await page.locator('.notice.error').count(), 0)

    await page.emulateMedia({reducedMotion: 'reduce'})
    await page.clock.install()
    await page.reload()
    await page.clock.runFor(17000)
    assert.equal(await page.locator('.story-word').innerText(), 'make')
    await page.emulateMedia({reducedMotion: 'no-preference'})
    await page.reload()
    await page.locator('.story-word').waitFor()
    await page.clock.runFor(8500)
    assert.equal(await page.locator('.story-word').innerText(), 'build')
    await page.clock.runFor(8000)
    assert.equal(await page.locator('.story-word').innerText(), 'fix')
    await page.emulateMedia({reducedMotion: 'reduce'})
    await page.waitForTimeout(100)
    await page.clock.runFor(17000)
    assert.equal(await page.locator('.story-word').innerText(), 'make', 'Changing motion preference stops and resets the headline')
    assert.deepEqual(errors, [])
    console.log('PASS: disabled/ready/pending/retry states, one-shot greeting, stale-response cancellation, anonymous/error fallback, reduced motion, rotating copy and 320–2560px widths. Screenshots: tmp/login-review.')
  } finally {
    if (browser) await browser.close()
    await new Promise(resolve => server.close(resolve))
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
