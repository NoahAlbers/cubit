const assert=require('node:assert/strict');
Object.assign(process.env,{CUBIT_MODE:'hosted-review',LOCAL_DEVELOPMENT:'false',DATABASE_URI:'127.0.0.1',DATABASE_NAME:'cubit_review',DATABASE_USERNAME:'cubit_app',DATABASE_PASSWORD:'synthetic',JWT_SECRET:'x'.repeat(48),HOST:'127.0.0.1',AUDIT_VAULT_URL:'https://archive.example/archive',AUDIT_VAULT_READ_TOKEN:'synthetic-read-only'});
require('ts-node/register');
const {localConfig}=require('../src/dev/config');const {AppDataSource}=require('../src/database');const {vaultConfigured,archivedAudit,vaultRequest}=require('../src/staff/vault');
(async()=>{
  const original=global.fetch,manager=AppDataSource.manager.findOneBy;let requested;
  try{
    global.fetch=async(url,options)=>{requested={url,options};return {ok:true,json:async()=>({rows:[{id:'synthetic-id',createdAt:'2026-09-25T00:00:00Z',author:'Fixture',kind:'Updated',memberName:'Test Member',detail:JSON.stringify({version:1,before:{phone:'111'},after:{phone:'222'}}),archiveHash:'test-hash',archiveSequence:1}],total:1,page:1,pages:1,pageSize:20,authors:['Fixture'],kinds:['Updated']})};};
    AppDataSource.manager.findOneBy=async()=>({heartbeat:new Date(),detail:JSON.stringify({ok:true,pending:2,lastSyncedAt:'2026-09-25T00:00:00Z'})});
    const result=await archivedAudit({from:'2026-09-01',to:'2026-09-25',actor:'staff',q:'100%'});
    assert.equal(result.archive.source,'vault');assert.equal(result.archive.pending,2);assert.equal(result.archive.deliveryHealthy,true);
    assert.equal(result.rows[0].changes[0].after,'222');assert.equal(result.rows[0].archiveHash,'test-hash');assert.equal(result.rows[0].detail,undefined);
    assert.ok(requested.url.startsWith('https://archive.example/archive/audit?'));
    assert.equal(new URL(requested.url).searchParams.get('from'),'2026-09-01T04:00:00.000Z');
    assert.equal(new URL(requested.url).searchParams.get('to'),'2026-09-26T04:00:00.000Z');
    assert.equal(requested.options.headers.Authorization,'Bearer synthetic-read-only');assert.equal(requested.options.redirect,'error');
    for(const mode of ['hosted-demo','local']){localConfig.runtimeMode=mode;assert.equal(vaultConfigured(),false);await assert.rejects(vaultRequest('/audit'),/not configured/);}
    localConfig.runtimeMode='hosted-review';global.fetch=async()=>({ok:false});await assert.rejects(archivedAudit({}),/unavailable/);
    process.env.AUDIT_VAULT_URL='http://archive.example';await assert.rejects(vaultRequest('/audit'),/Invalid archive/);
    console.log('PASS: archived audit mapping, organization dates, read-only credentials, network failures and demo/local isolation.');
  }finally{global.fetch=original;AppDataSource.manager.findOneBy=manager;}
})().catch(e=>{console.error(e);process.exitCode=1;});
