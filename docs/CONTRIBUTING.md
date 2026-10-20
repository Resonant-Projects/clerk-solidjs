# Contributing guide

When contributing to this repository, please first discuss the change you wish to make via issue, email, or any other method with the owners of this repository before making a change.

<details open="open">
<summary><strong>Table of contents</strong></summary>

- [Contributing guide](#contributing-guide)
  - [Developing locally](#developing-locally)
    - [Monorepo setup](#monorepo-setup)
    - [Prerequisites](#prerequisites)
    - [Setting up your local environment](#setting-up-your-local-environment)
    - [Documenting your changes](#documenting-your-changes)
    - [Writing tests](#writing-tests)
  - [Opening a Pull Request](#opening-a-pull-request)
    - [Changesets](#changesets)
    - [Commit messages](#commit-messages)
    - [What is the difference between a commit message, a PR description and a changeset description?](#what-is-the-difference-between-a-commit-message-a-pr-description-and-a-changeset-description)
    - [Notes on Pull Requests](#notes-on-pull-requests)
  - [Issues and feature requests](#issues-and-feature-requests)
  - [Localizations](#localizations)
  - [Publishing packages](#publishing-packages)
    - [Release GitHub App](#release-github-app)
  - [License](#license)

</details>

## Developing locally

### Repository setup

The current setup is based on:

- [Changesets](https://github.com/changesets/changesets), used for package versioning, publishing and changelog generation.
- [GitHub Actions](https://docs.github.com/en/actions), used for quality checks and automated release orchestration.
- [Vitest](https://vitest.dev/), used for running unit tests.

### Prerequisites

Ensure that you have Node.js installed ([How to install Node](https://nodejs.org/en/download/)). Its version should be `22` or higher.

### Setting up your local environment

To set up your development environment, please follow these steps:

1. Clone the repo

   ```sh
   git clone https://github.com/Resonant-Projects/clerk-solidjs
   ```

1. Install the dependencies. We're using pnpm, so you **should always run `pnpm install`**, as it will install all of the dependencies:

   ```sh
   cd clerk-solidjs
   pnpm install
   ```

1. Build the project

   ```sh
   pnpm run build
   ```

   This ensures that all internal TypeScript types are generated.

For package specific setup, refer to the `Build` section of the specific package (e.g. `packages/<package_name>/README.md#build`).

### Documenting your changes

Updating documentation is an important part of the contribution process. If you are changing existing behavior or adding a new feature, make sure [Clerk's documentation](https://github.com/clerk/clerk-docs) is also updated.

To improve the in-editor experience when using Clerk's SDKs, we do our best to add [JSDoc comments](https://jsdoc.app/about-getting-started.html) to our package's public exports. The JSDoc comments should not attempt to duplicate any existing type information, but should provide meaningful additional context or references. If you are adding a new export, make sure it has a JSDoc comment. If you are updating an existing export, make sure any existing comments are updated appropriately.

### Writing tests

When changing functionality or adding completely new code it's highly recommended to add/edit tests to verify the new behavior.

Inside the repository you'll find two types of tests:

1. Unit tests
1. Integration tests

While changing a file inside a package, check if e.g. a `<name>.test.ts` file or a test inside a `__tests__` folder exists. If you add a completely new file, please add a unit test for it.

If your change can't only be tested by unit tests, you should add/edit an integration test. You can find all necessary information about this in the [integration tests README](../integration/README.md).

For this repository's real-instance browser coverage, build the repo and run the
Playwright suite against `examples/basic`:

```sh
pnpm run build
pnpm run e2e
```

The e2e suite needs a Clerk development instance configured through
`VITE_CLERK_PUBLISHABLE_KEY` (or `CLERK_PUBLISHABLE_KEY`) and
`CLERK_SECRET_KEY`.

It runs against both example apps: `examples/basic` (SolidStart, where it also
checks the middleware, `auth()` and API routes) and `examples/solid-vite` (a
client-only app on Vite and `@solidjs/router`). `E2E_APPS=basic pnpm run e2e`
runs only the SolidStart app. The organization spec needs Organizations turned
on in the instance, and the billing spec needs billing for users with a public
plan; each is skipped, and says why, when its feature is off. CI also runs the
SolidStart app on the oldest SolidStart and `@solidjs/router` the peer ranges
allow, and a weekly workflow runs everything on the newest `@clerk/*` packages.

In GitHub Actions, the E2E workflow accepts `VITE_CLERK_PUBLISHABLE_KEY` as
either a secret or a repository variable and maps it to both env names that the
example and tests accept.

## Opening a Pull Request

1. Search our repository for open or closed [Pull Requests](https://github.com/Resonant-Projects/clerk-solidjs/pulls) that relate to your submission. You don't want to duplicate effort.
1. Fork the project
1. Create your feature branch (`git checkout -b feat/amazing_feature`)
1. It's highly recommended to [write tests](#writing-tests) to ensure your change works and will continue to work in the future
1. If required, create a `changeset` that describes your changes (`pnpm run changeset`). In cases where a changeset is not required, an empty changeset can be created instead (`pnpm run changeset:empty`) - an empty changeset will not generate a changelog entry for the change, so please use it as an escape hatch or for internal refactors only.
1. Commit your changes (`git commit -m 'feat: Add amazing_feature'`)
1. Push to the branch (`git push origin feat/amazing_feature`)
1. [Open a Pull Request](https://github.com/Resonant-Projects/clerk-solidjs/compare?expand=1). Make sure the description includes enough information for the reviewer to understand what the PR is about.
1. Follow the instructions of the pull request template

### Changesets

For more details about changesets, see [Adding a Changeset](https://github.com/changesets/changesets/blob/main/docs/adding-a-changeset.md).
A changeset is a piece of information about changes made in a branch or commit. It holds three bits of information:

- What we need to release
- What version we are releasing packages at (using a semver bump type)
- A changelog entry for the released packages

For example:

```markdown
---
"clerk-solidjs": minor
---

Description goes here
```

Will generate the following changelog entry:

```markdown
## Minor Changes

- Description goes here (#123) by @johndoe
```

**Changelog entry framework**:

Keep it concise and as information-rich as possible. The most comprehensive changelog entry may include:

- What’s the type of change? - type
  - bug fix, feature, breaking change, chore, etc.
- What’s the TL;DR? - summary
- What more details can we share? - details
- What user benefit has this change? - benefit
- More information. Can we link to related things? - resources

A changelog entry should at least contain the **type** of change and a **summary**.

If your PR contains changes that require the user to update their code, explain **how** they can migrate.

**Tips**:

- Changesets are just markdown files. Feel free to add as much markdown as you want to better describe the change. If e.g. your changeset contains function or package names, use the `inline code` syntax to denote this.
- Multiple changesets can be added in a single PR if needed, please see [Tips on adding changesets](https://github.com/changesets/changesets/blob/main/docs/adding-a-changeset.md#you-can-add-more-than-one-changeset-to-a-pull-request)

#### Why We Use Changesets

Great release notes and changelogs are an incredibly important trait of good software. We are always working hard at Clerk to bring updates and improvements to our libraries. And while we believe that this is a good thing, it also means we need to be responsible to our users in making clear what these changes are in a way that is as brief, clear, and understandable as possible. We have all seen libraries that publish changelogs as a list of commits, and I don't think many would argue that while this makes it easy for library developers, it's far from ideal for library users. To reach the standards we have for our library users' experience with Clerk, there is nothing that beats hand-written changelogs by the developers who worked on the features, and this is exactly what changesets empowers us to provide.

Changesets provides streamlined tooling and enforcement to ensure that developers working on features have as easy of a time as possible writing great changelogs, and puts together release notes for us at the quality bar that we strive for. Make sure to think from the perspective of a user when writing changesets to make it crystal clear what your feature is, what impact is has on the library, how to use it, and how to find more detail, if relevant.

### File size limit

A husky pre-commit hook (`scripts/check-file-tokens.mjs`) blocks commits that
add or change a source file over **5,000 estimated tokens** (bytes / 4, so
20,000 bytes). Large files are hard for people and coding agents to read and
edit in one pass. If the hook fails, split the file by responsibility: move
types, constants and helpers into their own modules, extract components or
sub-functions, and re-export from an index if callers depend on the old path.
Lockfiles, generated and vendored code, binaries and snapshots are ignored; the
list lives at the top of the script. `git commit --no-verify` bypasses the hook
in an emergency. The hook is installed by `pnpm install` through husky.

### Commit messages

Even though we don't use commit messages to track changes between releases, all commit messages need to respect the [conventional-commits](https://www.conventionalcommits.org/en/v1.0.0/) specification.
Use of a `type` and a `scope` in commit message is **mandatory**.

As per the conventional commits specification, the `type` can be one of the following: `feat`, `fix`, `chore`, `docs`. The `scope` can be one of the package names defined in `packages/{package}/package.json`, `repo` for repository level changes or `release` for releases.

### What is the difference between a commit message, a PR description, and a changeset description?

All of these are used to describe changes in the codebase, but they have different purposes:

- **Commit message**: Briefly describe what the commit is about. Intended to be seen by contributors.
- **Commit description**: Describe in details why the change was made and include some details about the implementation if needed. Intended to be seen by contributors.
- **PR description**: Describe in details what the PR is about. This is the first thing a reviewer will see when reviewing a PR, so make sure to explain why the change is needed and offer plenty of details about the actual implementation. It's always useful to include a screen recording or steps to reproduce the issue if the PR is related to a bug fix. Also try to include resources and external documentation if required. Intended to be seen by contributors and will be used as future reference.
- **Changeset description**: The target audience for these changelogs are other developers. So don’t shy away on including technical details or describing it with words that are generally known among developers. The goal of the changelog entry is to convey the benefit of upgrading to this version in a concise way. Try to provide usage examples and migration steps if required. Read the [changesets](#changesets) section to learn how to write great changesets.

### Notes on Pull Requests

- Prefer multiple small PRs with related changes (easier to review and provide feedback)
- Always add description in PRs (describe high level the issue and the solution)
- (issue related PRs) Add screen recording or steps to reproduce the issue
- (issue related PRs) Add screen recording or test to verify the fix

## Issues and feature requests

You've found a bug in the source code, a mistake in the documentation or maybe you'd like a new feature? You can help us by [submitting an issue on GitHub](https://github.com/Resonant-Projects/clerk-solidjs/issues). Before you create an issue, make sure to search the issue archive - your issue may have already been addressed! Please ensure that you have read and followed the bug report template, otherwise we will have to close the issue. You can submit a feature request by visiting [feedback.clerk.com](https://feedback.clerk.com).

Issues that have the label `needs-triage` have been seen by our team and are queued for triage internally. Issues that have the label `prioritized` have been discussed and are either in our backlog or being worked on actively. We do our best to prioritize work across a wide variety of sources, only one of which is github issues. While we understand that it can be frustrating if it takes a while for a patch to land, we ask for your understanding in that we have quite a lot of things that need to be worked on at any given time and are still a small team. And remember, the best way to get something fixed in an open source library is to contribute the fix yourself!

If you are a paying Clerk customer looking for support, please reach out directly to our support team by heading to https://www.clerk.com, clicking the chat bubble in the bottom right corner, and selecting "contact support".

## Localizations

If you want to add or edit localizations (e.g. how a button text is translated to your language), you can check out the [`localizations` README](../packages/localizations/README.md).

## Publishing packages

_Note: Only maintainers can publish packages._

For more information visit [publish documentation](https://github.com/Resonant-Projects/clerk-solidjs/blob/master/docs/PUBLISH.md).

### Release GitHub App

The `Version packages` job of the [`Release` workflow](../.github/workflows/release.yml) commits
the version bump and opens the **Version Packages** pull request with a token from a GitHub App
that the repository owns. GitHub does not start workflow runs for events created with the default
`GITHUB_TOKEN`, so a pull request opened with it would never get CI checks. A pull request opened
by an App does. The job fails with a clear error, before it checks anything out, if either secret
below is empty; it never falls back to `GITHUB_TOKEN`.

Setting the App up is a one-time task, and repository admin access alone is not enough for all
of it. Only an organization owner or a GitHub App manager can register an App for the
organization. The App manager role cannot install it. An organization owner can install it,
and so can a repository admin on this repository, because it requests no organization
permissions, unless the organization restricts App installation by repository admins. Adding
the secrets needs repository admin access.

1. Create the App. For an organization-owned repository, go to the organization's
   **Settings → Developer settings → GitHub Apps → New GitHub App**. For a personal repository,
   use the same path under your own account settings. Fill in:

   - **GitHub App name**: for example `clerk-solidjs-release`. The pull request and its commits
     are attributed to `<name>[bot]`.
   - **Homepage URL**: the repository URL.
   - **Webhook**: untick **Active**. The App is only used to mint tokens.
   - **Repository permissions**:
     - **Contents**: _Read and write_ (push the version commit).
     - **Pull requests**: _Read and write_ (open and update the Version Packages pull request).
     - **Workflows**: leave at _No access_. It is only needed if a Version Packages pull
       request has to change files under `.github/workflows`, which `changeset version` never
       does.
   - Leave every other permission at _No access_, and **Where can this GitHub App be
     installed?** on _Only on this account_.

2. On the App's **General** page, note the **Client ID** and, under **Private keys**, click
   **Generate a private key**. GitHub downloads a `.pem` file; it is the only copy, so keep it
   somewhere safe and delete it from the download folder once the secret below is stored.

3. Install the App: **Install App** in the App's left-hand menu, choose the account, and select
   **Only select repositories → `clerk-solidjs`**.

4. Add two **Actions secrets** to the repository (**Settings → Secrets and variables → Actions →
   New repository secret**):

   | Secret                    | Value                                                                                                                 |
   | ------------------------- | --------------------------------------------------------------------------------------------------------------------- |
   | `RELEASE_APP_ID`          | The App's **Client ID** (the numeric **App ID** also works; both identify the App when signing its token).            |
   | `RELEASE_APP_PRIVATE_KEY` | The full contents of the downloaded `.pem` file, including the `-----BEGIN ...-----` and `-----END ...-----` lines. |

   They must be repository secrets (or organization secrets granted to this repository), not
   environment secrets: the `Version packages` job does not run in an environment.

5. Check it works: merge a pull request that carries a changeset, or run the `Release` workflow
   from the **Actions** tab while `master` has a pending changeset. Without one, the workflow
   selects the `publish` or `none` mode and skips the `Version packages` job, so it creates no
   token and proves nothing. The job should open or update the **Version Packages** pull
   request with a commit by `<name>[bot]`, and the `CI` workflow should start on it without
   anyone approving a run.

The workflow asks the App for a token limited to `contents: write` and `pull-requests: write` on
this repository, and the token is revoked when the job ends. If the private key is ever exposed,
generate a new one on the App's **General** page, update `RELEASE_APP_PRIVATE_KEY`, and delete
the old key there.

npm publishing is separate and unaffected: the `Publish to npm` job keeps authenticating with
npm trusted publishing (OIDC) as described in the publish documentation.

## License

By contributing to Clerk, you agree that your contributions will be licensed under its MIT License.
