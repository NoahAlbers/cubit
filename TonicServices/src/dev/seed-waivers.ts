import { AppDataSource } from '../app'
import { Waiver, WaiverVersion, WaiverSignature } from '../entity/waiver'
import { Member } from '../entity/member'

export async function seedWaivers() {
  // A fixed marker prevents reseeding even after staff archives or revises the demo.
  const id='60000000-0000-4000-8000-000000000001',versionId='60000000-0000-4000-8000-000000000002'
  if(await AppDataSource.manager.findOneBy(Waiver,{id}))return
  await AppDataSource.transaction(async manager=>{
    await manager.save(Waiver,{id,name:'Makerspace membership waiver',required:true,archived:false,currentVersionId:versionId,revision:1})
    await manager.save(WaiverVersion,{id:versionId,waiverId:id,number:1,name:'Makerspace membership waiver',provider:'demo',author:'Local demo seed',
      description:'Required when joining Melbourne Makerspace.',signerRole:'Member',
      demoText:'LOCAL DEMONSTRATION — NOT A LEGAL WAIVER\n\nThis sample lets you try the Cubit signing workflow. The real membership waiver will be supplied and managed by staff in DocuSeal.\n\nIn the real flow, members will review the approved document, provide the requested information, and sign using DocuSeal. Cubit will retain the document version and signing date.\n\nCompleting this demo records a test signature only. It does not create an agreement or change door access.'})
    const members=await manager.find(Member,{order:{id:'ASC'}})
    for(const [i,m] of members.entries()) {
      if(i%3!==0 || m.email==='alex@example.test')continue
      await manager.save(WaiverSignature,{memberId:m.id,waiverId:id,versionId,provider:'demo',status:'Signed',
        signerEmail:m.email,signerName:`${m.firstName} ${m.lastName}`,completedAt:new Date()})
    }
  })
}
