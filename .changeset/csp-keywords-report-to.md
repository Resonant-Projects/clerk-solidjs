---
'@resonant-projects/clerk-solidjs': patch
---

`clerkMiddleware()`'s `contentSecurityPolicy` fixes:

- Keywords are quoted in every directive, as CSP requires: `wasm-unsafe-eval`, `report-sample` and `inline-speculation-rules` too, and the keywords only one directive takes, `script` in `require-trusted-types-for` and `allow-duplicates` in `trusted-types`. Unquoted, browsers ignored them.
- With `reportTo` and a `report-to` directive, the policy had two `report-to` directives, and browsers use the first, so reports never reached `reportTo`. `reportTo`'s group now replaces the directive.
