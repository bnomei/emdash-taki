DEVANA-FINDING: v1
DEVANA-STATE: fixed | P1 | high | security=no
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
- 2026-06-27: fixed. Confirmed Taki's `metadataDedupeKey` keys non-canonical links rel-aware (`link:rel:...`) so both survive Taki dedupe, but EmDash `resolvePageMetadata` dedupes them by `key ?? hreflang ?? href` with no rel, dropping the second rel at render. `collectMetadata` emitted `key: undefined`, so EmDash fell back to href and collapsed alternate+author. Fix per the report's suggested step: emit a rel-aware contribution key from `collectMetadata` via `linkContributionKey(rel, key, hreflang, href)` = `${rel}:${explicitKey ?? hreflang ?? href}` for non-canonical links, so EmDash's dedupe becomes rel-aware and matches Taki's documented contract; canonical returns no synthetic key (both layers already special-case the single "canonical" bucket), preserving the existing canonical dedupe. The injected key affects dedupe only, not rendering (EmDash renders rel/href/hreflang). Updated tests/metadata-dedupe.test.mjs to assert the new keys and, crucially, added downstream `resolvePageMetadata(...).links` assertions (the stage Taki tests previously skipped) proving alternate+author both render; same-rel+href still dedupes; canonical unchanged. typecheck clean, full suite green (37 tests).

DEVANA-KEY: src/index.ts:849-861,992-999 | metadata-link-rel-dedupe-drop
DEVANA-SUMMARY: fixed | P1 | high | collectMetadata now emits a rel-aware link key so EmDash's rel-blind link dedupe keeps same-href/different-rel links; tests extended through resolvePageMetadata.