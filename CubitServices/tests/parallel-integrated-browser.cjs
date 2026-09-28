// Only invoked by the isolated database suite; all business requests reach the real adapter.
const assert = require('node:assert/strict');
module.exports = async ({base, token, member, snapshot}) => {
  assert.equal(new URL(base).hostname, '127.0.0.1');
  assert.equal(process.env.CUBIT_TEST_EMPTY_DATABASE, 'yes');
  const reader = require('../src/parallel/reader'), original = reader.readParallel, required=process.env.PARALLEL_REQUIRED;
  reader.readParallel = async callback => callback({query: async () => [[]]}, {
    id: snapshot.id, sourceTime: snapshot.sourceTime.slice(0,19).replace('T',' '),
    importedAt: snapshot.sourceTime.slice(0,19).replace('T',' '), counts: snapshot.counts, changes: {},
  });
  const {chromium} = require(process.env.PLAYWRIGHT_MODULE || '../../CubitWeb/node_modules/playwright');
  const browser = await chromium.launch({headless:true, ...(process.env.PLAYWRIGHT_CHANNEL ? {channel:process.env.PLAYWRIGHT_CHANNEL}: {})});
  try {
    const context = await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    await context.route('**/*', route => route.request().url().startsWith(base+'/') ? route.continue() : route.abort());
    await context.addInitScript(token => sessionStorage.setItem('cubit-token',token), token);
    const page = await context.newPage(), errors=[];
    page.on('pageerror', error=>errors.push(error.message));
    await page.goto(base+'/memberlist');
    await page.locator('.directory-desktop .member-name').filter({hasText:'Demo Person'}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Add member',exact:true}).count(),0);
    await page.locator('.directory-desktop .member-name').filter({hasText:'Demo Person'}).waitFor();
    await page.locator('.directory-desktop .member-name').filter({hasText:'Demo Person'}).click();
    await page.waitForFunction(()=>document.querySelector('input[formcontrolname=email]')?.value==='demo@example.test');
    assert.equal(await page.locator('input[formcontrolname=email]').isDisabled(),true);
    assert.equal(await page.getByRole('button',{name:'Record payment',exact:true}).count(),0);
    assert.equal(await page.getByRole('button',{name:'Save contact details',exact:true}).count(),0);
    for(const width of [1440,390]){
      await page.setViewportSize({width,height:1000});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'Profile fits viewport');
    }
    await page.setViewportSize({width:1440,height:1000});
    assert.ok((await page.locator('.sidebar').boundingBox()).width<=250, 'Desktop sidebar retains its width');
    if(process.env.CUBIT_TEST_SCREENSHOTS){await page.screenshot({path:process.env.CUBIT_TEST_SCREENSHOTS+'/parallel-profile.png',fullPage:true});}
    await page.goto(base+'/reports?from=2026-08-01&to=2026-09-01');
    await page.getByText('Current Membership Status',{exact:true}).waitFor();
    assert.ok((await page.locator('main').innerText()).includes('$60.00'));
    if(process.env.CUBIT_TEST_SCREENSHOTS){await page.screenshot({path:process.env.CUBIT_TEST_SCREENSHOTS+'/parallel-reports.png',fullPage:true});}
    await page.goto(base+'/waivers');
    await page.getByText('Not available from this feed',{exact:true}).waitFor();
    await page.getByRole('combobox',{name:'Data workspace'}).selectOption('review');
    await page.waitForFunction(()=>sessionStorage.getItem('cubit.workspace')==='review');
    await page.goto(base+'/member/'+member.id);
    await page.waitForFunction(email=>document.querySelector('input[formcontrolname=email]')?.value===email,member.email);
    assert.equal(await page.locator('input[formcontrolname=email]').isDisabled(),false);
    process.env.PARALLEL_REQUIRED='true';
    await page.goto(base+'/memberlist');
    await page.locator('.directory-desktop .member-name').filter({hasText:'Demo Person'}).waitFor();
    assert.equal(await page.getByRole('combobox',{name:'Data workspace'}).count(),0,'Retired review cannot be selected');
    if(process.env.CUBIT_TEST_SCREENSHOTS)await page.screenshot({path:process.env.CUBIT_TEST_SCREENSHOTS+'/parallel-members.png',fullPage:true});
    assert.deepEqual(errors,[],'No browser errors during source/review navigation');
    console.log('PASS: parallel Members/profile/reports/unavailable-data screens, responsive layout, disabled edits and explicit review switch in browser.');
  } finally {reader.readParallel=original;if(required===undefined)delete process.env.PARALLEL_REQUIRED;else process.env.PARALLEL_REQUIRED=required;await browser.close();}
};
