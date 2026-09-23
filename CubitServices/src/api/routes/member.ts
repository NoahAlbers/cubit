import { recordAudit, snapshot, profileFields } from '../../staff/audit'
import { AppDataSource } from './../../app'
import express from 'express'
import { Member, ROLES } from '../../entity/member'
import { hash } from 'bcrypt'
import { jwtHelper } from '../common/jwtHelper'
import { VerifyLoggedIn } from '../common/check-auth'
import { Guid } from 'guid-typescript'
import { MemberPlan } from '../../entity/memberPlan'
import { localConfig } from '../../dev/config'
import { demoEmail, demoMemberId } from '../../demo/identity'
import { lockIdentities, rejectDuplicateContact } from '../../billing/member-identity'

const router = express.Router()
const memberClass = new Member()

//in this file, you don't put the main route
//(e.g. /member, you just need member)
router.get('/', VerifyLoggedIn, (req, res, next) => {
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
        return res.status(500).json({ error: err })
      }
    )
})

router.put('/', async (req, res, next) => {
  const postedMemberData = req.body
  if(localConfig.runtimeMode==='hosted-demo' && postedMemberData.id===demoMemberId &&
    ((postedMemberData.email!==undefined && postedMemberData.email!==demoEmail) ||
     (postedMemberData.role!==undefined && postedMemberData.role!==ROLES.ADMIN) || postedMemberData.password))
    return res.status(403).json({message:'The shared demo sign-in email, password and role cannot be changed.'})
  for (const key of Object.keys(postedMemberData)) if (!['id', 'firstName', 'lastName', 'email', 'paypalEmail', 'phone',
    'emergencyContact', 'emergencyEmail', 'emergencyPhone', 'picture', 'role', 'password'].includes(key)) delete postedMemberData[key]

  if (typeof postedMemberData.password === 'string' && postedMemberData.password.length > 0) {
    postedMemberData.password = await hash(postedMemberData.password, 10)
  } else {
    //Since a new pwd was not submitted, leave as it is
    delete postedMemberData.password //typeorm does not update if it's missing.
  }

  AppDataSource.transaction(async manager=>{
    await lockIdentities(manager)
    const before=await manager.findOneByOrFail(Member,{id:postedMemberData.id})
    if(typeof postedMemberData.email==='string'&&postedMemberData.email.trim().toLowerCase()!==before.email.trim().toLowerCase())
      await rejectDuplicateContact(manager,postedMemberData.email,postedMemberData.id)
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
      return res.status(err.status || 500).json({ message: err.status ? err.message : 'Could not save the member.' })
    })
})

router.post('/', async (req, res, next) => {
  const memberClass = new Member()

  var member: Member = JSON.parse(JSON.stringify(req.body))
  for (const key of ['accessHold', 'accessHoldReason', 'billingSuspended', 'balance', 'status', 'statusReason']) delete (member as any)[key]

  if (member.id != 'New') {
    throw 'use put method to update an existing member, not post'
  } else {
    member.id = Guid.create().toString()
  }

  if (await memberClass.checkForDuplicateEmail(member.email)) {
    res
      .status(409)
      .json({ message: 'A member already exists with this e-mail address' })
    return
  }

  if (typeof member.password === 'string' && member.password.length > 0) {
    member.password = await hash(member.password, 10)
  }

  member.role = ROLES.MEMBER

  AppDataSource.transaction(async manager=>{
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
      return res.status(err.status || 500).json({ message: err.status ? err.message : 'Could not save the member.' })
    })
})

router.get('/refreshStatus', async (req, res, next) => {
  try {
    await memberClass.updateAllMemberBalancesAndStatus()
    res.status(200).json({ result: 'completed' })
  } catch (error) {
    res.status(500).json(error)
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
      res.status(500).send('error:' + err)
    })
})

router.get('/balance/:memberId', async (req, res, next) => {
  const balance = await memberClass.getCurrentBalance(req.params.memberId)

  res.status(200).json(balance)
})

router.get('/isActive/:memberId', async (req, res, next) => {
  res.status(200).json(await memberClass.isMemberActive(req.params.memberId))
})

router.get('/plans/:memberId', (req, res, next) => {
  console.log(req.params.memberId)
  AppDataSource.manager
    .find(MemberPlan, {
      where: { member: { id: req.params.memberId } },
      relations: ['plan'],
    })
    .then((memberPlans) => {
      res.status(200).json(memberPlans)
    })
    .catch((err) => {
      res.status(500).send('error:' + err)
    })
})

module.exports = router
