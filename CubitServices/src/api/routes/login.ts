import { validEmail } from '../../contact/validation'
import express from 'express';
import { Member } from '../../entity/member';
import { jwtHelper } from '../common/jwtHelper';
import { createRememberedGreeting } from '../common/remembered-greeting';
import { localConfig } from '../../dev/config';
import { AppDataSource } from '../../app';

const router = express.Router();
const greeting = createRememberedGreeting({
  secret: localConfig.jwtSecret,
  workspace: localConfig.runtimeMode + ':' + localConfig.database,
  secure: localConfig.runtimeMode !== 'local',
  findFirstName: async (id, email) => {
    const member = await AppDataSource.getRepository(Member).findOne({
      where: { id, email }, select: { firstName: true },
    });
    return member?.firstName || null;
  },
});
router.post('/greeting', greeting.greet);

router.post('/', async (req, res, next) => {
  if (!validEmail(req.body.email) || typeof req.body.password !== 'string' || req.body.email.length > 254 || req.body.password.length > 1024) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }
  let memberClass = new Member();

  memberClass.GetMemberByEmailAndPass(req.body.email.trim().toLowerCase(), req.body.password).then(
    (member) => {
      const token = jwtHelper.GenerateJWT(member);
      res.setHeader('Cache-Control', 'no-store');
      greeting.remember(res, member);
      res.status(200).json({ token, member: { id: member.id, email: member.email, role: member.role, firstName: member.firstName, lastName: member.lastName } });
    },
    (err) => {
      res.status(401).json({ message: 'Invalid email or password.' });
    }
  );
});

module.exports = router;
