import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDebugLogger } from '../debug-logger';

const logged = (entry: Record<string, unknown>) => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  const logger = createDebugLogger('test', true);
  logger.debug('entry', entry);
  logger.commit();
  return log.mock.calls.map((call) => call.join(' ')).join('\n');
};

/** `name` with the character at `index` percent-encoded. */
const encodeAt = (name: string, index: number, upper: boolean) => {
  const hex = name.charCodeAt(index).toString(16);
  return `${name.slice(0, index)}%${upper ? hex.toUpperCase() : hex}${name.slice(index + 1)}`;
};

afterEach(() => vi.restoreAllMocks());

describe('the debug logger', () => {
  it('cuts a Clerk parameter value however its name is percent-encoded', () => {
    for (const name of ['__clerk_ticket', '__dev_session']) {
      for (let index = 0; index < name.length; index++) {
        for (const upper of [true, false]) {
          const encoded = encodeAt(name, index, upper);
          const output = logged({
            link: `<https://app.example.com/a?x=1&${encoded}=tkt_secret>; rel=next`,
            text: `see /b?${encoded}=tkt_secret and ${encoded}=tkt_secret`
          });
          expect(output, encoded).not.toContain('tkt_secret');
        }
      }
    }
  });

  it('leaves other parameters and text alone', () => {
    const output = logged({ url: 'https://app.example.com/a?tab=1&q=two' });
    expect(output).toContain('tab=1&q=two');
  });

  it('cuts anything shaped like a JWT', () => {
    const output = logged({
      header: 'Bearer eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1In0.c2lnbmF0dXJl'
    });
    expect(output).not.toContain('c2lnbmF0dXJl');
    expect(output).toContain('eyJ…');
  });
});
