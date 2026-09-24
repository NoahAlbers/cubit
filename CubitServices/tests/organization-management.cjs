const assert=require('assert/strict');
module.exports=async({request,db,administrator,member})=>{
  const {Member}=require('../src/entity/member'),{OperationsAudit}=require('../src/entity/cubitOperations'),{jwtHelper}=require('../src/api/common/jwtHelper');
  const fresh=async id=>jwtHelper.GenerateJWT(await db.manager.findOneByOrFail(Member,{id}));
  const adminToken=await fresh(administrator.id),memberToken=await fresh(member.id);
  async function ok(path,body,method,token=adminToken){const r=await request(path,body,method,token);assert.ok(r.status>=200&&r.status<300,`${path}: ${r.status} ${JSON.stringify(r.data)}`);return r.data;}
  const publicSettings=await ok('/api/organization/public',null,'GET',null);assert.deepEqual(Object.keys(publicSettings).sort(),['name','supportEmail']);
  assert.equal((await request('/api/organization',null,'GET',null)).status,401);
  assert.equal((await request('/api/organization',null,'GET',memberToken)).status,403);
  const initial=await ok('/api/organization');
  let settings=await ok('/api/organization/settings',{name:'Synthetic Community Lab',supportEmail:'help@community.example',revision:initial.settings.revision},'PUT');
  assert.equal((await ok('/api/organization/public',null,'GET',null)).name,'Synthetic Community Lab');
  assert.equal((await request('/api/organization/settings',{name:'Old',supportEmail:'help@example.test',revision:initial.settings.revision},'PUT',adminToken)).status,409);
  assert.equal((await request('/api/organization/settings',{name:'Invalid',supportEmail:'invalid',revision:settings.revision},'PUT',adminToken)).status,400);
  const person=await ok('/api/organization/staff',{firstName:'Limited',lastName:'Staff',email:'limited.staff@example.test',role:'staff'},'POST');
  assert.equal(person.hasPassword,false);assert.ok(!('password'in person));
  assert.equal((await request('/api/organization/staff',{firstName:'Duplicate',lastName:'Staff',email:person.email,role:'staff'},'POST',adminToken)).status,409);
  const staffToken=await fresh(person.id);
  for(const path of ['/api/cubit/audit','/api/cubit/plan-catalog','/api/waivers','/api/cubit/staff/preferences','/api/account'])assert.equal((await request(path,null,'GET',staffToken)).status,200,`${path} is available to Staff User`);
  for(const [path,body,method] of [
    ['/api/organization',null,'GET'],['/api/organization/candidates?q=fixture',null,'GET'],
    ['/api/organization/settings',{name:'Unauthorized',supportEmail:'evil@example.test',revision:settings.revision},'PUT'],
    ['/api/organization/staff',{firstName:'Bad',lastName:'Create',email:'bad.create@example.test',role:'admin'},'POST'],
    ['/member',{id:person.id,role:'admin'},'PUT'],['/member',{id:member.id,role:'staff'},'PUT'],
    ['/member',{id:administrator.id,email:'changed.admin@example.test'},'PUT'],
    ['/member',{id:administrator.id,password:'staff-cannot-reset-an-administrator'},'PUT'],
    ['/api/account/members/'+administrator.id+'/link',{purpose:'reset'},'POST'],
    ['/api/account/members/'+person.id+'/link',{purpose:'invite'},'POST'],
  ])assert.equal((await request(path,body,method,staffToken)).status,403,`${path} must not let Staff Users manage staff`);
  assert.equal((await request('/member',{id:member.id,phone:'321-555-0119'},'PUT',staffToken)).status,200);
  assert.equal((await request('/api/account/members/'+member.id+'/link',{purpose:'invite'},'POST',staffToken)).status,201,'Staff may invite ordinary members');
  const selfUpdate={firstName:administrator.firstName,lastName:administrator.lastName,email:administrator.email,role:'member',loginDisabled:false,staffVersion:0,reason:'Do not remove your own administrative access'};
  assert.equal((await request('/api/organization/staff/'+administrator.id,selfUpdate,'PUT',adminToken)).status,409);
  assert.equal((await request('/member',{id:administrator.id,role:'member'},'PUT',adminToken)).status,409,'Old profile route also protects self-demotion');
  let managed=await ok('/api/organization/staff/'+person.id,{firstName:person.firstName,lastName:person.lastName,email:person.email,role:'admin',loginDisabled:false,staffVersion:person.staffVersion,reason:'Synthetic promotion'},'PUT');
  assert.equal((await request('/api/cubit/audit',null,'GET',staffToken)).status,401,'Role changes revoke existing sessions');
  assert.equal((await request('/api/organization',null,'GET',await fresh(person.id))).status,200);
  assert.equal((await request('/api/organization/staff/'+person.id,{...selfUpdate,email:person.email,staffVersion:person.staffVersion},'PUT',adminToken)).status,409,'Stale administrative changes are rejected');
  managed=await ok('/api/organization/staff/'+person.id,{firstName:person.firstName,lastName:person.lastName,email:person.email,role:'staff',loginDisabled:true,staffVersion:managed.staffVersion,reason:'Disable synthetic staff'},'PUT');
  assert.equal((await request('/api/cubit/audit',null,'GET',await fresh(person.id))).status,401,'Disabled staff cannot sign in');
  const candidates=await ok('/api/organization/candidates?q='+encodeURIComponent(member.email));assert.ok(candidates.rows.some(m=>m.id===member.id));assert.ok(candidates.rows.every(m=>!('password'in m)));
  const memberBefore=await db.manager.findOneByOrFail(Member,{id:member.id});
  await ok('/api/organization/staff/'+member.id,{firstName:memberBefore.firstName,lastName:memberBefore.lastName,email:memberBefore.email,role:'staff',loginDisabled:false,staffVersion:memberBefore.staffVersion,reason:'Grant existing member access'},'PUT');
  assert.equal((await db.manager.findOneByOrFail(Member,{id:member.id})).role,'staff');
  const current=await db.manager.findOneByOrFail(Member,{id:member.id});await ok('/api/organization/staff/'+member.id,{firstName:current.firstName,lastName:current.lastName,email:current.email,role:'member',loginDisabled:false,staffVersion:current.staffVersion,reason:'Restore member fixture'},'PUT');
  await ok('/api/organization/settings',{name:initial.settings.name,supportEmail:initial.settings.supportEmail,revision:settings.revision},'PUT');
  Object.assign(member,await db.manager.findOneByOrFail(Member,{id:member.id}));
  assert.ok(await db.manager.countBy(OperationsAudit,{kind:'Staff account updated'}));
  console.log('PASS: organization branding, support email, private staff inventory, role boundaries, legacy-route protection, invitations, revocation, disabled logins, stale edits and self-demotion protection.');
};
