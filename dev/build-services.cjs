const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const services = fs.realpathSync(path.resolve(__dirname, '../CubitServices'));
const output = path.join(services, 'dist');
// Removed source files must not survive as loadable entities in an old build.
// Refuse redirected output directories before deleting this generated tree.
if (path.dirname(output) !== services || path.basename(output) !== 'dist') {
  throw Error('Unexpected backend output path.');
}
if (fs.existsSync(output)) {
  if (fs.realpathSync(output) !== output || fs.lstatSync(output).isSymbolicLink()) {
    throw Error('Backend output must be an ordinary directory inside CubitServices.');
  }
  fs.rmSync(output, { recursive: true });
}
const result = spawnSync(process.execPath, [path.join(services, 'node_modules/typescript/bin/tsc'), '-p', '.'], {
  cwd: services, stdio: 'inherit', windowsHide: true,
});
process.exitCode = result.status ?? 1;
