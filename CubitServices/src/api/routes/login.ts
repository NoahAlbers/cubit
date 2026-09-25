import { trustCookie } from '../../security/trusted-computers';
import { requestDevice } from '../../security/device';
import { recordLogin } from '../../security/login-history';
import { validEmail } from '../../contact/validation';
import express from 'express';
import { Member } from '../../entity/member';
import { jwtHelper } from '../common/jwtHelper';
import { createRememberedGreeting } from '../common/remembered-greeting';
import { localConfig } from '../../dev/config';
import { AppDataSource } from '../../database';
import { authenticateSecondFactor } from '../../security/accounts';

const router = express.Router();
const greeting = createRememberedGreeting({
  secret: localConfig.jwtSecret,
  workspace: localConfig.runtimeMode + ':' + localConfig.database,
  secure: localConfig.runtimeMode !== 'local',
  findFirstName: async (id, email) => {
    const member = await AppDataSource.getRepository(Member).findOne({
      where: { id, email },
      select: { firstName: true },
    });
    return member?.firstName || null;
  },
});
router.post('/greeting', greeting.greet);

router.post('/', async (req, res) => {
  if (
    !validEmail(req.body?.email) ||
    typeof req.body?.password !== 'string' ||
    req.body.email.length > 254 ||
    req.body.password.length > 1024
  ) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }
  const memberClass = new Member();

  try {
    const passwordMember = await memberClass.GetMemberByEmailAndPass(
      req.body.email.trim().toLowerCase(),
      req.body.password,
    );
    const member = await authenticateSecondFactor(
      passwordMember,
      req.body.code,
      trustCookie(req),
      requestDevice(req),
    );
    const token = jwtHelper.GenerateJWT(member, member.mfaVerified, member.mfaFresh);
    await recordLogin(req, member, member.mfaVerified, member.mfaFresh);
    res.setHeader('Cache-Control', 'no-store');
    greeting.remember(res, member);
    res.status(200).json({
      token,
      trustEligible: member.mfaFresh,
      member: {
        id: member.id,
        email: member.email,
        role: member.role,
        firstName: member.firstName,
        lastName: member.lastName,
      },
    });
  } catch (err: any) {
    if (err?.status === 429)
      return res
        .set('Retry-After', String(err.retryAfter || 300))
        .status(429)
        .json({ message: err.message });
    if (err?.code === 'MFA_REQUIRED')
      return res.status(401).json({ message: err.message, code: 'MFA_REQUIRED' });
    if (err?.status === 403) return res.status(403).json({ message: err.message });
    res.status(401).json({ message: 'Invalid email, password, or authenticator code.' });
  }
});

module.exports = router;
