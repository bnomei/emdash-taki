DEVANA-FINDING: v1
DEVANA-STATE: wontfix | P2 | high | security=no
DEVANA-KEY: src/index.ts:167-179 | pagecache-stale-page-mutation

# Page cache ignores mutations on the same page object

## Finding

`createPlugin()` caches the resolver promise keyed only by page object identity. If page fields used by resolvers change on the same object after the first hook call, later calls reuse the first resolution result.

## Violated Invariant Or Contract

README documents per-page-object cache reuse but says resolver output should depend on the supplied `page` context. Mutating `page` fields between hook calls should produce updated contributions.

## Oracle

README page cache assumptions (`README.md` L217-234) and `resolveForPage` implementation (`src/index.ts` L167-179).

## Counterexample

```js
const plugin = createPlugin({ rules: [resolve()] }, {
  resolve: ({ page }) => [meta("description", page.title)],
});
const page = { pageType: "article", title: "First", /* ... */ };
await plugin.hooks["page:metadata"].handler({ page }, ctx); // "First"
page.title = "Second";
const md = await plugin.hooks["page:metadata"].handler({ page }, ctx);
// md[0].content === "First"
```

## Why It Might Matter

Hosts that reuse and mutate a page context object across hook phases, streaming, or incremental enrichment can serve stale SEO metadata for the remainder of the request.

## Proof

State transition trace: first handler call `pageCache.set(page, promise)` with resolver reading `title: "First"` → mutate `page.title` → second call `pageCache.get(page)` returns settled promise → stale `"First"` returned.

## Counterevidence Checked

- Fresh page objects per request avoid the bug; README emphasizes object identity, not field stability.
- Cache does not ignore `ctx` changes either; same root cause (identity-only key). Separate concern, same mechanism.
- `pagecache-rejected-promise` covers rejection stickiness, not field mutation.

## Suggested Next Step

Include a snapshot fingerprint of relevant page fields and options in the cache key, or document that page objects must be treated as immutable after first resolution.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2 `DEVANA-STATE: ...` and the final `DEVANA-SUMMARY:` status/priority/confidence prefix. Use one of: `open`, `fixed`, `invalid`, `stale`, `duplicate`, `wontfix`. Keep `DEVANA-KEY:` stable unless the same finding moved. Add dated notes below with evidence checked.

## Status Notes

- 2026-06-27: open by Devana. Reproduced stale `page.title` via consecutive metadata hook calls on one page object.
- 2026-06-27: wontfix (by design) + documentation clarified. The behavior is real and reproduces, but the WeakMap-by-identity cache is intentional: its purpose is to share one resolver pass between the `page:metadata` and `page:fragments` hooks when EmDash fires both for the same page object in a single render. README "Page cache assumptions" already documents that the same page object reuses the pending/fulfilled promise and that a new object triggers a new pass. The suggested fingerprint alternative was rejected as net-negative: resolvers can read arbitrary nested `page` fields, runtime options, and non-serializable `ctx`/external state, so no cheap fingerprint can soundly capture all resolution inputs, and a partial one would both defeat the intended within-render sharing and give a false sense of correctness. Mutating a shared page context between hook calls is outside the documented contract. Resolution: added an explicit README bullet stating the `page` object must be treated as immutable for the request (mutating fields after the first hook call does not re-run resolvers; pass a new page context object instead). No code change. Distinct from [[pagecache-rejected-promise]] (rejection stickiness, already fixed).

DEVANA-KEY: src/index.ts:167-179 | pagecache-stale-page-mutation
DEVANA-SUMMARY: wontfix | P2 | high | By-design identity cache; documented that the page object must be treated as immutable per request (mutations are not re-resolved). Fingerprint key rejected as unsound/fragile.