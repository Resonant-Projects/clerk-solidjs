import { expectTypeOf } from 'expect-type';
import { describe, expect, it } from 'vitest';
import type {
  DirectoryGroupMembershipWebhookEvent,
  DirectoryGroupWebhookEvent,
  WebhookEvent,
  WebhookEventType
} from '../webhooks';
import * as webhooks from '../webhooks';

describe('@resonant-projects/clerk-solidjs/webhooks', () => {
  it('exports verifyWebhook from @clerk/backend/webhooks', () => {
    expect(typeof webhooks.verifyWebhook).toBe('function');
  });

  // @clerk/backend 3.27.0 added the Directory Sync events. The entry point
  // re-exports @clerk/backend/webhooks wholesale, so verifyWebhook() results
  // narrow on them without changes here.
  it('narrows the Directory Sync events', () => {
    expectTypeOf<
      | 'directoryGroup.created'
      | 'directoryGroup.updated'
      | 'directoryGroup.synced'
      | 'directoryGroup.deleted'
      | 'directoryGroupMembership.created'
      | 'directoryGroupMembership.deleted'
    >().toExtend<WebhookEventType>();

    const narrow = (event: WebhookEvent) => {
      if (event.type === 'directoryGroup.synced') {
        expectTypeOf(event.data).toEqualTypeOf<
          DirectoryGroupWebhookEvent['data']
        >();
      }
      if (event.type === 'directoryGroupMembership.deleted') {
        expectTypeOf(event).toEqualTypeOf<
          Extract<
            DirectoryGroupMembershipWebhookEvent,
            { type: 'directoryGroupMembership.deleted' }
          >
        >();
      }
    };
    expect(typeof narrow).toBe('function');
  });
});
