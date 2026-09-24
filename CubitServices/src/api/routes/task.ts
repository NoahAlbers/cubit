import { AppDataSource } from '../../app'
import express from 'express'

import { Member } from '../../entity/member'
import { VerifyLoggedIn } from '../common/check-auth'

import { Task } from '../../entity/task'

const router = express.Router()

router.get('/', async (req, res, next) => {
  AppDataSource.manager.find(Task, {}).then(
    async (result: Task[]) => {
      res.json(result)
    },
    (err) => {
      res
        .status(500)
        .send([`Error connecting to database to get tasks: ${err}`])
    }
  )
})

router.get('/single/:id', async (req, res, next) => {
  AppDataSource.manager
    .findOne(Task, { where: { id: req.params.id } })
    .then((result) => {
      res.status(200).json(result)
    })
    .catch((err) => {
      res.status(500).send([`Error deleting task: ${err}`])
    })
})

router.post('/', async (req, res, next) => {
  let posted = req.body as Task
  AppDataSource.manager
    .save(Task, posted)
    .then((result) => {
      res.status(200).json(result)
    })
    .catch((err) => {
      res.status(500).send([`Error saving task: ${err}`])
    })
})

router.put('/', async (req, res, next) => {
  let posted = req.body as Task
  AppDataSource.manager
    .update(Task, posted.id, posted)
    .then((result) => {
      res.status(200).json(result)
    })
    .catch((err) => {
      res.status(500).send([`Error updating task: ${err}`])
    })
})

router.delete('/:id', async (req, res, next) => {
  AppDataSource.manager
    .delete(Task, req.params.id)
    .then((result) => {
      res.status(200).json(result)
    })
    .catch((err) => {
      res.status(500).send([`Error deleting task: ${err}`])
    })
})

module.exports = router
