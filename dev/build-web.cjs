const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const root = path.resolve(__dirname, '..')
const web = path.join(root, 'CubitWeb')
if (!fs.existsSync(path.join(web, 'node_modules/@angular/cli/bin/ng.js'))) {
  execFileSync(process.execPath, [path.join(root, '.private/tools/pnpm9/package/bin/pnpm.cjs'), 'install', '--frozen-lockfile'], { cwd: web, stdio: 'inherit' })
}
execFileSync(process.execPath, [path.join(web, 'node_modules/@angular/cli/bin/ng.js'), 'build', '--configuration', 'production'], {
  cwd: web, stdio: 'inherit', env: { ...process.env, NG_CLI_ANALYTICS: 'false' },
})
fs.cpSync(path.join(web, 'dist'), path.join(root, 'TonicServices/tonic'), { recursive: true })
console.log('Cubit built. Refresh http://localhost:5001 to see the updated interface.')
