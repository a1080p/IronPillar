import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hasActiveEntitlement, revenueCatEventUserIds, webhookAuthorized } from '../src/pro';

const ID = 'iron_pillar_pro';
const NOW = Date.parse('2026-10-21T12:00:00Z');
const withEntitlement = (expires_date: string | null) => ({
  subscriber: { entitlements: { [ID]: { expires_date } } },
});

describe('hasActiveEntitlement', () => {
  it('is true before expiry and for lifetime grants', () => {
    assert.equal(hasActiveEntitlement(withEntitlement('2026-11-21T12:00:00Z'), ID, NOW), true);
    assert.equal(hasActiveEntitlement(withEntitlement(null), ID, NOW), true);
  });

  it('is false once expired, or without the entitlement', () => {
    assert.equal(hasActiveEntitlement(withEntitlement('2026-10-21T11:59:59Z'), ID, NOW), false);
    assert.equal(hasActiveEntitlement({ subscriber: { entitlements: {} } }, ID, NOW), false);
    assert.equal(hasActiveEntitlement({}, ID, NOW), false);
    assert.equal(hasActiveEntitlement(withEntitlement(null), 'other', NOW), false);
  });
});

describe('revenueCatEventUserIds', () => {
  it('collects the subscriber and aliases, dropping anonymous ids and duplicates', () => {
    const ids = revenueCatEventUserIds({
      event: {
        type: 'RENEWAL',
        app_user_id: 'uidA1',
        original_app_user_id: '$RCAnonymousID:abc123',
        aliases: ['uidA1', '$RCAnonymousID:abc123', 'uidB2'],
      },
    });
    assert.deepEqual(ids, ['uidA1', 'uidB2']);
  });

  it('includes both sides of a transfer', () => {
    const ids = revenueCatEventUserIds({
      event: { type: 'TRANSFER', transferred_from: ['oldUid'], transferred_to: ['newUid'] },
    });
    assert.deepEqual(ids.sort(), ['newUid', 'oldUid']);
  });

  it('ignores malformed bodies and ids', () => {
    assert.deepEqual(revenueCatEventUserIds(null), []);
    assert.deepEqual(revenueCatEventUserIds({}), []);
    assert.deepEqual(revenueCatEventUserIds({ event: { app_user_id: 'a/b', aliases: 'x' } }), []);
  });
});

describe('webhookAuthorized', () => {
  it('matches only the exact configured header', () => {
    assert.equal(webhookAuthorized('Bearer s3cret', 'Bearer s3cret'), true);
    assert.equal(webhookAuthorized('Bearer s3creX', 'Bearer s3cret'), false);
    assert.equal(webhookAuthorized('Bearer s3cret!', 'Bearer s3cret'), false);
    assert.equal(webhookAuthorized(undefined, 'Bearer s3cret'), false);
  });

  it('never matches when no secret is configured', () => {
    assert.equal(webhookAuthorized('', ''), false);
  });
});
