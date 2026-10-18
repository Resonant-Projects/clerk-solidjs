import type { ErrorThrowerOptions } from '@clerk/shared/error';
import { buildErrorThrower } from '@clerk/shared/error';

// Named at build time, so errors from every entry, including `/start`, carry
// the package name without an import-time setup call.
const errorThrower = /* @__PURE__ */ buildErrorThrower({
  packageName: PACKAGE_NAME
});

export { errorThrower };

/**
 * Overrides options of the internal errorThrower (eg setting packageName prefix).
 *
 * @internal
 */
export function setErrorThrowerOptions(options: ErrorThrowerOptions) {
  errorThrower.setMessages(options).setPackageName(options);
}
