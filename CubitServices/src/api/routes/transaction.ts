import { AppDataSource } from '../../database';
import express from 'express';
import { Transaction } from '../../entity/transaction';
import { recordPayment } from '../../billing/payments';
const router = express.Router();
router.get('/memberTransactions/:memberId', async (req, res, next) => {
  try {
    res.json(
      await AppDataSource.manager.find(Transaction, {
        where: { memberId: req.params.memberId },
        order: { transactionDate: 'DESC', createdAt: 'DESC' },
      }),
    );
  } catch (err) {
    next(err);
  }
});
router.get('/:id', async (req, res, next) => {
  try {
    const row = await AppDataSource.manager.findOneBy(Transaction, { id: req.params.id });
    if (!row) return res.sendStatus(404);
    res.json(row);
  } catch (err) {
    next(err);
  }
});
router.post('/', async (req, res, next) => {
  try {
    res.json(
      await AppDataSource.transaction((manager) =>
        recordPayment(manager, req.body, req.member!.email),
      ),
    );
  } catch (err) {
    next(err);
  }
});
module.exports = router;
