import { AsyncLocalStorage } from 'async_hooks'
import { EntityManager } from 'typeorm'
import { OperationsAudit } from '../entity/cubitOperations'

export const auditActor = new AsyncLocalStorage<{id:string,email:string}>()
export const profileFields=['firstName','lastName','email','paypalEmail','phone','emergencyContact','emergencyEmail','emergencyPhone','picture','role']
export const paymentFields=['id','amount','transactionDate','description','method','confirmation','correctedBy','reversalOf']
export const planFields=['id','planId','startDate','endDate','finalBillingDate','billingRate','billingName']
export const keyFields=['id','memberId','serialNumber','status']
export function snapshot(value:any,fields:string[]) {return value?Object.fromEntries(fields.map(k=>[k,value[k]??null])):null}
export function changes(before:any,after:any) {
  const keys=[...new Set([...Object.keys(before||{}),...Object.keys(after||{})])]
  return keys.filter(k=>JSON.stringify(before?.[k]??null)!==JSON.stringify(after?.[k]??null)).map(field=>({field,before:before?.[field]??null,after:after?.[field]??null}))
}
// Explicit snapshots only: never serialize an entire member or request (passwords,
// hashes, tokens, and integration secrets must not enter the audit trail).
export async function recordAudit(manager:EntityManager, input:{memberId?:string,kind:string,author:string,entityId?:string,before?:any,after?:any,reason?:string,actorType?:string}) {
  const actor=auditActor.getStore()
  return manager.save(OperationsAudit,manager.create(OperationsAudit,{memberId:input.memberId,kind:input.kind,author:input.author,
    detail:JSON.stringify({version:1,actorId:actor?.id||null,actorType:input.actorType||(actor?'staff':'system'),entityId:input.entityId||null,
      before:input.before??null,after:input.after??null,reason:input.reason||''})}))
}
export function auditDetail(row:OperationsAudit) {
  let detail:any;try{detail=JSON.parse(row.detail)}catch{}
  const structured=detail&&typeof detail==='object'&&!Array.isArray(detail)
  return {...row,detail:undefined,actorType:detail?.actorType||(row.author==='Automation'?'system':(row.kind.startsWith('Member updated')||row.kind==='Demo waiver signed')?'member':'staff'),
    legacy:detail?.legacy===true||detail?.version!==1,entityId:detail?.entityId||detail?.planId||null,
    reason:structured?(detail.reason||''):row.detail,
    changes:structured?changes(detail.before,detail.after):[],
    context:structured&&!('before' in detail)&&!('after' in detail)?detail:null}
}
