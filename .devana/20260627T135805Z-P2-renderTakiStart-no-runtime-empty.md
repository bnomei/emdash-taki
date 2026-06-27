DEVANA-FINDING: v1
DEVANA-STATE: fixed | P2 | high | security=no
DEVANA-KEY: src/index.ts:460-487 | renderTakiStart-no-runtime-empty

# renderTakiStart returns empty when renderTaki still renders without runtime

## Finding

When `getPageRuntime(locals)` is missing, `renderTakiStart()` returns an empty string while `renderTaki()` still emits basics and fallback SEO metadata via `emdash/page` helpers.

## Violated Invariant Or Contract

README documents both helpers as reading the EmDash page runtime from `locals`. Missing runtime should degrade consistently or be documented as silent for `renderTakiStart` only.

## Oracle

README `renderTakiStart` and `renderTaki` argument docs (`README.md` L567-624) and the diverging branches at `src/index.ts` L466 vs L484-486.

## Counterexample

```js
const page = { title: "T", pageTitle: "T", url: "https://x.test/", canonical: "https://x.test/", /* ... */ };
await renderTakiStart(page, {}); // ""
await renderTaki(page, {}, { basics: true });
// emits charset, viewport, title, and base SEO metadata
```

## Why It Might Matter

Partially initialized `Astro.locals` yields no early waterfall output and no diagnostic, while the sibling full-head helper still renders useful content. Layouts using `renderTakiStart` before `EmDashHead` lose critical resource hints silently.

## Proof

Cross-entry mismatch: same `(page, locals)` inputs → `renderTakiStart` early return `""` (`466`) vs `renderTaki` `joinTakiHtml([basicsHtml, renderPageMetadata(...)])` (`484-486`).

## Counterevidence Checked

- Without runtime, there is no fragment collection path for `renderTakiStart`; empty output is coherent for fragments-only scope.
- README positions `renderTakiStart` before `EmDashHead`, not as a standalone head renderer; misconfiguration is plausible.
- `render-charset-viewport-basics` covers a different `renderTaki` options bug.

## Suggested Next Step

Document the silent empty fallback explicitly, or mirror `renderTaki`/`EmDashHead` degradation (log warning, optional static fallback).

## Agent Handoff

After working this report, preserve the original finding body. Update line 2 `DEVANA-STATE: ...` and the final `DEVANA-SUMMARY:` status/priority/confidence prefix. Use one of: `open`, `fixed`, `invalid`, `stale`, `duplicate`, `wontfix`. Keep `DEVANA-KEY:` stable unless the same finding moved. Add dated notes below with evidence checked.

## Status Notes

- 2026-06-27: open by Devana. Reproduced with `locals: {}` on both helpers.
- 2026-06-27: fixed via documentation (divergence is by design). Confirmed the divergence is semantically correct, not a defect: `renderTakiStart` emits only early page fragments, which are read from the EmDash page runtime via `getPageRuntime(locals)`, so without a runtime there are no fragments and `""` is the coherent result — the same output it returns when a runtime is present but has no early fragments. Adding a console.warn for the missing-runtime case was considered and rejected: it would conflate "no runtime" with the normal "no early fragments" case and produce noise on legitimate renders, and renderTakiStart is positioned as a pre-`EmDashHead` helper, not a standalone head renderer. `renderTaki` differs intentionally because it is the full-head path and can render `basics`/fallback SEO from the `page` context alone. Resolution per the report's suggested step: documented the empty-output behavior in the README `renderTakiStart` arguments section and contrasted it with `renderTaki`'s runtime-less fallback, with a hint to verify the runtime on `locals`. No code change.

DEVANA-KEY: src/index.ts:460-487 | renderTakiStart-no-runtime-empty
DEVANA-SUMMARY: fixed | P2 | high | By-design: renderTakiStart is fragments-only and returns "" without a runtime; documented the behavior and its contrast with renderTaki's fallback in the README.