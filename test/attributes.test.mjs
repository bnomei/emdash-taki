/** Attribute-name validation and resolver error-path contracts for fragment collection. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  cloudflareTurnstile,
  cloudflareWebAnalytics,
  cloudflareZaraz,
  externalScript,
  inlineScript,
  inlineStyle,
  linkTag,
  resolve,
  resolveTakiContributions,
} from "../dist/index.mjs";

const page = { kind: "page", pageType: "default", path: "/" };

test("valid custom attributes continue to render", async () => {
  const contributions = await resolveTakiContributions(
    [
      linkTag("preload", "/app.js", {
        as: "script",
        attributes: { "data-module": "app", nonce: "abc" },
      }),
    ],
    page,
  );

  assert.equal(contributions.fragments.length, 1);
  assert.equal(
    contributions.fragments[0].html,
    '<link data-module="app" nonce="abc" rel="preload" href="/app.js" as="script">',
  );
});

test("invalid rendered HTML attribute names are rejected", async () => {
  await assert.rejects(
    () =>
      resolveTakiContributions(
        [inlineStyle("body{}", { attributes: { "bad name": "value" } })],
        page,
      ),
    /Invalid HTML attribute name "bad name"/,
  );
});

test("invalid fragment attribute names are rejected before renderer handoff", async () => {
  await assert.rejects(
    () =>
      resolveTakiContributions(
        [externalScript("/app.js", { attributes: { "onload=": "alert(1)" } })],
        page,
      ),
    /Invalid HTML attribute name "onload="/,
  );

  await assert.rejects(
    () =>
      resolveTakiContributions(
        [inlineScript("console.log('ok')", { attributes: { "data bad": "value" } })],
        page,
      ),
    /Invalid HTML attribute name "data bad"/,
  );
});

test("resolver side effects do not run when a static rule has invalid attributes", async () => {
  let resolverRan = false;

  await assert.rejects(
    () =>
      resolveTakiContributions(
        [
          externalScript("/a.js", { attributes: { "bad name": "x" } }),
          resolve({ onError: "throw" }),
        ],
        page,
        {
          ctx: { log: { warn() {} } },
          resolve: () => {
            resolverRan = true;
            return [];
          },
        },
      ),
    /Invalid HTML attribute name "bad name"/,
  );

  assert.equal(resolverRan, false);
});

test("resolver onError ignore tolerates invalid attributes in resolver fragment output", async () => {
  const warnings = [];
  const result = await resolveTakiContributions(
    [resolve({ onError: "ignore", fragments: true })],
    page,
    {
      ctx: { log: { warn: (...args) => warnings.push(args) } },
      resolve: () => [externalScript("/x.js", { attributes: { "bad name": "x" } })],
    },
  );

  assert.deepEqual(result.fragments, []);
  assert.equal(warnings.length, 1);
});

test("resolver onError throw still rejects invalid attributes in resolver fragment output", async () => {
  await assert.rejects(
    () =>
      resolveTakiContributions([resolve({ onError: "throw", fragments: true })], page, {
        ctx: { log: { warn() {} } },
        resolve: () => [externalScript("/x.js", { attributes: { "bad name": "x" } })],
      }),
    /Invalid HTML attribute name "bad name"/,
  );
});

test("invalid Cloudflare helper attribute names are rejected before renderer handoff", async () => {
  await assert.rejects(
    () =>
      resolveTakiContributions(
        [cloudflareWebAnalytics("token", { attributes: { "x onload": "alert(1)" } })],
        page,
      ),
    /Invalid HTML attribute name "x onload"/,
  );

  await assert.rejects(
    () =>
      resolveTakiContributions([cloudflareZaraz({ attributes: { "bad/name": "value" } })], page),
    /Invalid HTML attribute name "bad\/name"/,
  );

  await assert.rejects(
    () =>
      resolveTakiContributions(
        [cloudflareTurnstile({ attributes: { "data bad": "value" } })],
        page,
      ),
    /Invalid HTML attribute name "data bad"/,
  );
});
