import { recordAudit, snapshot, profileFields } from '../../staff/audit'
import { memberInput } from '../common/member-input'
import { validateNewPassword } from '../../security/password-policy'
import { AppDataSource } from '../../database'
import express from 'express'
import { Member, ROLES } from '../../entity/member'
import { hash } from 'bcrypt'
import { randomUUID } from 'crypto'
import { MemberPlan } from '../../entity/memberPlan'
import { localConfig } from '../../dev/config'
import { demoEmail, demoMemberId } from '../../demo/identity'
import { lockIdentities, rejectDuplicateContact } from '../../billing/member-identity'

const router = express.Router()
const memberClass = new Member()

//in this file, you don't put the main route
//(e.g. /member, you just need member)
router.get('/', (req, res, next) => {
  //find all members
  AppDataSource.manager
    .find(Member, { order: { status: 'ASC', lastName: 'ASC' } })
    .then(
      (result) => {
        //remove the password field from the payload
        result.map((member) => (member.password = ''))

        //say everything is happy with a 200 status
        //and pass the result as json
        return res.status(200).json(result)
      },
      (err) => {
        next(err)
      }
    )
})

router.put('/', async (req, res, next) => {
  try {
  const postedMemberData = memberInput(req.body)
  if(localConfig.runtimeMode==='hosted-demo' && postedMemberData.id===demoMemberId &&
    ((postedMemberData.email!==undefined && postedMemberData.email!==demoEmail) ||
     (postedMemberData.role!==undefined && postedMemberData.role!==ROLES.ADMIN) || postedMemberData.password))
    return res.status(403).json({message:'The shared demo sign-in email, password and role cannot be changed.'})

  if (typeof postedMemberData.password === 'string' && postedMemberData.password.length > 0) {
    validateNewPassword(postedMemberData.password)
    postedMemberData.password = await hash(postedMemberData.password, 12)
  } else {
    //Since a new pwd was not submitted, leave as it is
    delete postedMemberData.password //typeorm does not update if it's missing.
  }

  await AppDataSource.transaction(async manager=>{
    await lockIdentities(manager)
    const before=await manager.findOneOrFail(Member,{where:{id:postedMemberData.id},lock:{mode:'pessimistic_write'}})
    if(typeof postedMemberData.email==='string'&&postedMemberData.email.trim().toLowerCase()!==before.email.trim().toLowerCase())
      await rejectDuplicateContact(manager,postedMemberData.email,postedMemberData.id)
    if(postedMemberData.password || (postedMemberData.role!==undefined && postedMemberData.role!==before.role) ||
      (postedMemberData.email!==undefined && postedMemberData.email!==before.email))
      postedMemberData.tokenVersion=before.tokenVersion+1
    const saved=await manager.save(Member,postedMemberData)
    const after={...before,...saved}, oldValues=snapshot(before,profileFields),newValues=snapshot(after,profileFields)
    if(JSON.stringify(oldValues)!==JSON.stringify(newValues))await recordAudit(manager,{memberId:before.id,kind:'Member details updated',author:req.member!.email,entityId:before.id,before:oldValues,after:newValues})
    if(postedMemberData.password)await recordAudit(manager,{memberId:before.id,kind:'Member password changed',author:req.member!.email,entityId:before.id,after:{passwordChanged:true}})
    return saved
  })
    .then((member: Member) => {
      //remove the password field from the payload
      //say everything is happy with a 200 status
      //and pass the result as json
      member.password = ''

      return res.status(200).json(member)
    })
    .catch((err) => {
      //oh nos! we have an error
      next(err)
    })
  } catch (err) { next(err) }
})

router.post('/', async (req, res, next) => {
  try {
  const memberClass = new Member()

  const member: Member = memberInput(req.body,true)
  member.id = randomUUID()

  if (await memberClass.checkForDuplicateEmail(member.email)) {
    res
      .status(409)
      .json({ message: 'A member already exists with this e-mail address' })
    return
  }

  if (typeof member.password === 'string' && member.password.length > 0) {
    validateNewPassword(member.password)
    member.password = await hash(member.password, 12)
  } else {
    delete (member as Partial<Member>).password
  }

  member.role = ROLES.MEMBER

  await AppDataSource.transaction(async manager=>{
    await lockIdentities(manager)
    await rejectDuplicateContact(manager,member.email)
    const result=await manager.insert(Member,member)
    await recordAudit(manager,{memberId:member.id,kind:'Member created',author:req.member!.email,entityId:member.id,after:snapshot(member,profileFields)})
    return result
  })
    .then((result) => {
      //remove the password field from the payload
      //say everything is happy with a 200 status
      //and pass the result as json
      member.password = ''

      return res.status(200).json(member)
    })
    .catch((err) => {
      //oh nos! we have an error
      next(err)
    })
  } catch (err) { next(err) }
})

router.get('/refreshStatus', async (req, res, next) => {
  try {
    await memberClass.updateAllMemberBalancesAndStatus()
    res.status(200).json({ result: 'completed' })
  } catch (error) {
    next(error)
  }
})

router.get('/:memberId', (req, res, next) => {
  AppDataSource.manager
    .findOneByOrFail(Member, { id: req.params.memberId })
    .then((member: Member) => {
      member.password = ''

      res.status(200).json(member)
    })
    .catch((err) => {
      next(err)
    })
})

router.get('/balance/:memberId', async (req, res, next) => {
  try {
  const balance = await memberClass.getCurrentBalance(req.params.memberId)

  res.status(200).json(balance)
  } catch (err) { next(err) }
})

router.get('/isActive/:memberId', async (req, res, next) => {
  try {
  res.status(200).json(await memberClass.isMemberActive(req.params.memberId))
  } catch (err) { next(err) }
})

router.get('/plans/:memberId', (req, res, next) => {
  AppDataSource.manager
    .find(MemberPlan, {
      where: { member: { id: req.params.memberId } },
      relations: ['plan'],
    })
    .then((memberPlans) => {
      res.status(200).json(memberPlans)
    })
    .catch((err) => {
      next(err)
    })
})

module.exports = router
