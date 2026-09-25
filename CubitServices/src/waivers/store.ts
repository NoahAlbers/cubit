import { recordAudit } from '../staff/audit';
import { AppDataSource } from '../database';
import { Waiver, WaiverVersion, WaiverSignature } from '../entity/waiver';
import { Member } from '../entity/member';

import { fail, reasonText } from '../billing/payments';
import {
  createSigning,
  retrieveSigning,
  verifiedCompletion,
  validateTemplate,
  docusealConfig,
  downloadSigningFile,
} from './docuseal';
import { WaiverDocument } from '../entity/waiverDocument';
import { publicDocument, inspectDocument } from './documents';
import { requireUsableWaiverProvider, usableWaiverProvider, countsAsSigned } from './policy';

export function publicSignature(s: WaiverSignature) {
  return {
    id: s.id,
    versionId: s.versionId,
    waiverId: s.waiverId,
    provider: s.provider,
    status: usableWaiverProvider(s.provider) ? s.status : 'Demo only',
    signerName: s.signerName,
    completedAt: s.completedAt,
    createdAt: s.createdAt,
    documentUrl: null,
    signingUrl:
      s.provider === 'docuseal' && s.slug && s.status !== 'Signed'
        ? `${docusealConfig().publicUrl}/s/${s.slug}`
        : null,
  };
}
function publicVersion(v: WaiverVersion) {
  return {
    id: v.id,
    number: v.number,
    name: v.name,
    description: v.description,
    demoText: v.demoText,
    provider: v.provider,
    createdAt: v.createdAt,
  };
}
export async function memberWaivers(memberId: string, includeTemplates = true) {
  const [waivers, versions, signatures] = await Promise.all([
    AppDataSource.manager.find(Waiver),
    AppDataSource.manager.find(WaiverVersion),
    AppDataSource.manager.find(WaiverSignature, {
      where: { memberId },
      order: { createdAt: 'DESC' },
    }),
  ]);
  const current = waivers
    .filter((w) => !w.archived && w.currentVersionId)
    .map((w) => {
      const version = versions.find((v) => v.id === w.currentVersionId)!;
      const signature = signatures.find((s) => s.versionId === version.id);
      return {
        id: w.id,
        required: w.required,
        version: publicVersion(version),
        signature: signature ? publicSignature(signature) : null,
      };
    });
  const allDocuments = await AppDataSource.manager.find(WaiverDocument, {
    where: includeTemplates ? [{ memberId }, { source: 'template' }] : { memberId },
    order: { createdAt: 'DESC' },
  });
  const documents = allDocuments
    .filter((d) => d.memberId === memberId || !!d.versionId)
    .map((d) => ({
      ...publicDocument(d),
      versionName: versions.find((v) => v.id === d.versionId)?.name,
    }));
  const items = current.map((w) => ({
    ...w,
    complete:
      usableWaiverProvider(w.version.provider) &&
      (countsAsSigned(w.signature) ||
        documents.some(
          (d) => d.memberId === memberId && d.versionId === w.version.id && d.status === 'Accepted',
        )),
  }));
  const records = versions
    .filter(
      (v) =>
        items.some((w) => w.version.id === v.id) ||
        signatures.some((s) => s.versionId === v.id) ||
        documents.some((d) => d.memberId === memberId && d.versionId === v.id),
    )
    .map((v) => {
      const currentWaiver = items.find((w) => w.version.id === v.id);
      const signature = signatures.find((s) => s.versionId === v.id);
      const files = documents.filter((d) => d.memberId === memberId && d.versionId === v.id);
      const complete =
        usableWaiverProvider(v.provider) &&
        (countsAsSigned(signature) || files.some((d) => d.status === 'Accepted'));
      const pending = files.some((d) => d.status === 'Pending review');
      return {
        version: publicVersion(v),
        current: !!currentWaiver,
        required: currentWaiver?.required || false,
        signature: signature ? publicSignature(signature) : null,
        documents: files,
        complete,
        status: pending
          ? 'Needs review'
          : complete
            ? 'Complete'
            : files.some((d) => d.status === 'Rejected')
              ? 'Needs replacement'
              : 'Needs signature',
        canUpload: !!currentWaiver && !complete && !pending,
      };
    })
    .sort(
      (a, b) =>
        Number(b.current) - Number(a.current) ||
        new Date(b.version.createdAt).getTime() - new Date(a.version.createdAt).getTime(),
    );
  return {
    current: items,
    records,
    documents,
    history: signatures
      .filter((s) => s.status === 'Signed')
      .map((s) => ({
        ...publicSignature(s),
        version: publicVersion(versions.find((v) => v.id === s.versionId)!),
      })),
    missing: items.filter((w) => w.required && !w.complete).length,
  };
}

export async function publishWaiver(id: string | undefined, input: any, author: string) {
  requireUsableWaiverProvider(input.provider);
  const name = reasonText(input.name, 150),
    description = reasonText(input.description, 2000);
  if (
    typeof input.required !== 'boolean' ||
    !['demo', 'docuseal', 'paper'].includes(input.provider)
  )
    fail('Choose a valid waiver type and requirement.');
  const demoText = input.provider === 'demo' ? reasonText(input.demoText, 20000) : '';
  const signerRole = input.provider === 'docuseal' ? reasonText(input.signerRole, 100) : 'Member';
  let providerTemplate: { sha256: string; fingerprint: string } | undefined;
  if (input.provider === 'docuseal') {
    if (!Number.isSafeInteger(input.docusealTemplateId) || input.docusealTemplateId < 1)
      fail('Enter a valid DocuSeal template ID.');
    // Published versions must not share a mutable DocuSeal template.
    if (
      await AppDataSource.manager.countBy(WaiverVersion, {
        docusealTemplateId: input.docusealTemplateId,
      })
    )
      fail('Clone the DocuSeal template before publishing a new version.', 409);
    providerTemplate = await validateTemplate(input.docusealTemplateId, signerRole);
  }
  return AppDataSource.transaction(async (manager) => {
    const document = input.sourceDocumentId
      ? await manager.findOne(WaiverDocument, {
          where: { id: input.sourceDocumentId, source: 'template' },
          lock: { mode: 'pessimistic_write' },
        })
      : null;
    if (input.provider !== 'demo' && (!document || document.versionId))
      fail('Upload a fresh PDF for this waiver version before publishing.');
    if (providerTemplate && document!.sha256 !== providerTemplate.sha256)
      fail('The uploaded PDF must match the original PDF in the DocuSeal template.');
    const waiver = id
      ? await manager.findOne(Waiver, { where: { id }, lock: { mode: 'pessimistic_write' } })
      : manager.create(Waiver, { name, revision: 0 });
    if (!waiver) fail('Waiver not found.', 404);
    if (id && input.revision !== waiver.revision)
      fail('This waiver changed. Reload before publishing.', 409);
    if (waiver.archived) fail('Restore the waiver before publishing a new version.', 409);
    const before = id
      ? { name: waiver.name, required: waiver.required, currentVersionId: waiver.currentVersionId }
      : null;
    if (!id) await manager.save(waiver);
    const number = (await manager.countBy(WaiverVersion, { waiverId: waiver.id })) + 1;
    const version = await manager.save(
      WaiverVersion,
      manager.create(WaiverVersion, {
        waiverId: waiver.id,
        number,
        name,
        description,
        demoText,
        provider: input.provider,
        docusealTemplateId: input.provider === 'docuseal' ? input.docusealTemplateId : null,
        providerFingerprint: providerTemplate?.fingerprint,
        signerRole,
        author,
      }),
    );
    if (document) {
      document.versionId = version.id;
      await manager.save(document);
    }
    waiver.name = name;
    waiver.required = input.required;
    waiver.currentVersionId = version.id;
    waiver.revision++;
    await manager.save(waiver);
    await recordAudit(manager, {
      kind: 'Waiver published',
      author,
      entityId: waiver.id,
      before,
      after: {
        name: waiver.name,
        required: waiver.required,
        currentVersionId: waiver.currentVersionId,
      },
      reason: 'Published version ' + number,
    });
    return { ...waiver, version };
  });
}

export async function startSigning(member: Member, versionId: string) {
  const version = await AppDataSource.manager.findOneBy(WaiverVersion, { id: versionId });
  if (!version) fail('Waiver not found.', 404);
  requireUsableWaiverProvider(version.provider);
  if (version.provider === 'paper')
    fail(
      'Download this waiver, sign it, then upload the completed PDF or photos for staff review.',
    );
  if (version.provider === 'docuseal' && !docusealConfig().enabled)
    fail('DocuSeal is not connected yet.', 503);
  // Commit the reservation before contacting DocuSeal; ambiguous failures can be recovered.
  const reservation = await AppDataSource.transaction(async (manager) => {
    const waiver = await manager.findOne(Waiver, {
      where: { id: version.waiverId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!waiver || waiver.archived || waiver.currentVersionId !== versionId)
      fail('This waiver was updated. Reload to sign the current version.', 409);
    const existing = await manager.findOneBy(WaiverSignature, { memberId: member.id, versionId });
    if (existing) return { signature: existing, created: false };
    const signature = await manager.save(
      WaiverSignature,
      manager.create(WaiverSignature, {
        memberId: member.id,
        waiverId: waiver.id,
        versionId,
        provider: version.provider,
        signerEmail: member.email,
        signerName: `${member.firstName} ${member.lastName}`,
        status: version.provider === 'demo' ? 'Pending' : 'Preparing',
      }),
    );
    return { signature, created: true };
  });
  if (reservation.created && version.provider === 'docuseal') {
    try {
      const result = await createSigning(version, reservation.signature);
      await AppDataSource.manager.update(WaiverSignature, reservation.signature.id, {
        submissionId: result.submission_id,
        submitterId: result.id,
        slug: result.slug,
        status: 'Pending',
      });
    } catch (err) {
      await AppDataSource.manager.update(WaiverSignature, reservation.signature.id, {
        status: 'Needs review',
      });
      throw err;
    }
  }
  return publicSignature(
    await AppDataSource.manager.findOneByOrFail(WaiverSignature, { id: reservation.signature.id }),
  );
}

export async function completeDemo(memberId: string, id: string, input: any) {
  requireUsableWaiverProvider('demo');
  const name = reasonText(input.name, 150);
  if (input.acknowledged !== true) fail('Confirm that this is a demonstration.');
  return AppDataSource.transaction(async (manager) => {
    const lookup = await manager.findOneBy(WaiverSignature, { id, memberId });
    if (!lookup) fail('Signing request not found.', 404);
    const waiver = await manager.findOne(Waiver, {
      where: { id: lookup.waiverId },
      lock: { mode: 'pessimistic_write' },
    });
    const signature = await manager.findOneByOrFail(WaiverSignature, { id, memberId });
    if (signature.provider !== 'demo') fail('DocuSeal must verify this signature.', 403);
    if (signature.status === 'Signed') return publicSignature(signature);
    if (!waiver || waiver.archived || waiver.currentVersionId !== signature.versionId)
      fail('This waiver was updated. Reload before signing.', 409);
    signature.signerName = name;
    signature.status = 'Signed';
    signature.completedAt = new Date();
    await manager.save(signature);
    await recordAudit(manager, {
      memberId,
      kind: 'Demo waiver signed',
      author: signature.signerEmail,
      actorType: 'member',
      entityId: id,
      after: { versionId: signature.versionId, status: signature.status },
      reason: 'Demonstration only',
    });
    return publicSignature(signature);
  });
}

export async function syncSigning(memberId: string, id: string) {
  const signature = await AppDataSource.manager.findOneBy(WaiverSignature, { id, memberId });
  if (!signature) fail('Signing request not found.', 404);
  if (signature.provider === 'demo') {
    requireUsableWaiverProvider('demo');
    return publicSignature(signature);
  }
  if (
    signature.status === 'Signed' &&
    (await AppDataSource.manager.countBy(WaiverDocument, {
      signatureId: id,
      source: 'signed document',
    }))
  )
    return publicSignature(signature);
  const version = await AppDataSource.manager.findOneByOrFail(WaiverVersion, {
    id: signature.versionId,
  });
  const result = await retrieveSigning(signature),
    verified = verifiedCompletion(result, signature, version);
  const files: { content: Buffer; source: string; filename: string }[] = [];
  if (verified.status === 'Signed') {
    if (!Array.isArray(result.documents) || result.documents.length !== 1)
      fail(
        'This integration expects one signed waiver PDF. Contact staff to archive this submission.',
        409,
      );
    if (!verified.documentUrl || !result.audit_log_url)
      fail(
        'DocuSeal is preparing the signed document and audit certificate. Check again shortly.',
        409,
      );
    files.push({
      content: await downloadSigningFile(verified.documentUrl),
      source: 'signed document',
      filename: version.name + '.pdf',
    });
    files.push({
      content: await downloadSigningFile(result.audit_log_url),
      source: 'signing certificate',
      filename: version.name + '-audit.pdf',
    });
  }
  await AppDataSource.transaction(async (manager) => {
    const current = await manager.findOneOrFail(WaiverSignature, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (
      current.status === 'Signed' &&
      (await manager.countBy(WaiverDocument, { signatureId: id, source: 'signed document' }))
    )
      return;
    for (const file of files) {
      const inspected = inspectDocument(file.content, file.filename);
      if (inspected.mime !== 'application/pdf')
        fail('DocuSeal returned an invalid signed PDF.', 502);
      await manager.save(
        WaiverDocument,
        manager.create(WaiverDocument, {
          ...inspected,
          content: file.content,
          memberId,
          versionId: version.id,
          signatureId: id,
          source: file.source,
          status: 'Stored',
          uploadedBy: 'DocuSeal',
        }),
      );
    }
    if (current.status !== 'Signed' || verified.status === 'Signed')
      await manager.update(WaiverSignature, id, { ...verified, documentUrl: null } as any);
    if (files.length)
      await recordAudit(manager, {
        memberId,
        kind: 'Signed waiver archived',
        author: 'DocuSeal',
        entityId: id,
        after: { versionId: version.id, completedAt: verified.completedAt, files: files.length },
      });
  });
  return publicSignature(await AppDataSource.manager.findOneByOrFail(WaiverSignature, { id }));
}
