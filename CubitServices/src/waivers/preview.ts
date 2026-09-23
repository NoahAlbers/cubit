import { RequestHandler } from 'express'
import { createHash, createHmac, timingSafeEqual } from 'crypto'
import jwt from 'jsonwebtoken'
import { localConfig } from '../dev/config'

// A preview token is deliberately signed with a different key from login tokens.
const key=createHmac('sha256',localConfig.jwtSecret).update('cubit-waiver-preview').digest('hex')
const audience='cubit-waiver-preview'
export const unlockWaiverPreview:RequestHandler=(req,res)=>{
  const expected=process.env.WAIVER_PREVIEW_PASSWORD || (localConfig.runtimeMode==='local'?'test':'')
  const supplied=req.body?.password
  if(!expected||typeof supplied!=='string'||supplied.length>1024||!timingSafeEqual(
    createHash('sha256').update(expected).digest(),createHash('sha256').update(supplied).digest()))
    return res.status(403).json({message:'Incorrect preview password.'})
  res.json({token:jwt.sign({},key,{algorithm:'HS256',audience,subject:req.member!.id,expiresIn:'1h'})})
}
export const requireWaiverPreview:RequestHandler=(req,res,next)=>{
  try{
    const token=req.headers['x-cubit-waiver-preview']
    if(typeof token!=='string')throw Error('Missing preview token')
    const claims=jwt.verify(token,key,{algorithms:['HS256'],audience})
    if(typeof claims==='string'||claims.sub!==req.member!.id)throw Error('Wrong account')
    next()
  }catch{
    res.status(403).json({code:'WAIVER_PREVIEW_LOCKED',message:'Waivers are a work in progress. Enter the preview password to continue.'})
  }
}
