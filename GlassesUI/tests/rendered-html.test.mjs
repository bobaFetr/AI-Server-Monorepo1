import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the ARGUS glasses interface", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>ARGUS Vision OS<\/title>/i);
  assert.match(html, /Dual lens glasses interface/i);
  assert.match(html, /ARGUS \/\/ VISION OS/i);
  assert.match(html, /L \/\/ ENVIRONMENT/i);
  assert.match(html, /R \/\/ ASSISTANT/i);
  assert.match(html, /BAT 72%/i);
  assert.match(html, /CAMERA ACTIVE/i);
  assert.match(html, /Open glasses menu/i);
  assert.match(html, />MAP</i);
  assert.match(html, /TERMINATOR CODE/i);
  assert.match(html, /Scene targeting reticle/i);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});
