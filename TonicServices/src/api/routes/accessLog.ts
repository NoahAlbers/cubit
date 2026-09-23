import express from "express";
import { AccessLog } from "../../entity/accessLog";
import { AppDataSource } from '../../app';
import { accessLogOptions } from '../../billing/access-log-options';

const router = express.Router();

router.get('/events', async (req, res, next) => {
  try {
    const options = accessLogOptions(req.query);
    const query = AppDataSource.getRepository(AccessLog).createQueryBuilder('log')
      .leftJoinAndSelect('log.member', 'member')
      .select(['log.id', 'log.timestamp', 'log.message', 'log.accessGranted',
        'member.id', 'member.firstName', 'member.lastName', 'member.email']);
    if (options.since) query.andWhere('log.timestamp >= :since', { since: options.since });
    if (options.result !== 'all') query.andWhere('COALESCE(log.accessGranted, 0) = :granted', { granted: options.result === 'granted' ? 1 : 0 });
    if (options.search) query.andWhere("CONCAT_WS(' ', member.firstName, member.lastName, member.email, log.message) LIKE :search ESCAPE '!'",
      { search: '%' + options.search.replace(/[!%_]/g, '!$&') + '%' });
    const total = await query.getCount();
    const pages = Math.max(1, Math.ceil(total / options.pageSize));
    const page = Math.min(options.page, pages);
    if (options.sort === 'name') query.orderBy('member.lastName', options.order).addOrderBy('member.firstName', options.order);
    else query.orderBy(options.sort === 'result' ? 'log.accessGranted' : 'log.timestamp', options.order);
    const rows = await query.addOrderBy('log.id', 'ASC').offset((page - 1) * options.pageSize).limit(options.pageSize).getMany();
    res.json({ rows, total, page, pages });
  } catch (error) { next(error); }
});

// Retained for older clients; Cubit's paginated view uses /events.
router.get("/getAccessLog", async (req, res, next) => {
  try { res.json(await AccessLog.getAccessLog()); } catch (error) { next(error); }
});

module.exports = router;
