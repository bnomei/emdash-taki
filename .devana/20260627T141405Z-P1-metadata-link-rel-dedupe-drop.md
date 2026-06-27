DEVANA-FINDING: v1
DEVANA-STATE: open | P1 | high | security=no
DEVANA-KEY: src/index.ts:849-861,992-999 | metadata-link-rel-dedupe-drop

# Metadata links with different rel but same href are dropped at EmDash render

## Finding

Taki preserves multiple non-canonical metadata links that share an `href` but differ in `rel` (for example `alternate` and `author`). After `resolvePageMetadata()` runs, only the first link survives. The second rel is silently removed from rendered head output.

## Violated Invariant Or Contract

README states: "Non-canonical metadata links dedupe by `rel` plus an explicit `key`, `hreflang`, or `href`." `tests/metadata-dedupe.test.mjs` asserts both `alternate` and `author` links remain in `resolveTakiContributions()` output. EmDash `resolvePageMetadata()` dedupes non-canonical links by `c.key ?? c.hreflang ?? c.href` without `rel`.

## Oracle

README L1095–1096; `tests/metadata-dedupe.test.mjs` L19–40; `node_modules/emdash/src/page/metadata.ts` L118–124; `src/index.ts:860` (`metadataDedupeKey` includes `rel`).

## Counterexample

```js
const { metadata } = await resolveTakiContributions(
  [
    link("alternate", "https://example.com/about"),
    link("author", "https://example.com/about"),
  ],
  page,
);
// metadata.length === 2

resolvePageMetadata(metadata).links.length === 1
// only { rel: "alternate", href: "https://example.com/about" } remains
```

## Why It Might Matter

Pages that emit both `rel=alternate` and `rel=author` (or other rel pairs) pointing at the same URL lose metadata at render time despite passing Taki dedupe and tests. Author/license/alternate combinations on shared team or license URLs are realistic.

## Proof

**Contract mismatch:** Taki internal dedupe key `link:${rel}:${href}` keeps both contributions. `collectMetadata` emits `key: rule.key` (undefined when unset). EmDash downstream dedupe ignores `rel`, so the author link is skipped.

**Dataflow:** `link()` rules → `collectMetadata` → `dedupeMetadataLastWins` (2 items) → `resolvePageMetadata` (1 link) → `renderPageMetadata` omits author.

## Counterevidence Checked

README allows explicit `key` to disambiguate, but the documented default dedupe contract includes `rel` without requiring callers to set `key`. Taki tests never call `resolvePageMetadata`, so the downstream mismatch is not caught in CI. EmDash first-wins after Taki last-wins is intentional for overrides, but here the rel dimension is lost in the handoff shape.

## Suggested Next Step

Emit rel-aware `key` values from `collectMetadata` when `rule.key` is unset (for example `link:${rel}:${href}`), or document that callers must set explicit keys and extend tests to run `resolvePageMetadata`.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2 `DEVANA-STATE: ...` and the final `DEVANA-SUMMARY:` status/priority/confidence prefix. Use one of: `open`, `fixed`, `invalid`, `stale`, `duplicate`, `wontfix`. Keep `DEVANA-KEY:` stable unless the same finding moved. Add dated notes below with evidence checked.

## Status Notes

- 2026-06-27: open by Devana. Confirmed with `node` repro: taki count 2, EmDash links count 1.

DEVANA-KEY: src/index.ts:849-861,992-999 | metadata-link-rel-dedupe-drop
DEVANA-SUMMARY: open | P1 | high | Taki keeps alternate+author links with the same href, but EmDash resolvePageMetadata dedupes by href only and drops the second rel at render time.