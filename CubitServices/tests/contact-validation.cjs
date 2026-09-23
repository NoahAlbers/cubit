const assert=require('assert/strict'),fs=require('fs');
require('ts-node/register');
const {validEmail,formatPhone,normalizeContact}=require('../src/contact/validation');
// Keep the browser and server's syntax rules identical.
assert.equal(fs.readFileSync('../CubitWeb/src/app/services/contact-format.ts','utf8').trim(),fs.readFileSync('src/contact/validation.ts','utf8').split('export function normalizeContact')[0].trim());
for(const value of ['member@example.com','member+tag@sub.example.org',"o'brien@example.test",' MEMBER@example.com '])assert.equal(validEmail(value),true,value);
for(const value of ['a@localhost','a..b@example.com','.a@example.com','a.@example.com','a@-bad.com','a@bad-.com','a@bad..com','a b@example.com','a@example.com,other@example.com','a@@example.com','<a>@example.com','a'.repeat(65)+'@example.com',null,123])assert.equal(validEmail(value),false,String(value));
for(const value of ['3215550123','(321) 555-0123','321.555.0123','+1 (321) 555-0123','13215550123'])assert.equal(formatPhone(value),'321-555-0123');
for(const value of ['555-0123','123-555-0123','321-155-0123','321-555-0123 x42','321CALLNOW','+44 20 7946 0958','32155501234',1234567890])assert.equal(formatPhone(value),null);
for(const value of ['',null,undefined,'   '])assert.equal(formatPhone(value),'');
const values=normalizeContact({firstName:' Test ',lastName:' Person ',email:' Test@Example.com ',paypalEmail:'',emergencyEmail:null,phone:'(321)555-0123',emergencyPhone:''},true);
assert.equal(values.email,'test@example.com');assert.equal(values.phone,'321-555-0123');assert.equal(values.emergencyEmail,'');
for(const data of [{email:''},{email:'bad'},{paypalEmail:'bad'},{emergencyEmail:'bad'},{phone:'321'},{emergencyPhone:'5550123'},{firstName:' '}])assert.throws(()=>normalizeContact(data),e=>e.status===400);
assert.throws(()=>normalizeContact({firstName:'Test',lastName:'Person'},true),e=>e.status===400);
assert.deepEqual(normalizeContact({phone:null}),{phone:''});
console.log('PASS: shared email syntax, US phone normalization, optional contacts, malformed input and required identity validation.');
