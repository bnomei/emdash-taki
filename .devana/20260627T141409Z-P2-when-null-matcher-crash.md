DEVANA-FINDING: v1
DEVANA-STATE: fixed | P2 | high | security=no
DEVANA-KEY: src/index.ts:1315-1338 | when-null-matcher-crash

# Null elements in when matcher arrays crash page resolution

## Finding

`matchesPage` iterates `when` arrays with `list.some((matcher) => matchesSinglePage(matcher, page))`. A `null` or non-object matcher element causes `matchesSinglePage` to read `matcher.kind` and throw `TypeError`. This aborts `resolveTakiContributions` and plugin hooks for the page.

## Violated Invariant Or Contract

Omitted `when` matches all pages. Malformed matcher arrays should either be ignored or fail validation at config time, not crash runtime resolution. Arrays are documented as "match any object" but do not guard against null slots.

## Oracle

README L1089 ("Arrays match any value. Multiple matcher objects also match any object."); `src/index.ts:1319-1321` (`list.some` without null guard); `src/index.ts:1324-1325` (`matcher.kind` access).

## Counterexample

```js
await resolveTakiContributions(
  [{ kind: "meta", name: "x", content: "y", when: [null] }],
  page,
);
// TypeError: Cannot read properties of null (reading 'kind')
```

## Why It Might Matter

Config builders that assemble `when` from filtered lists (`[condition && { pageType: "x" }].filter(Boolean)` with a bug) or deserialized JSON with null holes can take down all head output for affected pages.

## Proof

**Control-flow trace:** rule with `when: [null]` → `matchesPage` → `matchesSinglePage(null, page)` → `null.kind` → uncaught `TypeError` → hook failure.

## Counterevidence Checked

`pathPrefix` with missing `page.path` is a separate known crash. Single valid matcher objects work. Empty `when: []` never matches (different failure mode, no throw).

## Suggested Next Step

Skip falsy matcher entries in `matchesPage`, or validate `when` arrays when rules are constructed.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2 `DEVANA-STATE: ...` and the final `DEVANA-SUMMARY:` status/priority/confidence prefix. Use one of: `open`, `fixed`, `invalid`, `stale`, `duplicate`, `wontfix`. Keep `DEVANA-KEY:` stable unless the same finding moved. Add dated notes below with evidence checked.

## Status Notes

- 2026-06-27: open by Devana. Confirmed TypeError for `when: [null]`.
- 2026-06-27: fixed. Confirmed `matchesSinglePage` read `matcher.kind` with no guard, so a `null`/non-object entry in a `when` array (e.g. a buggy `[cond && {...}].filter(Boolean)` or JSON with holes) threw a TypeError and aborted head resolution for the page. Added an `isRecord(matcher)` guard at the top of `matchesSinglePage` returning false (non-match) for non-object entries, so a null entry is ignored and sibling matchers in the array still evaluate. A single `when: null` is unaffected — `matchesPage`'s `!matchers` check already treats it as match-all (omitted semantics). Related to but distinct from [[pathprefix-missing-path]] (missing page.path). Added regression test "ignores null entries in when matcher arrays instead of crashing" (asserts `when: [null]` skips the rule while `when: [null, {pageType}]` still matches). typecheck clean, full suite green (43 tests).

DEVANA-KEY: src/index.ts:1315-1338 | when-null-matcher-crash
DEVANA-SUMMARY: fixed | P2 | high | matchesSinglePage now guards non-object matchers, so a null entry in a when array is a non-match instead of a TypeError that aborts resolution.