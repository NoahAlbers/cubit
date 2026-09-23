import { stat } from 'fs'

import * as jwt from 'jsonwebtoken'
import { Member } from '../../entity/member'
import { environment } from '../configuration'
import { AppDataSource } from '../../app'
import { localConfig } from '../../dev/config'
import { demoAudience } from '../../demo/identity'

export class jwtHelper {
  public static GenerateJWT(member: Member): string {
    const payload = { email: member.email, id: member.id, role: member.role }

    try {
      return jwt.sign(payload, environment.jwtSecret, {
        expiresIn: environment.jwtExpiration,
        algorithm: 'HS256',
        ...(localConfig.runtimeMode==='hosted-demo'?{audience:demoAudience}:{}),
      })
    } catch (err) {
      throw err
    }
  }

  public static ValidateJWT(token: string): any {
    try {
      const claims=jwt.verify(token, environment.jwtSecret, {algorithms:['HS256'],
        ...(localConfig.runtimeMode==='hosted-demo'?{audience:demoAudience}:{})})
      if(localConfig.runtimeMode!=='hosted-demo' && typeof claims!=='string' &&
        (claims.aud===demoAudience || Array.isArray(claims.aud)&&claims.aud.includes(demoAudience))) throw Error('Wrong workspace')
      return claims
    } catch (error) {
      throw 'Auth Failed'
    }
  }

  public static async GetMemberFromJWT(token: string): Promise<Member> {
    try {
      const decoded: any = this.ValidateJWT(token)

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
