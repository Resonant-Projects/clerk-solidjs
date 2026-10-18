#!/usr/bin/env node
// Runs the basic SolidStart example against a real Clerk development instance
// and checks it in headless Chromium.
//
//   node scripts/smoke-example.mjs                 # the workspace package
//   node scripts/smoke-example.mjs --version 3.1.0 # a version from npm
//
// Needs examples/basic/.env.local (or --env-file) with VITE_CLERK_PUBLISHABLE_KEY
// and CLERK_SECRET_KEY for a development instance. With --version, the example is
// copied to a temporary directory and installs the published package with npm,
// which is how an app outside this repository uses it.

import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exampleDir = path.join(repoRoot, 'examples/basic');
const packageName = '@resonant-projects/clerk-solidjs';

const { values: args } = parseArgs({
  options: {
    version: { type: 'string' },
    'env-file': { type: 'string', default: path.join(exampleDir, '.env.local') },
    port: { type: 'string', default: '3999' },
    'skip-build': { type: 'boolean', default: false },
    keep: { type: 'boolean', default: false }
  }
});

const envFile = path.resolve(args['env-file']);
if (!fs.existsSync(envFile)) {
  console.error(`Missing ${envFile}. Copy examples/basic/.env.example and fill in development keys.`);
  process.exit(2);
}
// Vite inlines VITE_* variables at build time. With --version the copied app
// has no .env files, and --env-file can point anywhere, so load the file into
// this process for the build as well as the server.
process.loadEnvFile(envFile);

// CI=true stops tsup-preset-solid from rewriting the package's package.json.
const run = (command, commandArgs, cwd) =>
  execFileSync(command, commandArgs, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, CI: 'true' }
  });

/** Copies the example and points it at the published package. */
function preparePublishedApp(version) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clerk-solidjs-smoke-'));
  const skip = new Set(['node_modules', '.output', '.vinxi', '.nitro', '.turbo']);
  fs.cpSync(exampleDir, dir, {
    recursive: true,
    filter: (source) => {
      const name = path.basename(source);
      return !skip.has(name) && !name.startsWith('.env');
    }
  });
  const manifestPath = path.join(dir, 'package.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.dependencies[packageName] = version;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`\n> Installing ${packageName}@${version} into ${dir}`);
  run('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error'], dir);
  const installed = JSON.parse(
    fs.readFileSync(path.join(dir, 'node_modules', packageName, 'package.json'), 'utf8')
  ).version;
  if (installed !== version) {
    throw new Error(`Expected ${packageName}@${version}, npm installed ${installed}`);
  }
  return dir;
}

function startServer(appDir, port) {
  const server = spawn(
    process.execPath,
    [`--env-file=${envFile}`, '.output/server/index.mjs'],
    { cwd: appDir, env: { ...process.env, PORT: port, HOST: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  let output = '';
  server.stdout.on('data', (chunk) => (output += chunk));
  server.stderr.on('data', (chunk) => (output += chunk));
  return { server, output: () => output };
}

async function waitForServer(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(url, { redirect: 'manual' });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`Server did not start at ${url}`);
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `: ${detail}` : ''}`);
};

async function runChecks(baseUrl) {
  // Without cookies, a development instance answers a document request with a
  // handshake redirect to the Frontend API.
  const handshake = await fetch(baseUrl, {
    redirect: 'manual',
    headers: { 'sec-fetch-dest': 'document', accept: 'text/html' }
  });
  check(
    'a cookieless document request starts the handshake',
    handshake.status === 307 && !!handshake.headers.get('location'),
    `status ${handshake.status}`
  );

  // A non-document request is authenticated as signed out, and Clerk's
  // diagnostics must reach the response.
  const api = await fetch(baseUrl, { redirect: 'manual', headers: { accept: '*/*' } });
  check(
    'Clerk response headers reach a signed-out response',
    api.headers.get('x-clerk-auth-status') === 'signed-out',
    `x-clerk-auth-status=${api.headers.get('x-clerk-auth-status')}`
  );
  const html = await api.text();
  const head = html.slice(0, html.indexOf('</head>'));
  check(
    'the server writes its Clerk state into <head>',
    head.includes('window.__clerk_init_state = '),
    head.includes('window.__clerk_init_state') ? '' : 'no state script in <head>'
  );
  check(
    '<Show when="signed-out"> and SignInButton render on the server',
    />\s*Sign in\s*<\/button>/.test(html)
  );
  check(
    'a custom SignInButton child is not wrapped in another button',
    !/<button[^>]*>\s*<button/.test(html)
  );

  const meResponse = await fetch(new URL('/api/me', baseUrl), {
    redirect: 'manual',
    headers: { accept: 'application/json' }
  });
  check(
    "an API route rejects a signed-out request, with Clerk's headers on its 401",
    meResponse.status === 401 && meResponse.headers.get('x-clerk-auth-status') === 'signed-out',
    `status ${meResponse.status}, x-clerk-auth-status=${meResponse.headers.get('x-clerk-auth-status')}`
  );

  const webhookResponse = await fetch(new URL('/api/webhooks', baseUrl), {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'user.created', data: {} })
  });
  check(
    'verifyWebhook rejects an unsigned webhook',
    webhookResponse.status === 400,
    `status ${webhookResponse.status}`
  );

  const signInHtml = await (
    await fetch(new URL('/sign-in', baseUrl), {
      redirect: 'manual',
      headers: { accept: '*/*' }
    })
  ).text();
  check(
    'the sign-in route renders the SignIn host and fallback on the server',
    signInHtml.includes('data-clerk-component="SignIn"') &&
      signInHtml.includes('Loading sign-in...')
  );

  const waitlistHtml = await (
    await fetch(new URL('/waitlist', baseUrl), {
      redirect: 'manual',
      headers: { accept: '*/*' }
    })
  ).text();
  check(
    'a UI component renders its host and fallback on the server',
    waitlistHtml.includes('data-clerk-component="Waitlist"') &&
      waitlistHtml.includes('Loading the waitlist...')
  );

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`console.error: ${message.text()}`);
    });

    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    const loaded = await page
      .waitForFunction(() => window.Clerk?.loaded === true, null, { timeout: 30_000 })
      .then(() => true)
      .catch(() => false);
    check('clerk-js loads in the browser', loaded);
    check(
      'the browser received the server state before hydrating',
      await page.evaluate(() => !!window.__clerk_init_state?.__internal_clerk_state)
    );
    const signInButton = page.getByRole('button', { name: /sign in/i });
    check('signed-out content renders after load', await signInButton.isVisible());
    check(
      'the page hydrated once (one heading)',
      (await page.locator('h1').count()) === 1
    );
    check(
      'buttons are not nested after hydration',
      (await page.locator('button button').count()) === 0 &&
        (await page.getByRole('button', { name: /sign in/i }).count()) === 1
    );

    // The example's SignInButton uses the default redirect mode.
    await signInButton.click();
    const redirected = await page
      .waitForURL(/\/sign-in/, { timeout: 20_000 })
      .then(() => true)
      .catch(() => false);
    check('SignInButton redirects to the sign-in page', redirected, page.url().replace(/\?.*$/, ''));

    // The page's "use server" query throws auth().redirectToSignIn().
    await page.goto(new URL('/protected', baseUrl).href, { waitUntil: 'networkidle' });
    const afterProtected = new URL(page.url());
    check(
      'a query throwing redirectToSignIn() sends a signed-out visitor to sign-in and back',
      afterProtected.pathname.startsWith('/sign-in') &&
        (afterProtected.searchParams.get('redirect_url') ?? '').endsWith('/protected'),
      page.url().replace(/__clerk_db_jwt=[^&]+/, '__clerk_db_jwt=***')
    );
    const signInRendered = await page
      .waitForFunction(
        () =>
          (document.querySelector('[data-clerk-component="SignIn"]')?.childElementCount ?? 0) > 0,
        null,
        { timeout: 30_000 }
      )
      .then(() => true)
      .catch(() => false);
    check(
      'the /start SignIn renders on its catch-all route without a path prop',
      signInRendered && !(await page.getByText('Loading sign-in...').isVisible())
    );

    await page.goto(new URL('/waitlist', baseUrl).href, { waitUntil: 'networkidle' });
    const waitlistRendered = await page
      .waitForFunction(
        () =>
          (document.querySelector('[data-clerk-component="Waitlist"]')?.childElementCount ?? 0) > 0,
        null,
        { timeout: 30_000 }
      )
      .then(() => true)
      .catch(() => false);
    check(
      'the Waitlist fallback gives way to Clerk once it renders',
      waitlistRendered && !(await page.getByText('Loading the waitlist...').isVisible())
    );

    check('no page errors or console errors', errors.length === 0, errors.join(' | '));

    // A separate page, since a blocked script logs errors on purpose.
    const blocked = await browser.newPage();
    await blocked.route(/\/npm\/@clerk\/clerk-js@/, (route) => route.abort());
    await blocked.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    const failedShown = await blocked
      .getByText('Clerk failed to load.')
      .waitFor({ timeout: 30_000 })
      .then(() => true)
      .catch(() => false);
    check(
      'ClerkFailed replaces ClerkLoading when the clerk-js script is blocked',
      failedShown && !(await blocked.getByText('Loading...').isVisible())
    );
  } finally {
    await browser.close();
  }
}

async function main() {
  const appDir = args.version ? preparePublishedApp(args.version) : exampleDir;
  if (!args['skip-build']) {
    console.log(`\n> Building ${appDir}`);
    if (args.version) {
      run('npm', ['run', 'build'], appDir);
    } else {
      run('pnpm', ['--filter', packageName, 'build'], repoRoot);
      run('pnpm', ['-C', appDir, 'build'], repoRoot);
    }
  }

  const baseUrl = `http://127.0.0.1:${args.port}/`;
  const { server, output } = startServer(appDir, args.port);
  try {
    await waitForServer(baseUrl);
    await runChecks(baseUrl);
  } catch (error) {
    check('smoke run completed', false, error instanceof Error ? error.message : String(error));
  } finally {
    server.kill();
    if (args.version && !args.keep) {
      fs.rmSync(appDir, { recursive: true, force: true });
    }
  }

  const failed = results.filter((result) => !result.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log('\nServer output:\n' + output().slice(-4000));
    process.exit(1);
  }
}

await main();
