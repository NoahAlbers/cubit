// Isolated synthetic account for manually exercising the billing dialogs.
const fs=require('fs'),path=require('path'),{randomUUID}=require('crypto')
const {request}=require('./native-smoke.cjs')
const file=path.resolve(__dirname,'../../.private/ui-billing-fixture.json')
async function main(){
  if(process.argv[2]==='create'){
    if(fs.existsSync(file))throw Error('Clean up the previous UI fixture first.')
    const token=(await request('/login',{method:'POST',body:{email:'admin@example.test',password:'LocalDemoOnly!2026'}})).json().token
    const email=`ui-billing-${randomUUID()}@example.test`
    const result=await request('/member',{token,method:'POST',body:{id:'New',firstName:'UI',lastName:'Billing Fixture',email,paypalEmail:'',password:''}})
    if(result.status!==200)throw Error(result.text)
    const fixture={id:result.json().id,email};fs.writeFileSync(file,JSON.stringify(fixture));console.log(`http://localhost:5001/member/${fixture.id}`)
  }else if(process.argv[2]==='cleanup'){
    require('ts-node/register')
    const {AppDataSource:db}=require('../src/app'),{Member}=require('../src/entity/member'),{Transaction}=require('../src/entity/transaction')
    const {BillingCharge,ChargeAdjustment,OperationsAudit}=require('../src/entity/cubitOperations')
    const fixture=JSON.parse(fs.readFileSync(file,'utf8'));await db.initialize()
    try{await db.transaction(async manager=>{
      const member=await manager.findOneByOrFail(Member,{id:fixture.id,email:fixture.email})
      if(member.firstName!=='UI'||member.lastName!=='Billing Fixture'||!member.email.startsWith('ui-billing-'))throw Error('Not a UI test fixture')
      for(const entity of [ChargeAdjustment,BillingCharge,OperationsAudit,Transaction])await manager.delete(entity,{memberId:member.id})
      await manager.delete(Member,{id:member.id})
    });fs.unlinkSync(file);console.log('Removed the isolated UI billing fixture.')}finally{await db.destroy()}
  }else throw Error('Use create or cleanup.')
}
main().catch(e=>{console.error(e.message);process.exitCode=1})
