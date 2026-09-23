import express from 'express';
import { Member } from '../../entity/member';
import { jwtHelper } from '../common/jwtHelper';

const router = express.Router();

router.post('/', async (req, res, next) => {
  if (typeof req.body.email !== 'string' || typeof req.body.password !== 'string' || req.body.email.length > 254 || req.body.password.length > 1024) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }
  let memberClass = new Member();

  memberClass.GetMemberByEmailAndPass(req.body.email.trim().toLowerCase(), req.body.password).then(
    (member) => {
      const token = jwtHelper.GenerateJWT(member);
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({ token, member: { id: member.id, email: member.email, role: member.role, firstName: member.firstName, lastName: member.lastName } });
    },
    (err) => {
      res.status(401).json({ message: 'Invalid email or password.' });
    }
  );
});

module.exports = router;
