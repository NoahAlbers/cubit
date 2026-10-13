const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');

// Exercise the real development entry point against the disposable CI database.
module.exports = async db => {
  assert.equal(process.env.CUBIT_TEST_EMPTY_DATABASE, 'yes');
  const root = path.resolve(__dirname, '../..');
  const directory = path.join(root, '.private', 'watch-test-' + randomUUID());
  fs.mkdirSync(directory, { recursive: true });
  const entry = path.join(directory, 'entry.cjs');
  const dependency = path.join(directory, 'fixture.cjs');
  fs.writeFileSync(dependency, "console.log('watch fixture one');");
  fs.writeFileSync(entry, `require(${JSON.stringify(path.join(root, 'dev/service-dev.cjs'))});require('./fixture.cjs');`);
  await db.query("INSERT INTO cubit_demo_manifest (id,complete) VALUES ('synthetic-v1',TRUE)");
  let child, output = '';
  const waitFor = async check => {
    const deadline = Date.now() + 30000;
    while (!check()) {
      assert.ok(child.exitCode === null && Date.now() < deadline, 'Development watcher failed: ' + output);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };
  try {
    child = spawn(process.execPath, ['--watch', '--watch-preserve-output', entry], {
      cwd: path.join(root, 'CubitServices'), windowsHide: true,
      detached: process.platform !== 'win32', env: { ...process.env, PORT: '5002' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', data => { output += data; });
    child.stderr.on('data', data => { output += data; });
    await waitFor(() => output.includes('ready on port 5002'));
    let response = await fetch('http://127.0.0.1:5002/health');
    assert.equal(response.status, 200);
    assert.equal((await response.json()).mode, 'hosted-demo');
    output = '';
    fs.writeFileSync(dependency, "console.log('watch fixture two');");
    await waitFor(() => output.includes('watch fixture two') && output.includes('ready on port 5002'));
    response = await fetch('http://127.0.0.1:5002/health');
    assert.equal(response.status, 200);
    console.log('PASS: development entry starts the real API and Node watch restarts it after a dependency change.');
  } finally {
    if (child && child.exitCode === null) {
      if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      else process.kill(-child.pid, 'SIGTERM');
      await new Promise(resolve => child.exitCode !== null ? resolve() : child.once('exit', resolve));
    }
    await db.query("DELETE FROM cubit_demo_manifest WHERE id='synthetic-v1'");
    fs.unlinkSync(entry);
    fs.unlinkSync(dependency);
    fs.rmdirSync(directory);
  }
};
