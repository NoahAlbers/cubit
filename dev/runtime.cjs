const path = require('path')
const root = path.resolve(__dirname, '..')
module.exports = {
  nodeVersion: '22.23.3',
  mysqlVersion: '8.4.11',
  nodeExe: path.join(root, '.private/tools/node22-22.23.3/node.exe'),
  mysqlBase: path.join(root, '.private/tools/mysql/mysql-8.4.11-winx64'),
}
