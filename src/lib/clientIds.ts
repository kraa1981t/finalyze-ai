/**
 * The developer accounts. The first one is the developer's own login and is
 * used by Client Monitor; the others are alternates/team accounts that may be
 * granted the same developer powers.
 */
export const DEVELOPER_EMAILS = [
  'albertaparks1t@gmail.com',
  'bachasalman69@gmail.com',
  'taybekraa@gmail.com',
  'kraakraa109@gmail.com',
];

/** True when the given address is one of the developer accounts. */
export function isDeveloperEmail(email: string | null | undefined): boolean {
  const e = (email || '').toLowerCase().trim();
  return !!e && DEVELOPER_EMAILS.includes(e);
}

/**
 * Firestore document id for a client record. Deterministic, so a client reads
 * and writes ONLY their own document (doc(db,'clients', id)) while the
 * developer still lists the whole collection. Random ids (addDoc) would force a
 * collection-wide query, which no client is allowed to run.
 */
export function clientDocId(email: string | null | undefined): string {
  return (email || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
}
