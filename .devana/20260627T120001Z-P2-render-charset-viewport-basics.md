DEVANA-FINDING: v1
DEVANA-STATE: open | P2 | high | security=no
DEVANA-KEY: src/index.ts:755-792 | render-charset-viewport-basics

# renderTaki charset and viewport true flags require basics

## Finding

`renderTaki(page, locals, { charset: true })` and `{ viewport: true }` emit nothing unless `basics: true` is also set. The sibling `title: true` flag works without `basics`. README documents each `true` flag independently.

## Violated Invariant Or Contract

Per-flag `true` options should apply their documented defaults regardless of `basics`. `charset: true` should emit `utf-8` and `viewport: true` should emit `width=device-width` as README states.

## Oracle

README `renderTaki` options (lines 617-620) say `charset: true` uses `utf-8` and `viewport: true` uses `width=device-width` without conditioning on `basics`. `title: true` uses the page title the same way and does work without `basics` via `titleValue`.

## Counterexample

```js
await renderTaki(
  { kind: "page", pageType: "page", path: "/", title: "Example" },
  { emdash: { collectPageMetadata: async () => [], collectPageFragments: async () => [] } },
  { charset: true, viewport: true, title: true },
);
```

Output contains `<title>Example</title>` but omits `<meta charset>` and `<meta name="viewport">`.

## Why It Might Matter

Layouts that selectively enable charset or viewport without the full `basics` bundle get silently incomplete `<head>` output, which can break encoding detection or mobile rendering while still appearing to opt in via documented flags.

## Proof

**Contract mismatch:** `titleValue` treats `value === true` as sufficient (`src/index.ts:791`). `optionValue` also treats `value === true` as sufficient, but callers pass `fallback: basics ? "utf-8" : null` (`src/index.ts:757-758`), so `true` resolves to `null` when `basics` is false.

**Cross-entry mismatch:** `title`, `charset`, and `viewport` are documented symmetrically in README but implemented asymmetrically in `renderTakiBasics`.

## Counterevidence Checked

- `basics: true` enables all three together as documented for the bundle case.
- String overrides (`charset: "utf-8"`) still work without `basics`.
- No test covers `charset: true` without `basics`; renderer contract tests use `{ basics: true }` only.

## Suggested Next Step

Pass unconditional defaults to `optionValue` when the flag is `true` (for example `optionValue(options.charset, "utf-8")` with `false` still disabling), or align README and `title` behavior explicitly if `basics` gating is intentional.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2 `DEVANA-STATE: ...` and the final `DEVANA-SUMMARY:` status/priority/confidence prefix. Use one of: `open`, `fixed`, `invalid`, `stale`, `duplicate`, `wontfix`. Keep `DEVANA-KEY:` stable unless the same finding moved. Add dated notes below with evidence checked.

## Status Notes

- 2026-06-27: open by Devana. Initial report written from static source inspection.

DEVANA-KEY: src/index.ts:755-792 | render-charset-viewport-basics
DEVANA-SUMMARY: open | P2 | high | renderTaki ignores charset:true and viewport:true unless basics:true, contradicting README while title:true works alone.