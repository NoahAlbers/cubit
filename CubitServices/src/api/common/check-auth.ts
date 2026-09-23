import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { Member } from '../../entity/member';
import { environment } from '../configuration';

export const VerifyLoggedIn = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    //assume they are giving us an authorization header with a value starting with Bearer
    let token = '';

    if (req.headers && req.headers.authorization) {
      token = req.headers.authorization.split(' ')[1];
    }

    const decoded: any = jwt.verify(token, environment.jwtSecret);

    const memberClass = new Member();
    memberClass.GetMemberByEmail(decoded.email).then(
      (member) => {
        req.member = member;
        next();
      },
      (err) => {
        res.status(401).json({ message: 'Auth Failed' });
      }
    );
  } catch (error) {
    res.status(401).json({ message: 'Auth Failed' });
  }
};
