import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  renderVendoredTypes,
  vendoredPath
} from '../../scripts/vendor-clerk-ui-types.mjs';

describe('vendored @clerk/ui appearance types', () => {
  it('match the installed @clerk/ui; rerun scripts/vendor-clerk-ui-types.mjs if not', () => {
    expect(fs.readFileSync(vendoredPath, 'utf8')).toBe(renderVendoredTypes());
  });
});
