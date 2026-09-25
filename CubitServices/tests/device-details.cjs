const assert=require('node:assert/strict');
const {deviceDetails}=require('../dist/security/device');
const edge=deviceDetails('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36 Edg/140.0.1','::ffff:192.0.2.1');
assert.deepEqual(edge,{browser:'Edge 140.0.1',os:'Windows',device:'Computer',ip:'192.0.2.1'});
assert.equal(deviceDetails('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Version/18.0 Mobile/15E Safari/604.1','::1').device,'Mobile');
assert.equal(deviceDetails('','untrusted, injected').ip,null);
assert.equal(deviceDetails('x'.repeat(512)+'Chrome/123','').browser,'Unknown browser');
console.log('Device metadata is bounded, handles browser precedence and validates IP addresses.');
