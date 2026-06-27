DEVANA-FINDING: v1
Priority: P3 | Confidence: high | Security-sensitive: no | Status: fixed
Location: src/index.ts:1254-1255,1267-1268 | Slug: assetmap-empty-string-mapping

# resolveAssetUrl ignores a present asset mapping whose value is the empty string

## Finding

`resolveAssetUrl` decides whether an `assetMap` entry is a hit by testing the
*truthiness of the mapped value*, not the *presence of the key*:

```ts
const exact = assetMap[value];
if (exact) return exact;            // 1254-1255
...
const resolved = assetMap[candidate];
if (resolved) return resolved;      // 1267-1268
```

When a key is present but maps to `""`, `if (exact)` is false, so the lookup is
treated as a miss. The function then either falls through to the fuzzy
candidate variants or returns the raw input path. A present mapping is silently
ignored, and—worse—an input can resolve to a *different* key's value.

## Violated Invariant Or Contract

If a key is present in `assetMap` (own enumerable property), its mapped target
is the canonical resolution for that exact input, regardless of the target
string's content. Presence (`value in assetMap`), not value-truthiness, is the
oracle for an exact hit.

## Oracle

`TakiAssetMap = Record<string, string>` (src/types.ts:20) admits `""` as a
valid value. The exact-match branch is documented/intended to take precedence
over the heuristic candidate variants below it; using truthiness defeats that
precedence for empty-string targets.

## Counterexample

Cross-key mis-resolution (input resolves to the wrong key's value):

- `assetMap = { "foo.js": "", "/foo.js": "https://cdn.example/REAL.js" }`
- Input `"foo.js"`:
  - `exact = assetMap["foo.js"] === ""` → `if (exact)` false → fall through.
  - candidates = `{ "foo.js", "/foo.js" }`; `"foo.js"` again `""` → skipped;
    `"/foo.js"` → returns `https://cdn.example/REAL.js`.
- The input `"foo.js"`, which has its *own* exact mapping (`""`), resolves to a
  neighbouring key's value instead of its own mapping.

Simple suppression case (mapping ignored entirely):

- `assetMap = { "/legacy.js": "" }`, input `"/legacy.js"` → falls through, no
  candidate matches → returns the unmapped raw `"/legacy.js"`.

## Why It Might Matter

A present asset mapping is silently disregarded, emitting either the original
unmapped URL or a different asset's URL into a `<link>`/`<script>`/`<base>` tag.
Impact is correctness (wrong or unmapped resource URL). Reachability is low
because asset manifests rarely map an entry to the empty string, hence P3.

## Proof

- Counterexample value + dataflow trace: `assetMap[value] === ""` is falsy, so
  both the exact branch (1254) and the candidate loop (1267) skip a valid,
  present mapping. Object index access returns `""`; `if ("")` is `false`.
- The same falsy guard is duplicated at both decision points, so neither path
  can honour an empty-string mapping.

## Counterevidence Checked

- `escapeHtmlAttr`/`renderAttributes` are downstream and do not compensate—they
  receive the already-wrong (raw or neighbouring) URL.
- No upstream guard rejects empty-string asset values; `TakiAssetMap` permits
  them.
- Not a duplicate of the existing `assetmap-fragment-dedupe` report: that
  finding concerns fragment dedupe *keys* built from unresolved paths; this is a
  resolution-precedence defect in `resolveAssetUrl` itself.

## Suggested Next Step

Replace the truthiness guards with presence checks, e.g.
`if (value in assetMap) return assetMap[value];` and
`if (candidate in assetMap) return assetMap[candidate];` (or
`Object.prototype.hasOwnProperty.call`). Decide explicitly whether an
empty-string target should mean "emit empty" or be rejected.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2
`Status: ...` and the final `DEVANA-SUMMARY:` status. Use one of: `open`,
`fixed`, `invalid`, `stale`, `duplicate`, `wontfix`. Add dated notes below with
the evidence checked.

## Status Notes

- 2026-06-25: open by Devana. Initial report written from static source inspection.
- 2026-06-27: fixed. Confirmed both the exact branch (`if (exact)`) and the candidate loop (`if (resolved)`) tested value-truthiness, so a present key mapped to "" was skipped and the input could fall through to a neighbouring key's value or the raw path. Replaced both guards with `Object.prototype.hasOwnProperty.call(assetMap, key)` presence checks (hasOwn rather than `in` to avoid inherited/prototype keys). Chose the contract-faithful "presence is the oracle" interpretation: a key mapped to "" resolves to "" (emit empty) and takes precedence over fuzzy candidates. Added regression test "honours a present empty-string assetMap mapping over fuzzy candidates". Full suite green (22 tests).

DEVANA-KEY: src/index.ts:1254-1255 | P3 | assetmap-empty-string-mapping
DEVANA-SUMMARY: Status=fixed | P3 high src/index.ts:1254-1255 - resolveAssetUrl now uses hasOwnProperty presence checks, so a present assetMap entry mapping to "" resolves to "" and keeps exact-match precedence over fuzzy candidates.
