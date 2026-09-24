import { MemberKey } from './../../entity/memberKey';
import { AppDataSource } from '../../database';
import express from 'express';
import { AccessLog } from '../../entity/accessLog';
import { Member } from '../../entity/member';

const router = express.Router();
const memberClass = new Member();

router.get('/doorLockCheck/:keySerial', async (req, res) => {
  AppDataSource.manager
    .findOneOrFail(MemberKey, {
      where: { serialNumber: req.params.keySerial, status: 'Active' },
      relations: { member: true },
    })
    .then(
      async (result: MemberKey) => {
        const isActive = await memberClass.isMemberActive(result.memberId);
        if (isActive) {
          AccessLog.postAccessLog(result.member, 'Successfully Scanned In', true, result.id);
          res.status(200).json(['True']);
        } else {
          const reason = `Access denied for ${result.member.firstName} ${result.member.lastName} because they are inactive`;
          AccessLog.postAccessLog(result.member, reason, false, result.id);
          res.status(200).send([reason]);
        }
      },
      () => {
        AccessLog.postAccessLog(
          null,
          `scanned key ${req.params.keySerial} not found in Cubit`,
          false,
        );

        res.status(200).send([`key ${req.params.keySerial} not found in db`]);
      },
    );
});

router.get('/getWhitelist', async (req, res) => {
  const memberClass = new Member();
  await memberClass.updateAllMemberBalancesAndStatus();

  await AppDataSource.manager
    .createQueryBuilder(MemberKey, 'MemberKey')
    .leftJoinAndSelect('MemberKey.member', 'member')
    .where('member.status = "Active"')
    .andWhere('MemberKey.status = "Active"')
    .select('SerialNumber as serial')
    .getRawMany()
    .then(
      (memberKeys) => {
        memberKeys.forEach((key) => {
          key.serial = key.serial.toUpperCase();
        });

        //python expects uppercase for comparison (in our code)
        res.status(200).json(memberKeys);
      },
      (err) => {
        res.status(500).json(err);
      },
    );
});

// router.get('/getAccessLogReport', async (req, res) => {
//   getRepository('AccessLog').find({timestamp: LessThan() })
// }

// logDoorAccess?rfid=000000000000&access=1&reason=xxxx
router.get('/logDoorAccess', async (req, res) => {
  AppDataSource.manager
    .findOneOrFail(MemberKey, {
      where: { serialNumber: req.query.rfid?.toString() },
      relations: { member: true },
    })
    .then(
      async (result: MemberKey) => {
        let accessGranted = false;
        if (req.query.access && req.query.access == '1') {
          accessGranted = true;
        }
        const reason = req.query.reason || 'no reason sent';

        AccessLog.postAccessLog(result.member, reason.toString(), accessGranted, result.id);
        res.status(200).send('Logged');
      },
      (err) => {
        res.status(404).json(err.message);
      },
    );
});

module.exports = router;

// Direct calls from the lock

// Get Whitelist

// Call:
//     http://crm.melbournemakerspace.com:82/api/query.php?action=getRFIDWhitelist
// Response:
//     [{"firstName":"ExampleName1","lastName":"ExampleName2","serial":"000000000000", ...and so on}]

// REST Service

// Call:
//     http://crm.melbournemakerspace.com:82/api/query.php?action=doorLockCheck&rfid=000000000000

// Response:
//     ["key 000000000000 not found in db"]

//     or

//     ["True"]

// Access Log Update

// Call:
//     http://crm.melbournemakerspace.com:82/api/query.php?action=logDoorAccess&rfid=000000000000&access=1&reason=xxxx

// Response:
//     ["True"]

// ---------------------------------------------------------------------------------------------------------
// External calls related to lock
// http://crm.melbournemakerspace.com:82/api/AccessLogReport.php
