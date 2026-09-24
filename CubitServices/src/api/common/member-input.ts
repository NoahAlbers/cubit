import { normalizeContact } from '../../contact/validation';

const fields = new Set([
  'id',
  'firstName',
  'lastName',
  'email',
  'paypalEmail',
  'phone',
  'emergencyContact',
  'emergencyEmail',
  'emergencyPhone',
  'picture',
  'role',
  'password',
]);

export function memberInput(body: unknown, creating = false): any {
  const invalid = (message: string): never => {
    throw Object.assign(new Error(message), { status: 400 });
  };
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('Enter member details.');
  const input = body as Record<string, unknown>;
  if (Object.keys(input).some((key) => !fields.has(key))) invalid('Unexpected member field.');
  if (
    typeof input.id !== 'string' ||
    !input.id.trim() ||
    input.id.length > 64 ||
    (creating ? input.id !== 'New' : input.id === 'New')
  )
    invalid(creating ? 'Use New when creating a member.' : 'A member ID is required.');
  if ('role' in input && !['member', 'staff', 'admin'].includes(input.role as string))
    invalid('Choose Member, Staff User, or Administration.');
  if ('picture' in input && input.picture !== null && typeof input.picture !== 'string')
    invalid('Picture must be a string or null.');
  if ('password' in input && typeof input.password !== 'string') invalid('Password must be text.');
  if (
    'emergencyContact' in input &&
    input.emergencyContact !== null &&
    (typeof input.emergencyContact !== 'string' || input.emergencyContact.length > 150)
  )
    invalid('Enter a valid emergency contact name.');
  return normalizeContact({ ...input }, creating);
}
