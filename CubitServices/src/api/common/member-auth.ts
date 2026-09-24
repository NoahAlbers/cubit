import { Request, Response, NextFunction } from 'express';
import { AppDataSource } from '../../database';
import { Member } from '../../entity/member';
import { jwtHelper } from './jwtHelper';

export async function signedIn(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) return res.status(401).json({ message: 'Please sign in.' });
    const identity = jwtHelper.ValidateJWT(token);
    if (typeof identity.id !== 'string') throw Error('Invalid identity');
    const member = await AppDataSource.manager.findOneBy(Member, { id: identity.id });
    if (!member || !jwtHelper.sessionMatches(identity, member)) throw Error('Expired session');
    req.member = member;
    next();
  } catch {
    res.status(401).json({ message: 'Please sign in again.' });
  }
}
