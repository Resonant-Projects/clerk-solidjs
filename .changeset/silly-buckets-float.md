---
"@resonant-projects/clerk-solidjs": patch
---

Raise the `solid-js` peer dependency floor to `^1.9.8`.

The package now relies on Solid behavior that fails on earlier `1.9.x` releases:
the test suite reproduces `setStyleProperty is not a function` on `1.9.0` through
`1.9.7`, while `1.9.8` is the oldest passing version we verified.
