import { createHash } from 'crypto';
import { AppDataSource } from '../database';
import { WaiverDocument } from '../entity/waiverDocument';
import { Waiver, WaiverVersion } from '../entity/waiver';
import { Member } from '../entity/member';
import { fail, reasonText } from '../billing/payments';
import { recordAudit } from '../staff/audit';

export const documentLimit = 10 * 1024 * 1024;
export function inspectDocument(content: Buffer, name: string) {
  if (!Buffer.isBuffer(content) || content.length < 12 || content.length > documentLimit)
    fail('Choose a PDF, JPG or PNG up to 10 MB.');
  let mime = '',
    extension = '';
  if (
    content.subarray(0, 5).toString() === '%PDF-' &&
    content.subarray(-2048).includes(Buffer.from('%%EOF'))
  ) {
    mime = 'application/pdf';
    extension = 'pdf';
  }
  if (content.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    mime = 'image/png';
    extension = 'png';
  }
  if (
    content[0] === 255 &&
    content[1] === 216 &&
    content[2] === 255 &&
    content[content.length - 2] === 255 &&
    content[content.length - 1] === 217
  ) {
    mime = 'image/jpeg';
    extension = 'jpg';
  }
  if (!mime) fail('This file is not a supported PDF, JPG or PNG. Export HEIC photos as JPG first.');
  const stem =
    String(name || 'waiver')
      .replace(/\.[^.]*$/, '')
      .replace(/[^a-zA-Z0-9 _.-]/g, '_')
      .slice(0, 100) || 'waiver';
  return {
    mime,
    filename: stem + '.' + extension,
    bytes: content.length,
    sha256: createHash('sha256').update(content).digest('hex'),
  };
}
export function publicDocument(d: WaiverDocument) {
  return {
    id: d.id,
    memberId: d.memberId,
    versionId: d.versionId,
    filename: d.filename,
    mime: d.mime,
    bytes: d.bytes,
    sha256: d.sha256,
    source: d.source,
    status: d.status,
    createdAt: d.createdAt,
    reviewedAt: d.reviewedAt,
    reviewNote: d.reviewNote,
    revision: d.revision,
  };
}
export async function uploadDocument(
  memberId: string | null,
  versionId: string | null,
  content: Buffer,
  filename: string,
  actor: Member,
  staff: boolean,
) {
  const file = inspectDocument(content, filename);
  if (!memberId && (!staff || file.mime !== 'application/pdf'))
    fail('Template documents must be PDF files.');
  return AppDataSource.transaction(async (manager) => {
    // Serialize uploads by uploader, including quotas, to bound shared demo storage.
    await manager.findOneOrFail(Member, {
      where: { id: actor.id },
      lock: { mode: 'pessimistic_write' },
    });
    const total = await manager
      .createQueryBuilder(WaiverDocument, 'd')
      .select('COALESCE(SUM(d.bytes),0)', 'bytes')
      .where('d.uploadedBy=:email', { email: actor.email })
      .getRawOne();
    if (Number(total.bytes) + file.bytes > 250 * 1024 * 1024)
      fail('Your upload allowance has been reached. Contact staff.', 413);
    if (memberId) {
      if (!staff && memberId !== actor.id) fail('Not found.', 404);
      if (!(await manager.countBy(Member, { id: memberId }))) fail('Member not found.', 404);
      if (!versionId) fail('Choose the waiver this document belongs to.');
      const version = await manager.findOneBy(WaiverVersion, { id: versionId });
      if (!version) fail('Waiver not found.', 404);
      const waiver = await manager.findOneBy(Waiver, { id: version.waiverId });
      if (!staff && (!waiver || waiver.archived || waiver.currentVersionId !== versionId))
        fail('This waiver was updated. Reload before uploading.', 409);
    }
    const saved = await manager.save(
      WaiverDocument,
      manager.create(WaiverDocument, {
        ...file,
        content,
        memberId: memberId!,
        versionId: versionId!,
        source: memberId ? (staff ? 'staff upload' : 'member upload') : 'template',
        status: memberId ? 'Pending review' : 'Template',
        uploadedBy: actor.email,
      }),
    );
    await recordAudit(manager, {
      memberId: memberId || undefined,
      kind: memberId ? 'Waiver document uploaded' : 'Waiver template uploaded',
      author: actor.email,
      actorType: staff ? 'staff' : 'member',
      entityId: saved.id,
      after: { filename: saved.filename, sha256: saved.sha256, versionId, status: saved.status },
    });
    return publicDocument(saved);
  });
}
export async function reviewDocument(id: string, input: any, author: string) {
  if (!['Accepted', 'Rejected'].includes(input.status)) fail('Choose accept or reject.');
  const note = reasonText(input.reason, 2000);
  return AppDataSource.transaction(async (manager) => {
    const d = await manager.findOne(WaiverDocument, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!d || !['staff upload', 'member upload'].includes(d.source))
      fail('Uploaded waiver not found.', 404);
    if (d.revision !== input.revision) fail('This document changed. Reload before reviewing.', 409);
    const before = { status: d.status, reviewNote: d.reviewNote };
    d.status = input.status;
    d.reviewNote = note;
    d.reviewedBy = author;
    d.reviewedAt = new Date();
    d.revision++;
    await manager.save(d);
    await recordAudit(manager, {
      memberId: d.memberId,
      kind: 'Waiver document reviewed',
      author,
      entityId: id,
      before,
      after: { status: d.status, reviewNote: note },
      reason: note,
    });
    return publicDocument(d);
  });
}
export async function sendDocument(req: any, res: any, staff: boolean) {
  const d = await AppDataSource.manager
    .createQueryBuilder(WaiverDocument, 'd')
    .addSelect('d.content')
    .where('d.id=:id', { id: req.params.id })
    .getOne();
  if (
    !d ||
    (!staff && d.memberId !== req.member.id && d.source !== 'template') ||
    (!staff && d.source === 'template' && !d.versionId)
  )
    fail('Document not found.', 404);
  res.set({
    'Content-Type': d.mime,
    'Content-Disposition': `attachment; filename="${d.filename}"`,
    'Content-Length': String(d.bytes),
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
    'Content-Security-Policy': "default-src 'none'; sandbox",
  });
  res.send(d.content);
}
