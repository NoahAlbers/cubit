export let organizationCurrency = 'USD';
const codes = new Set(Intl.supportedValuesOf('currency'));
export function validCurrency(value: string) {
  return codes.has(value);
}
export function setOrganizationCurrency(value: string) {
  if (!validCurrency(value)) throw Error('Invalid currency.');
  organizationCurrency = value;
}
