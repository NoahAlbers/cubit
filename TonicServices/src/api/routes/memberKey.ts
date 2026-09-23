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

router.post('/', VerifyLoggedIn, async (req, res) => {
  const postedMemberkey = req.body

  if (postedMemberkey.id == 'New') {
    postedMemberkey.id = Guid.create().toString()
  }

  AppDataSource.manager
    .save(MemberKey, postedMemberkey)
    .then((memberkey: MemberKey) => {
      return res.status(200).json(memberkey)
    })
    .catch((err) => {
      console.log(err)
      return res.status(500).json({ error: err })
    })
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

router.delete('/:keyId', VerifyLoggedIn, (req, res) => {
  const request = req

  AppDataSource.manager
    .delete(MemberKey, req.params.keyId)
    .then((result) => {
      res.status(200).json(result.affected || -1)
    })
    .catch((err) => {
      res.status(500).send('error:' + err)
    })
})

module.exports = router
