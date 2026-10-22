import { timingSafeEqual } from 'node:crypto';

// Pure helpers behind users/{uid}.pro, the server-kept copy of whether a
// user holds the Pro entitlement. Friends read it (via their friendship doc
// and feed items) to show the gold rank frame.

export interface RevenueCatSubscriber {
  subscriber?: { entitlements?: Record<string, { expires_date?: string | null } | undefined> };
}

// Whether a RevenueCat GET /v1/subscribers response holds the entitlement
// right now. A missing expires_date is a lifetime/non-expiring grant.
export function hasActiveEntitlement(data: RevenueCatSubscriber, entitlementId: string, now = Date.now()) {
  const entitlement = data.subscriber?.entitlements?.[entitlementId];
  if (!entitlement) return false;
  if (!entitlement.expires_date) return true;
  return new Date(entitlement.expires_date).getTime() > now;
}

// Firebase uids are what the app logs in to RevenueCat with. Anonymous
// RevenueCat ids ($RCAnonymousID:...) never match a profile.
const UID_PATTERN = /^[A-Za-z0-9]{1,128}$/;

// Every app user id a RevenueCat webhook event touches: the subscriber and
// their aliases, plus both sides of a TRANSFER. The event's own entitlement
// fields aren't trusted or needed: each id is re-checked against the
// RevenueCat API, so events arriving out of order still settle correctly.
export function revenueCatEventUserIds(body: unknown): string[] {
  const event = (body as { event?: Record<string, unknown> } | null)?.event;
  if (!event || typeof event !== 'object') return [];
  const ids = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value === 'string' && UID_PATTERN.test(value)) ids.add(value);
  };
  add(event.app_user_id);
  add(event.original_app_user_id);
  for (const key of ['aliases', 'transferred_from', 'transferred_to']) {
    const list = event[key];
    if (Array.isArray(list)) list.forEach(add);
  }
  return [...ids].slice(0, 20);
}

// RevenueCat sends the Authorization header value set in its dashboard,
// verbatim. Constant-time compare; an empty expected value never matches.
export function webhookAuthorized(header: string | undefined, expected: string) {
  if (!expected || typeof header !== 'string') return false;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
