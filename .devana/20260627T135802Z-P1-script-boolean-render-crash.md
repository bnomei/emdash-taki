DEVANA-FINDING: v1
DEVANA-STATE: open | P1 | high | security=no
DEVANA-KEY: src/index.ts:1032-1041,923-937 | script-boolean-render-crash

# Boolean script attributes crash EmDash renderFragments

## Finding

`externalScript()` and `inlineScript()` accept boolean attribute values through `validateAttributeNames()`, which only checks attribute names. The resulting `PageFragmentContribution.attributes` object can contain booleans, but EmDash `renderFragments()` expects `Record<string, string>` and calls `value.replace()`, throwing `TypeError: value.replace is not a function`.

## Violated Invariant Or Contract

Fragment rule types declare `attributes?: Record<string, string>`. EmDash `PageFragmentContribution` matches that contract. Passing non-string attribute values should be rejected or normalized before handoff.

## Oracle

`TakiFragmentRule` attribute typing (`src/types.ts` L136, L143), EmDash `renderAttributes()` in `node_modules/emdash/src/page/fragments.ts` L51-54, and the asymmetry with link/base fragments that pre-render via Taki `renderAttributes()` (which handles booleans).

## Counterexample

```js
externalScript("/a.js", { attributes: { nomodule: true } })
// contribution.attributes === { nomodule: true }
// renderFragments(fragments, "head") → TypeError: value.replace is not a function
```

## Why It Might Matter

Valid HTML boolean attributes such as `nomodule` are natural inputs. A resolver returning them causes head rendering to crash for the page.

## Proof

Dataflow trace: `collectFragments` pushes `attributes: validateAttributeNames(rule.attributes)` unchanged (`1039`, `1047`) → EmDash `renderFragment` case `external-script` → `renderAttributes(c.attributes)` → `escapeHtmlAttr(v)` on boolean → crash.

## Counterevidence Checked

- Link-tag, base, and inline-style fragments use Taki `renderAttributes()` and stringify booleans safely before EmDash sees `kind: "html"`.
- Invalid attribute names are rejected; the failure is specific to valid names with boolean values.
- Tests cover invalid names but not boolean attribute values (`test/attributes.test.mjs`).

## Suggested Next Step

Coerce or reject non-string attribute values in `collectFragments` for script fragments, or widen only the HTML pre-render path and keep script attributes as strings.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2 `DEVANA-STATE: ...` and the final `DEVANA-SUMMARY:` status/priority/confidence prefix. Use one of: `open`, `fixed`, `invalid`, `stale`, `duplicate`, `wontfix`. Keep `DEVANA-KEY:` stable unless the same finding moved. Add dated notes below with evidence checked.

## Status Notes

- 2026-06-27: open by Devana. Reproduced with `resolveTakiContributions` + `renderFragments` from `emdash/page`.

DEVANA-KEY: src/index.ts:1032-1041,923-937 | script-boolean-render-crash
DEVANA-SUMMARY: open | P1 | high | Boolean script attributes survive collection and crash EmDash renderFragments with TypeError at page render time.