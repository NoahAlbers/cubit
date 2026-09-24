import fs from 'fs';
import path from 'path';

// SecLists 10k-most-common.txt, MIT; see SECLISTS-LICENSE.txt alongside it.
// Read the shipped list once. Missing policy data must fail closed at startup.
const common = new Set(
  fs
    .readFileSync(path.resolve(__dirname, '../../src/security/common-passwords.txt'), 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((value) => value.toLowerCase()),
);
if (common.size < 10000) throw Error('The common-password blocklist is incomplete.');

export function validateNewPassword(password: unknown): asserts password is string {
  const invalid = (message: string): never => {
    throw Object.assign(Error(message), { status: 400 });
  };
  if (typeof password !== 'string' || [...password].length < 12)
    invalid('Use a password with at least 12 characters.');
  // bcrypt otherwise silently truncates longer UTF-8 inputs.
  if (Buffer.byteLength(password as string, 'utf8') > 72)
    invalid('Use a password of at most 72 UTF-8 bytes.');
  if (common.has((password as string).trim().toLowerCase()))
    invalid('That password is too common. Choose a different password.');
}
