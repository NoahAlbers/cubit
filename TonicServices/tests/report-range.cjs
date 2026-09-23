require('ts-node/register')
const assert = require('assert/strict')
const { reportRange } = require('../src/billing/reports')

for (const from of ['2013-01-01', '2020-02-29', '2023-01-01']) {
  assert.deepEqual(reportRange({ from, to: '2026-01-01' }), { from, to: '2026-01-01' })
}
assert.deepEqual(reportRange({ from: '2024-02-29', to: '2024-02-29' }), { from: '2024-02-29', to: '2024-02-29' })
for (const query of [
  { from: '2025-02-29', to: '2026-01-01' },
  { from: '2024-02-01', to: '2024-01-31' },
  { from: '2024-01-01', to: '9999-12-31' },
  { from: 'invalid', to: '2026-01-01' },
]) assert.throws(() => reportRange(query), error => error.status === 400)
console.log('PASS: multi-year report ranges, leap dates, single-day ranges, reversed and future-date validation.')
