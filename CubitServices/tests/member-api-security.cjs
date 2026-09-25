const assert=require('node:assert/strict');
module.exports=async({db,request,Member,jwtHelper})=>{
 const {OperationsAudit}=require('../src/entity/cubitOperations');
 const staff=await db.manager.save(Member,db.manager.create(Member,{firstName:'Identity',lastName:'Staff',email:'identity.staff@example.test',paypalEmail:'',role:'staff'}));
 const member=await db.manager.save(Member,db.manager.create(Member,{firstName:'Contact',lastName:'Boundary',email:'identity.member@example.test',paypalEmail:'',role:'member'}));
 const token=jwtHelper.GenerateJWT(staff),memberToken=jwtHelper.GenerateJWT(member);
 assert.equal((await request('/member',null,'GET',token)).status,410);
 const directory=await request('/api/cubit/members?pageSize=10',null,'GET',token);assert.equal(directory.status,200);assert.ok(directory.data.rows.length<=10);
 const profile=await request('/member/'+member.id,null,'GET',token);assert.equal(profile.status,200);
 for(const field of ['password','tokenVersion','staffVersion','loginDisabled','accessHoldReason'])assert.equal(field in profile.data,false,'Unneeded account internals are omitted');
 for(const method of ['PUT','POST'])assert.equal((await request('/member',{id:method==='PUT'?member.id:'New',firstName:'New',lastName:'Fixture',email:'direct.password@example.test',paypalEmail:'',password:'Do-not-accept-this-password'},method,token)).status,400);
 const before=await db.manager.count(OperationsAudit);
 assert.equal((await request('/member',{id:member.id,email:'identity.changed@example.test'},'PUT',token)).status,400);
 assert.equal(await db.manager.count(OperationsAudit),before);
 const changed=await request('/member',{id:member.id,email:'identity.changed@example.test',reason:'Member confirmed the corrected address in person'},'PUT',token);assert.equal(changed.status,200);assert.equal('tokenVersion' in changed.data,false);
 assert.equal((await request('/api/account',null,'GET',memberToken)).status,401);
 const audit=await db.manager.findOneByOrFail(OperationsAudit,{memberId:member.id,kind:'Member details updated'});assert.equal(JSON.parse(audit.detail).reason,'Member confirmed the corrected address in person');
 console.log('PASS: retired bulk member listing, limited profile responses, no direct password writes, reasoned login-email changes and session revocation.');
};
