import * as jwt from 'jsonwebtoken'
import { Member } from '../../entity/member'
import { environment } from '../configuration'
import { localConfig } from '../../dev/config'
import { demoAudience } from '../../demo/identity'

export class jwtHelper {
  public static GenerateJWT(member: Member, mfaVerified = false): string {
    const payload = { email: member.email, id: member.id, role: member.role, tokenVersion: member.tokenVersion ?? 0, mfaVerified }

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

  public static sessionMatches(identity: any, member: Member | null): boolean {
    return !!member && !member.loginDisabled && Number.isSafeInteger(identity?.tokenVersion) &&
      identity.tokenVersion >= 0 && identity.tokenVersion === member.tokenVersion &&
      (member.role!=='admin'||process.env.REQUIRE_STAFF_MFA!=='true'||identity.mfaVerified===true)
  }
}
