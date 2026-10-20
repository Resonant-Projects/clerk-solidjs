---
'@resonant-projects/clerk-solidjs': patch
---

The `browser` field in `package.json` now just names the browser build of the main entry. It used to remap the server build that the `worker` condition chooses, so a bundler honouring both could give a worker the browser build. `exports` is unchanged.
