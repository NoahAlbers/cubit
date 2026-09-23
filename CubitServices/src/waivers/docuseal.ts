import axios from 'axios'
import {createHash} from 'crypto'
import { WaiverVersion, WaiverSignature } from '../entity/waiver'
import { fail } from '../billing/payments'

// Opt-in only. No network calls or third-party scripts in the local demo.
export function docusealConfig() {
  const enabled = process.env.DOCUSEAL_ENABLED === 'true'
  const key = process.env.DOCUSEAL_API_KEY || ''
  const apiUrl=(process.env.DOCUSEAL_API_URL || 'https://api.docuseal.com').replace(/\/$/,'')
  const publicUrl=(process.env.DOCUSEAL_PUBLIC_URL || 'https://docuseal.com').replace(/\/$/,'')
  const publicOrigin=new URL(publicUrl)
  if(publicOrigin.protocol!=='https:'||publicOrigin.username||publicOrigin.password||publicOrigin.pathname!=='/')fail('Invalid DocuSeal public URL.',503)
  return { enabled: enabled && !!key, key, apiUrl, publicUrl }
}
async function api(method: 'GET'|'POST', path: string, data?: any) {
  const config = docusealConfig()
  if (!config.enabled) fail('DocuSeal is not connected. Use the local demo or configure a sandbox API key.', 503)
  try {
    return (await axios({ method, url: config.apiUrl + path, data, timeout: 15000,
      maxRedirects: 0, headers: { 'X-Auth-Token': config.key } })).data
  } catch { fail('DocuSeal could not be reached. Please try checking the signing status again.', 502) }
}
export async function validateTemplate(id: number, role: string) {
  const template = await api('GET', `/templates/${id}`)
  if (template.archived_at || template.submitters?.length !== 1 || template.submitters[0].name !== role)
    fail('Choose a DocuSeal template with exactly one signer and a matching signer role.')
  if(!template.fields?.some((f:any)=>f.type==='signature'&&f.required))fail('The template needs a required signature field.')
  if(template.documents?.length!==1)fail('Choose a template containing one PDF. Combine all pages into one PDF first.')
  const original=await downloadSigningFile(template.documents[0].url)
  const sha256=createHash('sha256').update(original).digest('hex')
  const fingerprint=createHash('sha256').update(JSON.stringify({sha256,fields:template.fields,submitters:template.submitters,schema:template.schema})).digest('hex')
  return {sha256,fingerprint}
}
export async function createSigning(version: WaiverVersion, signature: WaiverSignature) {
  const template=await validateTemplate(version.docusealTemplateId,version.signerRole)
  if(version.providerFingerprint!==template.fingerprint)fail('This DocuSeal template changed after publication. Staff must publish a new waiver version.',409)
  const result = await api('POST', '/submissions', { template_id: version.docusealTemplateId, send_email: false, send_sms: false,
    submitters: [{ name: signature.signerName, email: signature.signerEmail, role: version.signerRole,
      external_id: signature.id, send_email: false, send_sms: false }] })
  if (!Array.isArray(result) || result.length !== 1 || !Number.isSafeInteger(result[0].submission_id) || !Number.isSafeInteger(result[0].id) || !/^[a-zA-Z0-9]+$/.test(result[0].slug))
    fail('DocuSeal returned an unexpected signing request.', 502)
  return result[0]
}
export async function retrieveSigning(signature: WaiverSignature) {
  // Recover an uncertain creation without creating another signing request.
  if (!signature.submissionId) {
    const found = await api('GET', `/submitters?external_id=${encodeURIComponent(signature.id)}`)
    if (!Array.isArray(found.data) || found.data.length !== 1) fail('Signing request needs staff review in DocuSeal. A duplicate request has not been created.', 409)
    return api('GET', `/submissions/${Number(found.data[0].submission_id)}`)
  }
  return api('GET', `/submissions/${signature.submissionId}`)
}
export function verifiedCompletion(data: any, signature: WaiverSignature, version: WaiverVersion) {
  const signer = data.submitters?.find((s: any) => s.external_id === signature.id)
  if (!Number.isSafeInteger(data.id) || data.template?.id !== version.docusealTemplateId || !signer ||
      signer.email?.toLowerCase() !== signature.signerEmail.toLowerCase() ||
      (signature.submissionId && signature.submissionId !== data.id) || !Number.isSafeInteger(signer.id) ||
      !/^[a-zA-Z0-9]+$/.test(signer.slug)) fail('DocuSeal signing details do not match this waiver.', 502)
  const completed = data.status === 'completed' && signer.status === 'completed' && !!signer.completed_at && Number.isFinite(Date.parse(signer.completed_at))
  const url = data.documents?.[0]?.url
  let documentUrl: string | undefined
  if (completed && typeof url === 'string') {
    const parsed = new URL(url)
    if (parsed.origin === new URL(docusealConfig().publicUrl).origin && !parsed.username && !parsed.password) documentUrl = url
  }
  return { submissionId: data.id, submitterId: signer.id, slug: signer.slug,
    status: completed ? 'Signed' : ['declined','expired'].includes(data.status) ? 'Needs review' : 'Pending',
    completedAt: completed ? new Date(signer.completed_at) : null, documentUrl: documentUrl || null }
}

// Only provider-owned file paths may be downloaded. Never follow redirects or
// attach the API key to a file URL. Self-hosted downloads stay on loopback.
export async function downloadSigningFile(url:string) {
  const config=docusealConfig(), parsed=new URL(url)
  if(!config.enabled||parsed.origin!==new URL(config.publicUrl).origin||parsed.username||parsed.password||
    !/^\/(rails\/active_storage\/|file\/|blobs_proxy\/)/.test(parsed.pathname))fail('DocuSeal returned an unexpected document location.',502)
  const base=new URL(config.apiUrl)
  const target=base.hostname==='127.0.0.1'?base.origin+parsed.pathname+parsed.search:parsed.href
  try {
    const response=await axios.get(target,{responseType:'arraybuffer',timeout:30000,maxRedirects:0,maxContentLength:10*1024*1024})
    return Buffer.from(response.data)
  }catch{fail('The signed file could not be archived yet. Check signing status again.',502)}
}
