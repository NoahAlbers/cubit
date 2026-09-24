import { recordAudit } from '../staff/audit'
import { EntityManager } from 'typeorm'
import { AppDataSource } from '../database'
import { Plan } from '../entity/plan'
import { MemberPlan } from '../entity/memberPlan'
import { OperationsAudit } from '../entity/cubitOperations'
import { fail } from './payments'

export function catalogValues(body:any) {
  if(typeof body?.name!=='string'||!body.name.trim()||body.name.trim().length>100)fail('Enter a plan name (1–100 characters).')
  const monthlyCost=body.monthlyCost
  if(typeof monthlyCost!=='number'||!Number.isFinite(monthlyCost)||monthlyCost<0||monthlyCost>99999999||Math.abs(monthlyCost*100-Math.round(monthlyCost*100))>0.00001)
    fail('Enter a monthly price of zero or more, with at most two decimal places.')
  if(typeof body.available!=='boolean')fail('Choose whether the plan is available.')
  return {name:body.name.trim(),monthlyCost,available:body.available}
}
export function catalogId(value:any) {
  if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))fail('Invalid plan ID.')
  return value
}
export async function saveCatalogPlan(id:string,body:any,author:string,create=false) {
  const values=catalogValues(body);catalogId(id)
  return AppDataSource.transaction(async manager=>{
    const plan=await manager.findOne(Plan,{where:{id},lock:{mode:'pessimistic_write'}})
    if(create) {
      if(plan) {
        if(plan.name===values.name&&Number(plan.monthlyCost)===values.monthlyCost&&plan.available===values.available)return plan
        fail('This plan has already been created with different details.',409)
      }
      const saved=await manager.save(Plan,manager.create(Plan,{id,...values,revision:1}))
      await recordAudit(manager,{kind:'Plan created',author,entityId:id,after:values})
      return saved
    }
    if(!plan)fail('Plan not found.',404)
    if(body.revision!==plan.revision)fail('Someone changed this plan. Reload it before saving.',409)
    const before={name:plan.name,monthlyCost:Number(plan.monthlyCost),available:plan.available}
    // Preserve legacy assignments that predate billing snapshots, including future
    // and ended memberships. Posted charges are deliberately never updated here.
    await freezeAssignments(manager,plan)
    Object.assign(plan,values,{revision:plan.revision+1})
    await manager.save(plan)
    await recordAudit(manager,{kind:before.available&&!values.available?'Plan retired':!before.available&&values.available?'Plan restored':'Plan updated',author,entityId:id,before,after:values})
    return plan
  })
}
async function freezeAssignments(manager:EntityManager,plan:Plan) {
  await manager.createQueryBuilder().update(MemberPlan).set({billingRate:Number(plan.monthlyCost)})
    .where('planId = :id AND billingRate IS NULL',{id:plan.id}).execute()
  await manager.createQueryBuilder().update(MemberPlan).set({billingName:plan.name})
    .where('planId = :id AND billingName IS NULL',{id:plan.id}).execute()
}
