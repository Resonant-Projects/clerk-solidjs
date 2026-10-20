---
'@resonant-projects/clerk-solidjs': patch
---

`<PricingTable>` hides its `fallback` once Clerk has loaded the plans. clerk-js marks the table's own element as ready, and the check looked only inside it, so the fallback stayed on screen beside the table.
