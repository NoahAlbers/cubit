import { healthHistory } from '../../system/history';
import express from 'express';
import { staffOnly } from '../common/staff-auth';
import { route } from '../common/request-schema';
import { systemHealth } from '../../system/health';
const router = express.Router();
router.get(
  '/',
  staffOnly,
  route(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const snapshot = await systemHealth();
    try {
      res.json({ ...snapshot, history: await healthHistory(String(req.query.range || '24h')) });
    } catch {
      res.json({
        ...snapshot,
        historyError: 'Historical readings are unavailable. Current checks are shown.',
      });
    }
  }),
);
module.exports = router;
