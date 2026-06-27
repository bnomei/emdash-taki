DEVANA-FINDING: v1
DEVANA-STATE: open | P2 | high | security=no
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

DEVANA-KEY: src/index.ts:167-179 | pagecache-stale-page-mutation
DEVANA-SUMMARY: open | P2 | high | pageCache keys only page object identity, so mutating page fields after the first hook call returns stale resolver output.