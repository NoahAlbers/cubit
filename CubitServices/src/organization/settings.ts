import { AppDataSource } from '../database';
import { OrganizationSettings } from '../entity/organization';
import { setOrganizationTimeZone } from './time';
let checked = 0;
let pending: Promise<void> | undefined;
export function acceptOrganizationSettings(settings: OrganizationSettings) {
  setOrganizationTimeZone(settings.timezone);
  checked = Date.now();
}
export async function refreshOrganizationSettings() {
  if (!AppDataSource.isInitialized || Date.now() - checked < 5000) return;
  pending ||= AppDataSource.manager
    .findOneByOrFail(OrganizationSettings, { id: 'default' })
    .then(acceptOrganizationSettings)
    .finally(() => {
      pending = undefined;
    });
  return pending;
}
