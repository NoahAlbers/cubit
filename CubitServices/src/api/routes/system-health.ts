import express from 'express';
import { staffOnly } from '../common/staff-auth';
import { route } from '../common/request-schema';
import { systemHealth } from '../../system/health';
const router = express.Router();
router.get(
  '/',
  staffOnly,
  route(async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await systemHealth());
  }),
);
module.exports = router;
