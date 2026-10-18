/**
 * Vite does not define `global`, which some browser code still expects. Called
 * when IsomorphicClerk is created in the browser, before clerk-js loads, rather
 * than at import, so the package has no import-time side effects.
 */
export const installGlobalPolyfill = () => {
  if (typeof window !== 'undefined' && !window.global) {
    (window as Window & { global?: typeof globalThis }).global =
      typeof global === 'undefined' ? window : global;
  }
};
