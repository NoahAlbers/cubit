const assert=require('node:assert/strict');
module.exports=async({db,base,Member,jwtHelper})=>{
 const {LoginHistory}=require('../src/entity/loginHistory'),{localConfig}=require('../src/dev/config');
 const {recordLogin,loginHistory,approximateLocation}=require('../src/security/login-history');
 const original=localConfig.runtimeMode;
 const member=await db.manager.save(Member,db.manager.create(Member,{firstName:'Login',lastName:'Fixture',email:'login-history@example.test',paypalEmail:'login-history@example.test',role:'admin',password:'unused-hash'}));
 try{
  localConfig.runtimeMode='local';
  const request={ip:'192.0.2.20',get:()=> 'Mozilla/5.0 (Windows NT 10.0) Chrome/140.0'};
  await recordLogin(request,member,true,false);
  let history=await loginHistory(member.id,1);assert.equal(history.total,1);assert.equal(history.rows[0].method,'Trusted computer');assert.equal(history.rows[0].device.ip,'192.0.2.20');assert.equal(history.rows[0].location,null);
  await db.manager.save(LoginHistory,Array.from({length:501},(_,i)=>({memberId:member.id,createdAt:new Date(Date.now()-i*1000),method:'Password',deviceDetails:'{}',location:null})));
  await db.manager.save(LoginHistory,{memberId:member.id,createdAt:new Date(Date.now()-181*86400000),method:'Password',deviceDetails:'{}'});
  await recordLogin(request,member,true,true);
  assert.equal(await db.manager.countBy(LoginHistory,{memberId:member.id}),500);
  const token=jwtHelper.GenerateJWT(member,true);
  const result=await fetch(base+'/api/account/logins?page=999',{headers:{Authorization:'Bearer '+token}});
  history=await result.json();assert.equal(result.status,200);assert.equal(history.page,50);assert.equal(history.rows.length,10);assert.ok(history.rows.every(row=>!('memberId' in row)));
  assert.equal((await fetch(base+'/api/account/logins')).status,401);
  assert.equal((await loginHistory('not-this-account',1)).total,0);
  assert.equal(await approximateLocation(null),null);
  localConfig.runtimeMode='hosted-demo';await recordLogin(request,member,true,false);
  assert.deepEqual(await loginHistory(member.id,1),{rows:[],total:0,page:1,pageSize:10,privateDemo:true});
 }finally{localConfig.runtimeMode=original;await db.manager.delete(LoginHistory,{memberId:member.id});}
 console.log('PASS: own-account sign-in history, pagination, age/volume retention, demo privacy, and optional offline location.');
};
