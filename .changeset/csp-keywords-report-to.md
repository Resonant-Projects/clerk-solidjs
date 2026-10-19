---
'@resonant-projects/clerk-solidjs': patch
---

`clerkMiddleware()`'s `contentSecurityPolicy` fixes:

- Keywords are quoted where the directive takes them, as CSP requires. In source lists, that is every keyword in CSP3, such as `wasm-unsafe-eval`, `report-sample` and `trusted-types-eval`, plus `inline-speculation-rules`. It also covers `script` in `require-trusted-types-for` and `none` and `allow-duplicates` in `trusted-types`. Unquoted, browsers ignored them. Policy names, `report-to` groups and hosts stay bare.
- With `reportTo` and a `report-to` directive, the policy had two `report-to` directives, and browsers use the first, so reports never reached `reportTo`. `reportTo`'s group now replaces the directive.
