DEVANA-FINDING: v1
DEVANA-STATE: open | P2 | high | security=no
DEVANA-KEY: src/index.ts:1261-1268 | assetmap-path-alias-gap

# resolveAssetUrl misses slash-prefixed keys for dot-relative paths

## Finding

`resolveAssetUrl` fuzzy matching does not translate `./scripts/app.js` into the `/scripts/app.js` assetMap key. The `scripts/app.js` and `/scripts/app.js` spellings can resolve, but a leading `./` prefix can miss a slash-prefixed map entry and fall back to the raw path.

## Violated Invariant Or Contract

Equivalent relative path spellings that point at the same asset should resolve through `assetMap` consistently. README presents `assetMap` as a lookup from stable asset keys to built URLs with fallback normalization.

## Oracle

`test/renderer-contract.test.mjs` expects `./scripts/app.js` to match `assetMap["scripts/app.js"]` via candidate normalization. The same test pattern uses keys without a leading slash. A map keyed the way Astro often emits absolute-style paths (`/scripts/app.js`) should work for the same logical asset.

## Counterexample

```js
await resolveTakiContributions(
  [deferScript("./scripts/app.js")],
  page,
  {
    assetMap: {
      "/scripts/app.js": "/_astro/app.hash.js",
    },
  },
);

// fragment src stays "./scripts/app.js" instead of "/_astro/app.hash.js"

await resolveTakiContributions(
  [deferScript("scripts/app.js")],
  page,
  { assetMap: { "/scripts/app.js": "/_astro/app.hash.js" } },
);

// candidate "/scripts/app.js" matches; src is "/_astro/app.hash.js"
```

## Why It Might Matter

Mixed rule authoring styles (`./` imports vs bare paths) against a single slash-prefixed `assetMap` produce inconsistent hashed URLs, breaking cache-busted builds and loading the wrong or missing bundle.

## Proof

**Dataflow trace:** `resolveAssetUrl("./scripts/app.js", assetMap)` → exact miss → candidates `{"./scripts/app.js", "scripts/app.js", "/./scripts/app.js"}` (`src/index.ts:1261-1264`) → none equals `"/scripts/app.js"` → returns literal input (`src/index.ts:1271`).

**Counterexample value:** `assetMap` key `"/scripts/app.js"` is never consulted for `./scripts/app.js` input, while `scripts/app.js` input reaches it via the `/${value}` candidate.

## Counterevidence Checked

- Exact key hits still work when the rule string matches the map key literally.
- Distinct from `assetmap-empty-string-mapping` (truthiness of values) and `assetmap-fragment-dedupe` (dedupe keys after resolution).
- When only the `scripts/app.js` key exists, `./scripts/app.js` can still match via the `value.slice(2)` candidate; this report covers the missing `/…` alias for dot-relative input.

## Suggested Next Step

Add a normalized candidate such as `/${value.replace(/^\.\/+/, "")}` or otherwise canonicalize `./` paths to the slash-prefixed form before fuzzy lookup.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2 `DEVANA-STATE: ...` and the final `DEVANA-SUMMARY:` status/priority/confidence prefix. Use one of: `open`, `fixed`, `invalid`, `stale`, `duplicate`, `wontfix`. Keep `DEVANA-KEY:` stable unless the same finding moved. Add dated notes below with evidence checked.

## Status Notes

- 2026-06-27: open by Devana. Initial report written from static source inspection.

DEVANA-KEY: src/index.ts:1261-1268 | assetmap-path-alias-gap
DEVANA-SUMMARY: open | P2 | high | resolveAssetUrl fuzzy lookup never tries slash-prefixed keys for ./-prefixed paths, so equivalent spellings resolve differently.