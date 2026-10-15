// Unambiguous characters only — the director reads this out or writes it
// down for the employee, so no 0/O or 1/l/I to mix up.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateTemporaryPassword(length = 10): string {
  const values = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(values, (v) => ALPHABET[v % ALPHABET.length]).join('');
}
