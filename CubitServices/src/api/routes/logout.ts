import express from 'express';
import { AppDataSource } from '../../database';
import { Member } from '../../entity/member';
import { signedIn } from '../common/member-auth';
import { recordAudit } from '../../staff/audit';

const router = express.Router();
router.post('/', signedIn, async (req, res, next) => {
  try {
    await AppDataSource.transaction(async (manager) => {
      // Atomic increment prevents concurrent sign-outs or password changes from
      // restoring an older version. Every session is checked against this value.
      await manager.increment(Member, { id: req.member!.id }, 'tokenVersion', 1);
      await recordAudit(manager, {
        memberId: req.member!.id,
        kind: 'Signed out everywhere',
        author: req.member!.email,
        actorType: req.member!.role === 'admin' ? 'staff' : 'member',
        entityId: req.member!.id,
        after: { sessionsRevoked: true },
      });
    });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});
module.exports = router;
