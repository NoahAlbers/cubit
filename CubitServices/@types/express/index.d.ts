import { Member } from '../../src/entity/member';

declare global {
  namespace Express {
    interface Request {
      member: Member;
    }
  }
}
