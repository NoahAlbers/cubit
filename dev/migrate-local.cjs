// Explicit operator preparation. The API never loads these root credentials.
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const root=path.resolve(__dirname,'..'),app=path.join(root,'CubitServices');
const {nodeExe}=require('./runtime.cjs');
const settings=JSON.parse(fs.readFileSync(path.join(root,'.private/native/settings.json'),'utf8').replace(/^\uFEFF/,''));
const database=settings.database||'TonicLocalDev';
if(!['TonicLocalDev','TonicLocalReview'].includes(database))throw Error('Invalid local database selection.');
async function main(){
  const conn=await require('./native-db.cjs').connectVerified();
  try {
    await conn.query('USE `'+database+'`');
    process.chdir(app);
    require('../CubitServices/node_modules/ts-node/register');
    const {migrations}=require('../CubitServices/src/migrations/review-baseline');
    const [tables]=await conn.query('SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()');
    const [applied]=tables.some(t=>t.name==='cubit_migrations')?await conn.query('SELECT name FROM cubit_migrations'):[[]];
    const pending=migrations.some(m=>!applied.some(row=>row.name===m.name));
    if(pending&&tables.length)execFileSync(nodeExe,[path.join(root,'dev/backup-local.cjs')],{cwd:root,stdio:'inherit',windowsHide:true});
    const env={...process.env,LOCAL_DEVELOPMENT:'true',CUBIT_MODE:'',DATABASE_URI:'127.0.0.1',DATABASE_PORT:'3307',DATABASE_NAME:database,DATABASE_USERNAME:'tonic_local',DATABASE_PASSWORD:settings.appPassword,JWT_SECRET:settings.jwtSecret,HOST:'127.0.0.1',PORT:'5001',CUBIT_MIGRATION_USER:'root',CUBIT_MIGRATION_PASSWORD:settings.rootPassword};
    delete env.CUBIT_MIGRATION_SOCKET;
    execFileSync(nodeExe,['-r','ts-node/register','src/operator/migrate.ts','run'],{cwd:app,env,stdio:'inherit',windowsHide:true});
    for(const host of ['127.0.0.1','localhost'])for(const schema of ['TonicLocalDev','TonicLocalReview']){
      await conn.query("REVOKE ALL PRIVILEGES ON `"+schema+"`.* FROM 'tonic_local'@'"+host+"'");
      await conn.query("GRANT SELECT, INSERT, UPDATE, DELETE ON `"+schema+"`.* TO 'tonic_local'@'"+host+"'");
    }
    if(database==='TonicLocalDev'){
      delete env.CUBIT_MIGRATION_USER;delete env.CUBIT_MIGRATION_PASSWORD;
      execFileSync(nodeExe,['-r','ts-node/register','src/operator/seed-local.ts'],{cwd:app,env,stdio:'inherit',windowsHide:true});
    }
  }finally{await conn.end();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
