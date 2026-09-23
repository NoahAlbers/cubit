// Verify a long historical report against the local imported dataset only.
const fs = require('fs'), path = require('path'), zlib = require('zlib'), http = require('http'), assert = require('assert/strict')
const folder = path.join(__dirname, '../.private/imports')
const source = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(folder, 'tonic-current-data.json.gz'))))
const credentials = JSON.parse(fs.readFileSync(path.join(folder, 'local-access.json')))
function request(route, token, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined
    const req = http.request({ host: '127.0.0.1', port: 5001, path: route, method: data ? 'POST' : 'GET', headers: {
      Accept: 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {})
    } }, res => { let text = ''; res.setEncoding('utf8'); res.on('data', c => text += c); res.on('end', () => resolve({ status: res.statusCode, text })) })
    req.setTimeout(60000, () => req.destroy(Error('Local report timeout'))); req.on('error', reject); req.end(data)
  })
}
async function main() {
  const health = await request('/health'); assert.equal(health.status, 200); assert.equal(JSON.parse(health.text).dataMode, 'imported')
  const login = await request('/login', null, credentials.staff); assert.equal(login.status, 200)
  const token = JSON.parse(login.text).token, from = '2021-01-01', to = source.source.snapshotUtc.slice(0, 10)
  const started = Date.now(), result = await request('/api/cubit/reports?from=' + from + '&to=' + to, token)
  assert.equal(result.status, 200, result.status === 200 ? '' : 'Historical reports request failed')
  const report = JSON.parse(result.text)
  assert.equal(report.months.length, (Number(to.slice(0, 4)) - 2021) * 12 + Number(to.slice(5, 7)))
  assert.equal(report.months[0].month, '2021-01'); assert.equal(report.months.at(-1).month, to.slice(0, 7))
  const total = source.tables.transaction.filter(p => p.transactionDate.slice(0, 10) >= from && p.transactionDate.slice(0, 10) <= to).reduce((n, p) => n + Math.round(Number(p.amount) * 100), 0)
  assert.equal(Math.round(report.summary.netPayments * 100), total)
  assert.equal(report.months.reduce((n, m) => n + Math.round(m.netPayments * 100), 0), total)
  assert.equal(report.busiestTimes.total, report.summary.checkins)
  assert.equal(report.months.reduce((n,m)=>n+m.visits,0),report.summary.checkins)
  for(const view of ['weekHours','monthDays']) assert.equal(report.busiestTimes[view].flatMap(r=>r.values).reduce((n,v)=>n+(v||0),0),report.summary.checkins)
  const ms = Date.now() - started
  const csv = await request('/api/cubit/reports/transactions.csv?from=' + from + '&to=' + to, token)
  assert.equal(csv.status, 200); assert.ok(csv.text.startsWith('\uFEFF"Transaction ID"'))
  console.log(`PASS: ${report.months.length}-month report (${from} through ${to}), monthly and overall payments reconcile, CSV export succeeds. Report took ${ms} ms.`)
}
main().catch(e => { console.error(e.message); process.exitCode = 1 })
