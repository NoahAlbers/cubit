import { stat } from 'fs'

import * as jwt from 'jsonwebtoken'
import { Member } from '../../entity/member'
import { environment } from '../configuration'
import { AppDataSource } from '../../app'

export class jwtHelper {
  public static GenerateJWT(member: Member): string {
    const payload = { email: member.email, id: member.id, role: member.role }

    try {
      return jwt.sign(payload, environment.jwtSecret, {
        expiresIn: environment.jwtExpiration,
      })
    } catch (err) {
      throw err
    }
  }

  public static ValidateJWT(token: string): any {
    try {
      return jwt.verify(token, environment.jwtSecret)
    } catch (error) {
      throw 'Auth Failed'
    }
  }

  public static async GetMemberFromJWT(token: string): Promise<Member> {
    try {
      const decoded: any = jwt.verify(token, environment.jwtSecret)

      const p = await AppDataSource.manager
        .findOneOrFail(Member, decoded.email)
        .then(
          (member) => {
            return Promise.resolve(member)
          },
          (err) => {
            return Promise.reject(err)
          }
        )

      return p
    } catch (error) {
      throw 'Auth Failed'
    }
  }
}
