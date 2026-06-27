DEVANA-FINDING: v1
Priority: P1 | Confidence: high | Security-sensitive: no | Status: fixed
Location: src/index.ts:870-879,1036-1108,1237-1240 | Slug: assetmap-fragment-dedupe

# assetMap aliases produce duplicate fragment tags

## Finding

When two fragment rules use different lookup paths that `assetMap` resolves to the same final URL, internal deduplication keeps both contributions. The page can emit duplicate `<link>` or `<script>` tags with identical resolved `href`/`src` values.

## Violated Invariant Or Contract

After `assetMap` resolution, contributions representing the same runtime resource should collapse under the package's last-wins dedupe model. Metadata links already dedupe using resolved `href`; fragment dedupe should behave consistently for the same emitted URL.

## Oracle

`test/renderer-contract.test.mjs` expects duplicate `externalScript("/same.js")` rules to collapse to one fragment. The same expectation should hold when two different pre-map paths resolve to one hashed URL via `assetMap`.

## Counterexample

```js
await resolveTakiContributions(
  [
    deferScript("src/vendor.js"),
    deferScript("src/app.js"),
  ],
  page,
  {
    assetMap: {
      "src/vendor.js": "/_astro/bundle.js",
      "src/app.js": "/_astro/bundle.js",
    },
  },
);
```

Both fragments survive with `src: "/_astro/bundle.js"` but distinct keys such as `emdash-taki:early:script:src/vendor.js` and `emdash-taki:early:script:src/app.js`.

## Why It Might Matter

Duplicate stylesheet or script tags waste bandwidth, can change load timing, and break the documented dedupe contract for cache-busted builds where multiple source keys map to one bundle URL.

## Proof

**Dataflow trace:** `collectFragments` → `resolveAssetUrl(rule.src, assetMap)` resolves both rules to `/_astro/bundle.js` → `fragmentKey(rule, \`script:${rule.src}\`)` embeds the unresolved path → `fragmentDedupeKey` always prefers `contribution.key` → `dedupeFragmentsLastWins` sees two different keys → both fragments reach `renderFragments` / `renderTakiStart` / `EmDashHead`.

**Contract mismatch:** `metadataDedupeKey` for links uses resolved `contribution.href` when no explicit key is set (`src/index.ts:858-860`), while fragment fallback keys use unresolved rule paths (`src/index.ts:1040,1107`).

## Counterevidence Checked

- Identical literal paths dedupe correctly because fallback keys match.
- Different `rel` values (e.g. stylesheet vs preload) should remain distinct and are unaffected.
- Explicit `key` on rules is the documented override; this report covers the default auto-key path used by waterfall helpers.
- README documents dedupe by key but does not explicitly promise URL-level fragment canonicalization; metadata behavior still shows the intended last-wins semantics for resolved URLs.

## Suggested Next Step

Derive fragment dedupe keys from resolved `src`/`href` (or canonical asset-map output) when no explicit `key` is set, or document that callers must set a shared `key` when aliasing paths through `assetMap`.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2 `Status: ...` and the final `DEVANA-SUMMARY:` status. Use one of: `open`, `fixed`, `invalid`, `stale`, `duplicate`, `wontfix`. Add dated notes below with the evidence checked.

## Status Notes

- 2026-06-25: open by Devana. Initial report written from static source inspection.
- 2026-06-27: fixed. Confirmed `collectFragments`, `renderLinkFragment`, and `renderBaseFragment` built fallback dedupe keys from the unresolved `rule.src`/`href` while the emitted contribution used the resolved URL, so assetMap aliases survived dedupe. Changed all three to resolve the URL once and derive the fallback key from the resolved value, so aliased paths now collapse under last-wins. Cloudflare fragments keep their stable semantic keys (intentional). Added regression test "collapses fragments whose distinct source paths resolve to one assetMap URL" in test/renderer-contract.test.mjs. Full suite green (19 tests).

DEVANA-KEY: src/index.ts:870-879 | P1 | assetmap-fragment-dedupe
DEVANA-SUMMARY: Status=fixed | P1 high src/index.ts:870-879 - Fragment fallback dedupe keys now derive from the resolved src/href, so assetMap aliases resolving to the same URL collapse under last-wins dedupe.