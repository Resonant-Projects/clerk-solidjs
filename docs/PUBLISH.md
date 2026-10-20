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

The `Version packages` job commits and opens its pull request with a token from the repository's
release GitHub App, read from the secrets `RELEASE_APP_ID` and `RELEASE_APP_PRIVATE_KEY`. GitHub
does not start workflow runs for events that the default `GITHUB_TOKEN` creates, so a pull
request opened with it would get no CI; one opened by the App does. The job fails before it
checks anything out if either secret is empty and never falls back to `GITHUB_TOKEN`. How to
create the App and add the secrets is in the
[contributing guide](CONTRIBUTING.md#release-github-app). The `Build & pack` job still runs the
full `prerelease` verification before anything is published.

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
   pnpm exec turbo build --filter='./packages/*'
   cd packages/clerk-solidjs
   npm publish --access public --provenance=false
   ```

   Provenance can only be generated in CI, so this one manual publish goes out without it.

4. Add the GitHub Actions trusted publisher with the npm CLI (11.10 or later), then check what
   npm stored:

   ```sh
   npm trust github @resonant-projects/clerk-solidjs --file release.yml \
     --repository Resonant-Projects/clerk-solidjs --environment npm --allow-publish
   npm trust list @resonant-projects/clerk-solidjs
   ```

   npm matches every field case-sensitively against the workflow's OIDC claims, and the
   npmjs.com form has stored the owner in lowercase, which makes every publish fail with
   `404 Not Found`. The listing must show `repository: Resonant-Projects/clerk-solidjs` and
   `environment: npm`.

   The configuration expires unless a trusted publish succeeds within two days, so finish the
   next step promptly.

5. In the GitHub repository settings, set the Actions variable `NPM_PUBLISH_ENABLED` to `true`.
   Until it is set, the `Build & pack` and `Publish to npm` jobs are skipped.
6. After the first trusted publish succeeds, set the package's **Publishing access** to
   _Require two-factor authentication and disallow tokens_.

The `Version packages` job needs the release GitHub App installed on the repository and its two
secrets set; see [Release GitHub App](CONTRIBUTING.md#release-github-app). Because the pull
request is opened by the App rather than by `GITHUB_TOKEN`, the **Allow GitHub Actions to create
and approve pull requests** setting is not needed for it.
Keep the repository's **Actions permissions** on _Allow all actions and reusable workflows_
(every action is pinned to a commit SHA). Allowing only repository-local actions makes every
workflow fail at startup.
