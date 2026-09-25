const fs=require('fs'),path=require('path');
const mysql=require('../CubitServices/node_modules/mysql2/promise');
const {initialize,publish,retain}=require('./parallel-store.cjs');
async function main(){
 const [command,configFile,file]=process.argv.slice(2);
 if(!['init','import'].includes(command)||!configFile||command==='import'&&!file)throw Error('Use init CONFIG or import CONFIG SNAPSHOT');
 const config=JSON.parse(fs.readFileSync(configFile,'utf8'));
 if(config.host!=='127.0.0.1'||config.database!=='cubit_parallel'||config.user!=='cubit_parallel_writer')throw Error('Refusing a non-parallel destination');
 const db=await mysql.createConnection({...config,dateStrings:true,connectTimeout:5000,multipleStatements:false});
 try{
  if(command==='init'){await initialize(db);console.log('Parallel schema initialized');return;}
  const stat=fs.statSync(file);if(!stat.isFile()||stat.size>64*1024*1024)throw Error('Invalid snapshot file');
  const result=await publish(db,fs.readFileSync(path.resolve(file)));await retain(db);console.log(JSON.stringify(result));
 }catch(error){
  if(command==='import')await db.query("INSERT INTO parallel_run(status,detail) VALUES('Failed',?)",[(error.code||error.message).slice(0,255)]).catch(()=>{});
  throw error;
 }finally{await db.end()}
}
main().catch(error=>{console.error('Parallel import failed:',error.code||error.message);process.exitCode=1});
