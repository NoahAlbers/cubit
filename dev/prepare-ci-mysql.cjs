// Isolated GitHub Actions database only; production migrations use the operator.
if(process.env.CI!=='true')throw Error('CI-only setup');
(async()=>{const db=await require('../CubitServices/node_modules/mysql2/promise').createConnection({host:'127.0.0.1',user:'root',password:'ci-root-only'});try{await db.query('SET GLOBAL log_bin_trust_function_creators=1');}finally{await db.end();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
