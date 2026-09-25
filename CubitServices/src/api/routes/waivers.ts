import { route, bodies } from '../common/request-schema';
import { recordAudit } from '../../staff/audit';
import express from 'express';
import { AppDataSource } from '../../database';
import { staffOnly } from '../common/staff-auth';
import { Waiver, WaiverVersion, WaiverSignature } from '../../entity/waiver';

import { directoryRows } from '../../billing/directory';
import { publishWaiver, publicSignature, memberWaivers, syncSigning } from '../../waivers/store';
import { docusealConfig } from '../../waivers/docuseal';
import { fail } from '../../billing/payments';
import { WaiverDocument } from '../../entity/waiverDocument';
import { limitWaiverUploads } from '../../waivers/upload-limit';
import { demoWaiversAllowed, usableWaiverProvider, countsAsSigned } from '../../waivers/policy';
import {
  documentLimit,
  uploadDocument,
  reviewDocument,
  sendDocument,
  publicDocument,
} from '../../waivers/documents';

const router = express.Router();
router.use(staffOnly);
router.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
router.post(
  '/documents/template',
  limitWaiverUploads,
  express.raw({ type: 'application/octet-stream', limit: documentLimit }),
  route(bodies.document, async (req, res) =>
    res
      .status(201)
      .json(
        await uploadDocument(
          null,
          null,
          req.body,
          String(req.headers['x-cubit-filename'] || 'waiver'),
          req.member,
          true,
        ),
      ),
  ),
);
router.post(
  '/members/:memberId/versions/:versionId/documents',
  limitWaiverUploads,
  express.raw({ type: 'application/octet-stream', limit: documentLimit }),
  route(bodies.document, async (req, res) =>
    res
      .status(201)
      .json(
        await uploadDocument(
          req.params.memberId,
          req.params.versionId,
          req.body,
          String(req.headers['x-cubit-filename'] || 'waiver'),
          req.member,
          true,
        ),
      ),
  ),
);
router.get(
  '/documents/:id',
  route(async (req, res) => sendDocument(req, res, true)),
);
router.post(
  '/documents/:id/review',
  route(bodies.review, async (req, res) =>
    res.json(await reviewDocument(req.params.id, req.body, req.member.email)),
  ),
);
router.get(
  '/',
  route(async (req, res) => {
    const [waivers, versions, signatures, members] = await Promise.all([
      AppDataSource.manager.find(Waiver),
      AppDataSource.manager.find(WaiverVersion, { order: { createdAt: 'DESC', number: 'DESC' } }),
      AppDataSource.manager.find(WaiverSignature, { order: { createdAt: 'DESC' } }),
      directoryRows(),
    ]);
    const required = waivers.filter((w) => w.required && !w.archived);
    const documents = await AppDataSource.manager.find(WaiverDocument, {
      order: { createdAt: 'DESC' },
    });
    const accepted = (memberId: string, versionId: string) =>
      usableWaiverProvider(versions.find((v) => v.id === versionId)?.provider || 'demo') &&
      (signatures.some(
        (s) => s.memberId === memberId && s.versionId === versionId && countsAsSigned(s),
      ) ||
        documents.some(
          (d) => d.memberId === memberId && d.versionId === versionId && d.status === 'Accepted',
        ));
    const compliance = members.map((m) => ({
      id: m.id,
      name: `${m.firstName} ${m.lastName}`,
      email: m.email,
      status: m.status,
      missing: required
        .filter((w) => !accepted(m.id, w.currentVersionId))
        .map((w) => ({ id: w.id, name: w.name })),
      signed: required.filter((w) => accepted(m.id, w.currentVersionId)).length,
    }));
    res.json({
      docusealConnected: docusealConfig().enabled,
      demoAllowed: demoWaiversAllowed(),
      docusealUrl: docusealConfig().publicUrl,
      documents: documents.map((d) => ({
        ...publicDocument(d),
        memberName: members.find((m) => m.id === d.memberId)
          ? `${members.find((m) => m.id === d.memberId)!.firstName} ${members.find((m) => m.id === d.memberId)!.lastName}`
          : '',
        versionName: versions.find((v) => v.id === d.versionId)?.name,
      })),
      waivers: waivers.map((w) => ({
        ...w,
        version: versions.find((v) => v.id === w.currentVersionId),
        versions: versions
          .filter((v) => v.waiverId === w.id)
          .map((v) => ({
            ...v,
            signedCount: signatures.filter((s) => s.versionId === v.id && countsAsSigned(s)).length,
          })),
      })),
      compliance,
      summary: {
        active: compliance.filter((m) => m.status === 'Active').length,
        missing: compliance.filter((m) => m.status === 'Active' && m.missing.length).length,
        complete: compliance.filter((m) => m.status === 'Active' && !m.missing.length).length,
        required: required.length,
      },
      signatures: signatures.map((s) => ({
        ...publicSignature(s),
        memberId: s.memberId,
        memberName:
          members.find((m) => m.id === s.memberId)?.firstName +
          ' ' +
          members.find((m) => m.id === s.memberId)?.lastName,
        version: versions.find((v) => v.id === s.versionId),
      })),
    });
  }),
);
router.post(
  '/',
  route(bodies.waiver, async (req, res) =>
    res.status(201).json(await publishWaiver(undefined, req.body, req.member.email)),
  ),
);
router.post(
  '/:id/versions',
  route(bodies.waiver, async (req, res) =>
    res.status(201).json(await publishWaiver(req.params.id, req.body, req.member.email)),
  ),
);
router.post(
  '/:id/archive',
  route(bodies.archive, async (req, res) => {
    if (typeof req.body.archived !== 'boolean') fail('Choose archive or restore.');
    res.json(
      await AppDataSource.transaction(async (manager) => {
        const waiver = await manager.findOne(Waiver, {
          where: { id: req.params.id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!waiver) fail('Waiver not found.', 404);
        if (req.body.revision !== waiver.revision)
          fail('This waiver changed. Reload before saving.', 409);
        const before = { name: waiver.name, archived: waiver.archived };
        waiver.archived = req.body.archived;
        waiver.revision++;
        await manager.save(waiver);
        await recordAudit(manager, {
          kind: waiver.archived ? 'Waiver archived' : 'Waiver restored',
          author: req.member.email,
          entityId: waiver.id,
          before,
          after: { name: waiver.name, archived: waiver.archived },
        });
        return waiver;
      }),
    );
  }),
);
router.get(
  '/members/:id',
  route(async (req, res) => res.json(await memberWaivers(req.params.id, false))),
);
router.post(
  '/signatures/:id/sync',
  route(async (req, res) => {
    const signature = await AppDataSource.manager.findOneBy(WaiverSignature, { id: req.params.id });
    if (!signature) fail('Signing request not found.', 404);
    res.json(await syncSigning(signature.memberId, signature.id));
  }),
);
module.exports = router;
