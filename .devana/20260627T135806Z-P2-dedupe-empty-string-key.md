DEVANA-FINDING: v1
DEVANA-STATE: open | P2 | high | security=no
DEVANA-KEY: src/index.ts:849-861,829-846 | dedupe-empty-string-key

# Empty string key collapses unrelated metadata rules

## Finding

`metadataDedupeKey()` uses `contribution.key ?? contribution.name` (and similar for property/link). An explicit `key: ""` is not nullish, so distinct meta/property/link rules that share `key: ""` dedupe into one slot regardless of their `name`, `property`, or `rel` values.

## Violated Invariant Or Contract

README documents `key` as a stable dedupe identifier per contribution. Empty string should either be rejected or treated as absent, not as a universal dedupe bucket.

## Oracle

`metadataDedupeKey()` (`src/index.ts` L849-861), `dedupeLastWins()` (`829-846`), README key option (`README.md` L513-514).

## Counterexample

```js
resolveTakiContributions([
  meta("description", "first", { key: "" }),
  meta("keywords", "second", { key: "" }),
], page)
// → single meta: { name: "keywords", content: "second" }
```

## Why It Might Matter

Generators that default `key` to `""` instead of `undefined` can silently drop unrelated metadata tags during last-wins dedupe.

## Proof

Counterexample value `key: ""` on two meta rules → both map to dedupe key `meta:` → second wins, first dropped.

## Counterevidence Checked

- Omitting `key` uses per-field fallback (`meta:${name}`) and dedupes correctly per name.
- Fragment dedupe uses explicit `contribution.key` truthy check (`871-872`); empty key falls through to src-based keys for scripts.
- No validation forbids empty string keys today.

## Suggested Next Step

Treat `""` as absent in `metadataDedupeKey`, or reject empty keys at rule construction time.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2 `DEVANA-STATE: ...` and the final `DEVANA-SUMMARY:` status/priority/confidence prefix. Use one of: `open`, `fixed`, `invalid`, `stale`, `duplicate`, `wontfix`. Keep `DEVANA-KEY:` stable unless the same finding moved. Add dated notes below with evidence checked.

## Status Notes

- 2026-06-27: open by Devana. Reproduced via `resolveTakiContributions` with two `key: ""` meta rules.

DEVANA-KEY: src/index.ts:849-861,829-846 | dedupe-empty-string-key
DEVANA-SUMMARY: open | P2 | high | key: "" makes metadataDedupeKey collapse unrelated meta/property/link rules into one last-wins bucket.