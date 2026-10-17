# Publishing packages

_Only maintainers can publish._

Releases run through [Changesets](https://github.com/changesets/changesets) and the
[`Release` workflow](../.github/workflows/release.yml). npm authenticates the publish job with
[trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC), so no npm token is stored
in GitHub. Every published version carries a provenance attestation.

## Day-to-day releases

1. Add a changeset to each pull request that changes published code: `pnpm changeset`.
2. When changesets land on `master`, the `Version packages` job opens or updates a
   **Version Packages** pull request that bumps versions and writes the changelog.
3. Merging that pull request runs the `Build & pack` job, which verifies, builds and packs the
   tarballs, and then the `Publish to npm` job, which publishes them, pushes the release tag and
   creates the GitHub release.

The `Version packages` job opens its pull request with the default `GITHUB_TOKEN`, and GitHub does
not start workflow runs for events that token creates. CI therefore does not run on the Version
Packages pull request by itself. To see checks there, close and reopen the pull request. Either
way, the `Build & pack` job runs the full `prerelease` verification before anything is published.

The publish job is the only job with `id-token: write`. It installs with `--ignore-scripts`, does
not build, and publishes only the tarballs packed by the previous job.

## One-time setup

Trusted publishing can only be configured for a package that already exists on npm, so the first
version is published by hand.

1. Sign in to npm as a maintainer: `npm login`.
2. If the package is scoped, make sure the npm organization for the scope exists.
3. Build and publish the first version from a clean checkout of `master`:

   ```sh
   pnpm install --frozen-lockfile
   pnpm run prerelease
   pnpm exec turbo build --filter=./packages/*
   cd packages/clerk-solidjs
   npm publish --access public --provenance=false
   ```

   Provenance can only be generated in CI, so this one manual publish goes out without it.

4. On npmjs.com, open the package's **Settings → Trusted publishing** and add a GitHub Actions
   publisher:
   - Organization or user: `Resonant-Projects`
   - Repository: `clerk-solidjs`
   - Workflow filename: `release.yml`
   - Environment name: `npm`
   - Allowed actions: allow `npm publish`

   The configuration expires unless a trusted publish succeeds within two days, so finish the
   next step promptly.

5. In the GitHub repository settings, set the Actions variable `NPM_PUBLISH_ENABLED` to `true`.
   Until it is set, the `Build & pack` and `Publish to npm` jobs are skipped.
6. After the first trusted publish succeeds, set the package's **Publishing access** to
   _Require two-factor authentication and disallow tokens_.

The repository also needs **Settings → Actions → General → Allow GitHub Actions to create and
approve pull requests** enabled so the `Version packages` job can open its pull request.
