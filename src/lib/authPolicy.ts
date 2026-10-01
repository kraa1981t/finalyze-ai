/**
 * Sign-in is restricted to Google and Microsoft accounts only — both for the
 * login overlay and for the email used at payment.
 */

export type AuthProviderId = 'google' | 'microsoft';

export const ALLOWED_AUTH_PROVIDER_IDS = ['google.com', 'microsoft.com'] as const;

/** Google-owned and Microsoft-owned mail domains (used for the payment email). */
const GOOGLE_DOMAINS = new Set(['gmail.com', 'googlemail.com']);
const MICROSOFT_DOMAINS = new Set([
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'passport.com',
  'outlook.sa',
  'hotmail.co.uk',
  'live.co.uk',
]);

export function isGoogleOrMicrosoftEmail(email?: string | null): boolean {
  const e = (email || '').toLowerCase().trim();
  if (!e || !e.includes('@')) return false;
  const domain = e.slice(e.lastIndexOf('@') + 1);
  return GOOGLE_DOMAINS.has(domain) || MICROSOFT_DOMAINS.has(domain);
}

/** True when the signed-in Firebase user actually came from Google or Microsoft. */
export function isGoogleOrMicrosoftUser(providerIds: readonly string[] | undefined | null): boolean {
  if (!providerIds || providerIds.length === 0) return false;
  return providerIds.some((id) => (ALLOWED_AUTH_PROVIDER_IDS as readonly string[]).includes(id));
}
