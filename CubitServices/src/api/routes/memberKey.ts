import { recordAudit, snapshot, keyFields } from '../../staff/audit'
import { lockIdentities } from '../../billing/member-identity'
import { lockMember } from '../../billing/store'
import { fail, reasonText } from '../../billing/payments'
import express from 'express'
import { Guid } from 'guid-typescript'
import { MemberKey } from '../../entity/memberKey'
import { VerifyLoggedIn } from '../common/check-auth'
import { AppDataSource } from '../../app'
import { memberActivity } from '../../billing/member-activity'

const router = express.Router()

router.get('/memberActivity/:memberId', VerifyLoggedIn, async (req, res, next) => {
  try { res.json(await memberActivity(AppDataSource.manager, req.params.memberId)) }
  catch (error) { next(error) }
})

router.get('/:Id', VerifyLoggedIn, async (req, res) => {
  AppDataSource.manager
    .findOneOrFail(MemberKey, {
      where: { id: req.params.Id },
      order: { status: 'ASC' },
    })
    .then((memberkey: MemberKey) => {
      return res.status(200).json(memberkey)
    })
    .catch((err) => {
      console.log(err)
      return res.status(500).json({ error: err })
    })
})

router.post('/', VerifyLoggedIn, async (req,res,next)=>{
  try {
    const b=req.body, serial=typeof b.serialNumber==='string'?b.serialNumber.trim():''
    if(typeof b.id!=='string'||!b.id||b.id.length>36||!serial||serial.length>100||!['Active','Inactive'].includes(b.status)||typeof b.memberId!=='string')fail('Enter a fob serial number, member and valid status.')
    const saved=await AppDataSource.transaction(async manager=>{
      await lockIdentities(manager)
      await lockMember(manager,b.memberId)
      const before=b.id==='New'?null:await manager.findOneBy(MemberKey,{id:b.id})
      if(b.id!=='New'&&!before)fail('Fob not found.',404)
      if(before&&before.memberId!==b.memberId)fail('A fob cannot be moved to another member through this form.',409)
      if(before&&b.expectedStatus!==before.status)fail('This fob changed. Reload before editing.',409)
      const duplicate=await manager.createQueryBuilder(MemberKey,'k').where('UPPER(TRIM(k.serialNumber))=:serial',{serial:serial.toUpperCase()}).andWhere('k.id<>:id',{id:before?.id||''}).getOne()
      if(duplicate)fail('This fob is already assigned. Review its existing member before adding it.',409)
      const reason=before?reasonText(b.reason):typeof b.reason==='string'?b.reason.trim().slice(0,500):''
      const after=await manager.save(MemberKey,manager.create(MemberKey,{id:before?.id||Guid.create().toString(),memberId:b.memberId,serialNumber:serial,status:b.status}))
      await recordAudit(manager,{memberId:b.memberId,kind:before?'Fob updated':'Fob assigned',author:req.member!.email,entityId:after.id,before:snapshot(before,keyFields),after:snapshot(after,keyFields),reason})
      return after
    })
    res.json(saved)
  } catch(e){next(e)}
})

router.get('/memberKeys/:memberId', VerifyLoggedIn, (req, res) => {
  AppDataSource.manager
    .find(MemberKey, { where: { member: { id: req.params.memberId } } })
    .then((memberkeys) => {
      res.status(200).json(memberkeys)
    })
    .catch((err) => {
      res.status(500).send('error:' + err)
    })
})

router.delete('/:keyId', VerifyLoggedIn, async(req,res,next)=>{
  try {
    const reason=reasonText(req.body.reason)
    await AppDataSource.transaction(async manager=>{
      await lockIdentities(manager)
      const key=await manager.findOneBy(MemberKey,{id:req.params.keyId})
      if(!key)fail('Fob not found.',404)
      await lockMember(manager,key.memberId)
      if(req.body.expectedStatus!==key.status||req.body.expectedSerial!==key.serialNumber)fail('This fob changed. Reload before removing it.',409)
      await recordAudit(manager,{memberId:key.memberId,kind:'Fob removed',author:req.member!.email,entityId:key.id,before:snapshot(key,keyFields),after:null,reason})
      await manager.delete(MemberKey,key.id)
    })
    res.json(1)
  } catch(e){next(e)}
})
module.exports = router
