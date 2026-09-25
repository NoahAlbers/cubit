import { localConfig } from '../dev/config';
import { fail } from '../billing/payments';

export const demoWaiversAllowed = () => ['local', 'hosted-demo'].includes(localConfig.runtimeMode);
export const usableWaiverProvider = (provider: string) =>
  provider !== 'demo' || demoWaiversAllowed();
export function requireUsableWaiverProvider(provider: string) {
  if (!usableWaiverProvider(provider))
    fail(
      'Demo waivers are only available in local and synthetic-demo workspaces. Publish a paper or DocuSeal version instead.',
      403,
    );
}
export const countsAsSigned = (s: { provider: string; status: string } | null | undefined) =>
  !!s && s.status === 'Signed' && usableWaiverProvider(s.provider);
