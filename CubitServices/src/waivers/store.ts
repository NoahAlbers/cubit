import { AppDataSource } from '../app'
import { Waiver, WaiverVersion, WaiverSignature } from '../entity/waiver'
import { Member } from '../entity/member'
import { OperationsAudit } from '../entity/cubitOperations'
import { fail, reasonText } from '../billing/payments'
import { createSigning, retrieveSigning, verifiedCompletion, validateTemplate, docusealConfig } from './docuseal'

export function publicSignature(s: WaiverSignature) {
  return { id:s.id, versionId:s.versionId, waiverId:s.waiverId, provider:s.provider, status:s.status,
    signerName:s.signerName, completedAt:s.completedAt, createdAt:s.createdAt, documentUrl:s.documentUrl,
    signingUrl:s.provider==='docuseal' && s.slug && s.status!=='Signed' ? `https://docuseal.com/s/${s.slug}` : null }
}
function publicVersion(v: WaiverVersion) {
  return {id:v.id,number:v.number,name:v.name,description:v.description,demoText:v.demoText,provider:v.provider,createdAt:v.createdAt}
}
export async function memberWaivers(memberId: string) {
  const [waivers, versions, signatures] = await Promise.all([
    AppDataSource.manager.find(Waiver), AppDataSource.manager.find(WaiverVersion),
    AppDataSource.manager.find(WaiverSignature,{where:{memberId},order:{createdAt:'DESC'}}),
  ])
  const current = waivers.filter(w=>!w.archived && w.currentVersionId).map(w=>{
    const version=versions.find(v=>v.id===w.currentVersionId)!
    const signature=signatures.find(s=>s.versionId===version.id)
    return { id:w.id, required:w.required, version:publicVersion(version), signature:signature ? publicSignature(signature) : null }
  })
  return { current, history:signatures.filter(s=>s.status==='Signed').map(s=>({...publicSignature(s),version:publicVersion(versions.find(v=>v.id===s.versionId)!)})),
    missing:current.filter(w=>w.required && w.signature?.status!=='Signed').length }
}

export async function publishWaiver(id: string|undefined, input: any, author: string) {
  const name=reasonText(input.name,150), description=reasonText(input.description,2000)
  if(typeof input.required!=='boolean' || !['demo','docuseal'].includes(input.provider))fail('Choose a valid waiver type and requirement.')
  const demoText=input.provider==='demo'?reasonText(input.demoText,20000):''
  const signerRole=input.provider==='docuseal'?reasonText(input.signerRole,100):'Member'
  if(input.provider==='docuseal') {
    if(!Number.isSafeInteger(input.docusealTemplateId)||input.docusealTemplateId<1)fail('Enter a valid DocuSeal template ID.')
    // Published versions must not share a mutable DocuSeal template.
    if(await AppDataSource.manager.countBy(WaiverVersion,{docusealTemplateId:input.docusealTemplateId}))fail('Clone the DocuSeal template before publishing a new version.',409)
    await validateTemplate(input.docusealTemplateId,signerRole)
  }
  return AppDataSource.transaction(async manager=>{
    const waiver=id?await manager.findOne(Waiver,{where:{id},lock:{mode:'pessimistic_write'}}):manager.create(Waiver,{name,revision:0})
    if(!waiver)fail('Waiver not found.',404)
    if(id && input.revision!==waiver.revision)fail('This waiver changed. Reload before publishing.',409)
    if(waiver.archived)fail('Restore the waiver before publishing a new version.',409)
    if(!id)await manager.save(waiver)
    const number=await manager.countBy(WaiverVersion,{waiverId:waiver.id})+1
    const version=await manager.save(WaiverVersion,manager.create(WaiverVersion,{waiverId:waiver.id,number,name,description,demoText,
      provider:input.provider,docusealTemplateId:input.provider==='docuseal'?input.docusealTemplateId:null,signerRole,author}))
    waiver.name=name;waiver.required=input.required;waiver.currentVersionId=version.id;waiver.revision++
    await manager.save(waiver)
    await manager.save(OperationsAudit,{kind:'Waiver published',author,detail:JSON.stringify({waiverId:waiver.id,version:number,required:waiver.required})})
    return { ...waiver, version }
  })
}

export async function startSigning(member: Member, versionId: string) {
  const version=await AppDataSource.manager.findOneBy(WaiverVersion,{id:versionId})
  if(!version)fail('Waiver not found.',404)
  if(version.provider==='docuseal'&&!docusealConfig().enabled)fail('DocuSeal is not connected yet.',503)
  // Commit the reservation before contacting DocuSeal; ambiguous failures can be recovered.
  const reservation=await AppDataSource.transaction(async manager=>{
    const waiver=await manager.findOne(Waiver,{where:{id:version.waiverId},lock:{mode:'pessimistic_write'}})
    if(!waiver || waiver.archived || waiver.currentVersionId!==versionId)fail('This waiver was updated. Reload to sign the current version.',409)
    const existing=await manager.findOneBy(WaiverSignature,{memberId:member.id,versionId})
    if(existing)return {signature:existing,created:false}
    const signature=await manager.save(WaiverSignature,manager.create(WaiverSignature,{memberId:member.id,waiverId:waiver.id,versionId,
      provider:version.provider,signerEmail:member.email,signerName:`${member.firstName} ${member.lastName}`,
      status:version.provider==='demo'?'Pending':'Preparing'}))
    return {signature,created:true}
  })
  if(reservation.created && version.provider==='docuseal') {
    try {
      const result=await createSigning(version,reservation.signature)
      await AppDataSource.manager.update(WaiverSignature,reservation.signature.id,{submissionId:result.submission_id,submitterId:result.id,slug:result.slug,status:'Pending'})
    } catch(err) {
      await AppDataSource.manager.update(WaiverSignature,reservation.signature.id,{status:'Needs review'})
      throw err
    }
  }
  return publicSignature(await AppDataSource.manager.findOneByOrFail(WaiverSignature,{id:reservation.signature.id}))
}

export async function completeDemo(memberId: string,id: string,input: any) {
  const name=reasonText(input.name,150)
  if(input.acknowledged!==true)fail('Confirm that this is a demonstration.')
  return AppDataSource.transaction(async manager=>{
    const lookup=await manager.findOneBy(WaiverSignature,{id,memberId})
    if(!lookup)fail('Signing request not found.',404)
    const waiver=await manager.findOne(Waiver,{where:{id:lookup.waiverId},lock:{mode:'pessimistic_write'}})
    const signature=await manager.findOneByOrFail(WaiverSignature,{id,memberId})
    if(signature.provider!=='demo')fail('DocuSeal must verify this signature.',403)
    if(signature.status==='Signed')return publicSignature(signature)
    if(!waiver || waiver.archived || waiver.currentVersionId!==signature.versionId)fail('This waiver was updated. Reload before signing.',409)
    signature.signerName=name;signature.status='Signed';signature.completedAt=new Date()
    await manager.save(signature)
    await manager.save(OperationsAudit,{memberId,kind:'Demo waiver signed',author:signature.signerEmail,detail:JSON.stringify({signatureId:id,versionId:signature.versionId})})
    return publicSignature(signature)
  })
}

export async function syncSigning(memberId: string,id: string) {
  const signature=await AppDataSource.manager.findOneBy(WaiverSignature,{id,memberId})
  if(!signature)fail('Signing request not found.',404)
  if(signature.provider==='demo'||signature.status==='Signed')return publicSignature(signature)
  const version=await AppDataSource.manager.findOneByOrFail(WaiverVersion,{id:signature.versionId})
  const verified=verifiedCompletion(await retrieveSigning(signature),signature,version)
  // Terminal signatures cannot regress when a delayed status check returns.
  await AppDataSource.manager.createQueryBuilder().update(WaiverSignature).set(verified).where('id = :id AND status != :status',{id,status:'Signed'}).execute()
  return publicSignature(await AppDataSource.manager.findOneByOrFail(WaiverSignature,{id}))
}
