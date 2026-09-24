const [major, minor, patch] = process.versions.node.split('.').map(Number)
const supported = (major === 22 && (minor > 22 || (minor === 22 && patch >= 3))) ||
  (major === 24 && minor >= 15) || major >= 26
if (!supported) {
  console.error(`Angular 22 cannot build with Node ${process.versions.node}. Use Node 22.22.3+, 24.15+, or 26+. On Windows, rerun dev\\setup-local.cmd.`)
  process.exit(1)
}
