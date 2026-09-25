const assert=require('node:assert/strict');
module.exports=async({db,request,Member,staff})=>{
 const accounts=require('../src/security/accounts'),{AccountThrottle}=require('../src/entity/accountThrottle');
 const member=await db.manager.save(Member,db.manager.create(Member,{firstName:'Throttle',lastName:'Fixture',email:'mfa.throttle@example.test',paypalEmail:'',role:'admin',password:await require('bcrypt').hash('Synthetic-throttle-password',12)}));
 const start=await accounts.beginMfa(member.id,'Synthetic-throttle-password');
 const codes=await accounts.confirmMfa(member.id,'Synthetic-throttle-password',new (require('otpauth').TOTP)({secret:start.secret}).generate());
 Object.assign(member,await db.manager.findOneByOrFail(Member,{id:member.id}));
 for(let i=0;i<5;i++)await assert.rejects(accounts.authenticateSecondFactor(member,'not-an-otp'),e=>e.status===401);
 const id='mfa:'+member.id,blocked=await db.manager.findOneByOrFail(AccountThrottle,{id});
 assert.equal(blocked.attempts,5);assert.equal(blocked.level,1);assert.ok(blocked.blockedUntil.getTime()>Date.now()+290000);
 const beforeVersion=member.tokenVersion;
 const reset=await accounts.issueAccountLink(member.id,staff,'reset');
 await assert.rejects(accounts.redeemAccountLink(new URLSearchParams(reset.path.split('#')[1]).get('token'),'Synthetic-new-reset-password',codes.recoveryCodes[0]),e=>e.status===429);
 assert.equal((await db.manager.findOneByOrFail(Member,{id:member.id})).tokenVersion,beforeVersion,'Blocked reset changes no credentials');
 const response=await request('/login',{email:member.email,password:'Synthetic-throttle-password',code:codes.recoveryCodes[0]},'POST',null);assert.equal(response.status,429);
 // A fresh Node process has no in-memory counters but sees the same cooldown.
 const script=`require('ts-node/register');const {AppDataSource:db}=require('./src/database');(async()=>{await db.initialize();try{await require('./src/security/mfa-throttle').reserveMfaAttempt(${JSON.stringify(member.id)});process.exitCode=2}catch(e){if(e.status!==429)throw e}finally{await db.destroy()}})().catch(()=>process.exitCode=3)`;
 const child=require('node:child_process').spawnSync(process.execPath,['-e',script],{cwd:require('node:path').resolve(__dirname,'..'),env:process.env,encoding:'utf8',windowsHide:true});assert.equal(child.status,0,child.stderr);
 await db.manager.update(AccountThrottle,id,{blockedUntil:new Date(Date.now()-1000)});
 await assert.rejects(accounts.authenticateSecondFactor(member,'not-an-otp'),e=>e.status===401);
 const increased=await db.manager.findOneByOrFail(AccountThrottle,{id});assert.equal(increased.level,2);assert.ok(increased.blockedUntil.getTime()>Date.now()+590000);
 await db.manager.update(AccountThrottle,id,{blockedUntil:new Date(Date.now()-1000)});
 await accounts.authenticateSecondFactor(member,codes.recoveryCodes[0]);
 const cleared=await db.manager.findOneByOrFail(AccountThrottle,{id});assert.equal(cleared.attempts,0);assert.equal(cleared.level,0);assert.equal(cleared.blockedUntil,null);
 console.log('PASS: persisted MFA failures, escalating cooldown across sign-in/reset, fresh-process persistence, and successful single-use recovery.');
};
