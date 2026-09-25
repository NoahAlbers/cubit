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
    await page.getByText('Unsaved contact changes', {exact: true}).waitFor()
    assert.equal(await page.locator('input[formcontrolname=phone]').getAttribute('aria-description'), 'Unsaved change')
    assert.equal(await page.getByRole('button', {name: 'Overview', exact: true}).count(), 0)
    assert.equal(await page.locator('.profile-contact-actions button.save-pending').count(), 1)
    const saved = page.waitForResponse(r => r.url().endsWith('/member') && r.request().method() === 'PUT')
    await page.getByRole('button', {name: 'Save contact details', exact: true}).click()
    assert.equal((await saved).status(), 200)
    await page.getByText('Contact details saved', {exact: true}).waitFor()
    assert.equal(await page.getByRole('button', {name: 'Save contact details', exact: true}).isDisabled(), true)
    assert.equal(await page.locator('.contact-changed').count(), 0)
    for (const width of [390, 1280]) {
      await page.setViewportSize({width, height: 900})
      const layout = await page.evaluate(() => {
        const input = document.querySelector('input[formcontrolname=phone]'), copy = input.parentElement.querySelector('button')
        const a = input.getBoundingClientRect(), b = copy.getBoundingClientRect()
        const save = document.querySelector('.profile-contact-actions').getBoundingClientRect()
        return {copyInside: b.left >= a.left && b.right <= a.right && b.top >= a.top && b.bottom <= a.bottom, actionsInside: save.left >= 0 && save.right <= innerWidth}
      })
      assert.deepEqual(layout, {copyInside:true, actionsInside:true}, `Profile controls fit at ${width}px`)
    }
    await page.setViewportSize({width: 1440, height: 1000})
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
    await page.goto(base+'/reports');await page.waitForLoadState('networkidle');
    const unique=page.getByRole('button',{name:'Unique Check-Ins',exact:true});await unique.scrollIntoViewIfNeeded();
    await unique.evaluate(el=>window.scrollTo(0,Math.max(100,el.getBoundingClientRect().top+window.scrollY-300)));
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const initialY=await page.evaluate(()=>window.scrollY);
    assert.ok(initialY>0,'Scroll regression exercises a position below the page top');
    await page.evaluate(()=>{window.__reportScrolls=[];window.addEventListener('scroll',()=>window.__reportScrolls.push(window.scrollY));});
    let reportFetches=0;const countReport=r=>{if(new URL(r.url()).pathname==='/api/cubit/reports')reportFetches++;};page.on('request',countReport);
    await unique.click();await page.waitForURL(u=>u.searchParams.get('checkins')==='unique');
    await page.getByRole('button',{name:'Total Check-Ins',exact:true}).click();await page.waitForURL(u=>u.searchParams.get('checkins')==='total');
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.equal(reportFetches,0,'View toggles do not refetch reports');
    assert.ok((await page.evaluate(()=>window.__reportScrolls)).every(y=>Math.abs(y-initialY)<3),'View toggles never jump to the top');page.off('request',countReport);
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
    // Create an authenticator fixture only in this disposable database.
    const {AppDataSource:db}=require('../CubitServices/src/database'),{Member}=require('../CubitServices/src/entity/member');
    const {AccountMfa}=require('../CubitServices/src/entity/accountSecurity'),{encryptSecret}=require('../CubitServices/src/security/accounts');
    const otpLib=require('../CubitServices/node_modules/otpauth'),crypto=require('node:crypto');
    const otp=new otpLib.TOTP({secret:new otpLib.Secret({size:20})});
    const mfa=await db.manager.save(Member,db.manager.create(Member,{firstName:'Browser MFA',lastName:'Fixture',email:'browser.mfa@example.test',paypalEmail:'browser.mfa@example.test',role:'admin',password:staff.password}));
    await db.manager.save(AccountMfa,{memberId:mfa.id,secret:encryptSecret(otp.secret.base32,mfa.id),lastStep:'-1',recoveryHashes:'[]'});
    const mfaContext=await browser.newContext({viewport:{width:1360,height:900}});
    await mfaContext.route('**/*',route=>route.request().url().startsWith(base+'/')?route.continue():route.abort());
    let mfaPage=await mfaContext.newPage();
    async function credentials(){await mfaPage.goto(base);await mfaPage.locator('#email').fill(mfa.email);await mfaPage.locator('#password').fill(password);await mfaPage.getByRole('button',{name:'Sign in',exact:true}).click();}
    await credentials();await mfaPage.locator('#code').waitFor();
    assert.equal(await mfaPage.locator('#email').count(),0);assert.equal(await mfaPage.locator('#password').count(),0);
    assert.match(await mfaPage.locator('label[for=code]').innerText(),/6 digits/);
    const output=require('node:path').resolve(__dirname,'../.private/verification');require('node:fs').mkdirSync(output,{recursive:true});
    await mfaPage.screenshot({path:output+'/mfa-step.png'});
    await mfaPage.locator('#code').fill(otp.generate());await mfaPage.getByRole('button',{name:'Verify code',exact:true}).click();
    await mfaPage.getByRole('button',{name:'Trust for 30 days',exact:true}).waitFor();
    assert.equal(await mfaPage.locator('.sidebar').count(),0,'Trust prompt stays in the sign-in layout');
    await mfaPage.screenshot({path:output+'/trust-prompt.png'});
    await mfaPage.getByRole('button',{name:'Trust for 30 days',exact:true}).click();await mfaPage.waitForURL('**/memberlist*');
    await mfaPage.close();mfaPage=await mfaContext.newPage();await credentials();await mfaPage.waitForURL('**/memberlist*');
    assert.equal(await mfaPage.locator('#code').count(),0,'A recognized browser still enters a password but skips MFA');
    await mfaPage.goto(base+'/account/security');await mfaPage.getByRole('button',{name:'Forget all trusted computers',exact:true}).click();await mfaPage.getByRole('button',{name:'Forget computers and sign out',exact:true}).click();await mfaPage.locator('#email').waitFor();
    await credentials();await mfaPage.locator('#code').waitFor();await mfaContext.close();
    assert.deepEqual(errors, [], 'No uncaught browser errors')
    console.log('PASS: report toggles keep scroll without refetch, isolated MFA screen, opt-in trust prompt, recognized-browser login and revoke-all challenge.')
    console.log('PASS: synthetic staff/member login, all main screens, profile/audit/list return context, real identicons, database-backed contact saves and member routing isolation.')
  } finally {await browser.close()}
}
