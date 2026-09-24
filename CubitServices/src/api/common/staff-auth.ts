import { auditActor } from '../../staff/audit'
import { Request, Response, NextFunction } from 'express'
import { AppDataSource } from '../../app'
import { Member, ROLES } from '../../entity/member'
import { jwtHelper } from './jwtHelper'

export async function staffOnly(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1]
    if (!token) return res.status(401).json({ message: 'Please sign in.' })
    const decoded = jwtHelper.ValidateJWT(token)
    if(typeof decoded?.id!=='string')throw Error('Invalid identity')
    const member = await AppDataSource.manager.findOneBy(Member, { id: decoded.id })
    if (!member || !jwtHelper.sessionMatches(decoded, member)) return res.status(401).json({ message: 'Please sign in.' })
    if (member.role !== ROLES.ADMIN) return res.status(403).json({ message: 'Staff access is required.' })
    req.member = member
    auditActor.run({id:member.id,email:member.email},()=>next())
  } catch {
    return res.status(401).json({ message: 'Your session has expired. Please sign in again.' })
  }
}
