// TEMPORARY DIAGNOSTIC: shows which requests keep "networkidle" from settling.

import { redact } from "./report.mjs";

export async function gotoWithDiagnostics(page, url) {
  const t0 = Date.now();
  const at = () => `+${Date.now() - t0}ms`;
  const inflight = new Map();
  const log = [];
  const short = (u) => redact(u.replace(/\?.*$/, ""));
  page.on("request", (r) => {
    inflight.set(r, at());
    log.push(`${at()} ${r.method()} ${r.resourceType()} ${short(r.url())}`);
  });
  const done = (kind) => (r) => {
    inflight.delete(r);
    log.push(`${at()} ${kind} ${short(r.url())}`);
  };
  page.on("requestfinished", done("done"));
  page.on("requestfailed", done("failed"));
  page.on("websocket", (ws) => log.push(`${at()} websocket ${short(ws.url())}`));
  try {
    await page.goto(url, { waitUntil: "networkidle" });
    console.log(`DIAG networkidle reached at ${at()}`);
  } catch (error) {
    console.log(`DIAG networkidle failed at ${at()}: ${String(error.message).split("\n")[0]}`);
  }
  const versions = await page
    .evaluate(() => ({ clerk: window.Clerk?.version, loaded: window.Clerk?.loaded }))
    .catch((e) => String(e));
  console.log(`DIAG clerk ${JSON.stringify(versions)}`);
  console.log(`DIAG request log (${log.length}):\n  ${log.slice(0, 400).join("\n  ")}`);
  console.log(
    `DIAG in flight (${inflight.size}):\n  ${[...inflight].map(([r, t]) => `${r.method()} ${r.resourceType()} since ${t} ${short(r.url())}`).join("\n  ")}`,
  );
}
