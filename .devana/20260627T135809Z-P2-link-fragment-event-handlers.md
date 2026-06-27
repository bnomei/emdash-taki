DEVANA-FINDING: v1
DEVANA-STATE: open | P2 | high | security=yes
DEVANA-KEY: src/index.ts:1071-1108,910-920 | link-fragment-event-handlers

# Pre-rendered link fragments bypass EmDash event-handler filtering

## Finding

Link-tag, base, and inline-style fragments are pre-rendered to `kind: "html"` strings via Taki `renderAttributes()`. Event-handler attributes such as `onload` are emitted into the HTML. EmDash returns `kind: "html"` fragments unchanged, unlike `external-script` and `inline-script` fragments where EmDash strips `on*` attributes at render time.

## Violated Invariant Or Contract

Script fragments handed to EmDash have event handlers removed (`EVENT_HANDLER_RE` in `emdash/src/page/fragments.ts`). Typed fragment helpers should apply equivalent safety across fragment kinds when attributes are user- or resolver-supplied.

## Oracle

EmDash `renderAttributes` for script fragments (`node_modules/emdash/src/page/fragments.ts` L49-54), Taki `renderAttributes()` (`910-920`), and tests showing script `onload` is not emitted while attribute values are escaped (`test/renderer-contract.test.mjs` L398-430).

## Counterexample

```js
stylesheet("/x.css", { attributes: { onload: "alert(1)" } })
// → '<link onload="alert(1)" rel="stylesheet" href="/x.css">'
// renderFragments returns the string verbatim
```

## Why It Might Matter

Resolver-controlled or CMS-derived attribute maps can inject executable event handlers into head HTML on a path that developers may assume is aligned with EmDash script sanitization.

## Proof

Cross-entry mismatch: `external-script` attributes filtered at EmDash render → `link-tag` pre-rendered to html kind → no handler filtering at sink.

## Counterevidence Checked

- Attribute values are HTML-escaped; the issue is permitted handler attribute names, not quote breakout.
- Developers must pass `attributes`; this is not automatic from content fields.
- Raw `htmlFragment()` is a documented trust boundary; this path uses typed `stylesheet()`.

## Suggested Next Step

Strip or reject `on*` attribute names in Taki `renderAttributes()`, matching EmDash script fragment policy.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2 `DEVANA-STATE: ...` and the final `DEVANA-SUMMARY:` status/priority/confidence prefix. Use one of: `open`, `fixed`, `invalid`, `stale`, `duplicate`, `wontfix`. Keep `DEVANA-KEY:` stable unless the same finding moved. Add dated notes below with evidence checked.

## Status Notes

- 2026-06-27: open by Devana. Reproduced `onload` preserved in pre-rendered stylesheet fragment HTML.

DEVANA-KEY: src/index.ts:1071-1108,910-920 | link-fragment-event-handlers
DEVANA-SUMMARY: open | P2 | high | Link and style fragments pre-render event-handler attributes into html fragments that EmDash emits without the script-path on* filtering.