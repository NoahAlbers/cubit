// Node's built-in watcher observes this entry point and its loaded modules.
// Resolve ts-node from the backend so this also works in the Windows launcher.
const path = require('node:path');
const { createRequire } = require('node:module');
const directory = path.resolve(__dirname, '../CubitServices');
const appRequire = createRequire(path.join(directory, 'package.json'));
appRequire('ts-node').register({ project: path.join(directory, 'tsconfig.json') });
appRequire('./src/app.ts').startLocalApp().catch(error => {
  console.error('Local startup failed:', error.message);
  process.exitCode = 1;
});
