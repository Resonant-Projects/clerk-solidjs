// What the smoke run prints: check results, with secrets redacted.

// Values never printed, such as a sign-in token (a bearer credential), which
// a Playwright error can carry in the URL it failed to load.
export const secrets = new Set();
export const redact = (text) => {
  let result = String(text);
  for (const secret of secrets) result = result.split(secret).join("…");
  return result.replace(/(__clerk_ticket(?:=|%3D))[^&\s"'#<>]+/gi, "$1…");
};

export const results = [];
export const check = (name, ok, detail = "") => {
  const shown = redact(detail);
  results.push({ name, ok, detail: shown });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${shown ? `: ${shown}` : ""}`);
};
