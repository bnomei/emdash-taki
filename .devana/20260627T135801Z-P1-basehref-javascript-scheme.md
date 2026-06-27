DEVANA-FINDING: v1
DEVANA-STATE: fixed | P1 | high | security=yes
DEVANA-KEY: src/index.ts:1111-1124,1251-1271 | basehref-javascript-scheme

# Fragment base href accepts javascript: URLs

## Finding

`baseHref()` and other fragment helpers that emit `<base href="...">` pass resolved URLs through `resolveAssetUrl()` without scheme allowlisting. A `javascript:` href is emitted verbatim into pre-rendered HTML fragments, which EmDash returns unchanged for `kind: "html"` contributions.

## Violated Invariant Or Contract

README documents that metadata `link()` href values are restricted to safe absolute schemes (`http://`, `https://`, `at://`) via EmDash. SECURITY.md recommends typed helpers such as `baseHref()` because they centralize escaping and URL handling. Fragment URL emission should not accept executable schemes.

## Oracle

README metadata link scheme policy (`README.md` L922-926), SECURITY.md typed-helper guidance (`SECURITY.md` L21-22), and the contrasting scheme filtering in `absolutizeMediaUrl()` (`src/index.ts` L1274-1286).

## Counterexample

```js
baseHref("javascript:alert(1)")
// → fragment html: '<base href="javascript:alert(1)">'
```

A resolver or `assetMap` remap can supply the same value: `assetMap: { "/": "javascript:alert(1)" }` with `baseHref("/")`.

## Why It Might Matter

`<base href="javascript:...">` rewrites relative links and form actions on the page to a `javascript:` URL, enabling script execution when visitors activate those controls. Impact requires untrusted URL data reaching the helper, but that is a realistic CMS/resolver path.

## Proof

Dataflow trace: untrusted `href` or `assetMap` value → `resolveAssetUrl()` returns scheme-bearing value unchanged (`1257-1258`) → `renderBaseFragment()` → `renderVoidElement("base", { href })` → `escapeHtmlAttr()` preserves `javascript:` → EmDash `renderFragments` returns `c.html` raw for `kind: "html"`.

## Counterevidence Checked

- Metadata `link()` contributions are filtered later by EmDash `isSafeHref`; fragment link/base paths never pass that gate.
- `stylesheet()` / `icon()` with `javascript:` href are lower impact because browsers do not execute JS from those rels on load.
- Raw `htmlFragment()` is a documented trust boundary; this path uses the typed `baseHref()` helper.

## Suggested Next Step

Apply the same safe-scheme allowlist used for metadata links to fragment `href`/`src` values after `resolveAssetUrl()`, at least for `<base>` and other URL-bearing fragment tags.

## Agent Handoff

After working this report, preserve the original finding body. Update line 2 `DEVANA-STATE: ...` and the final `DEVANA-SUMMARY:` status/priority/confidence prefix. Use one of: `open`, `fixed`, `invalid`, `stale`, `duplicate`, `wontfix`. Keep `DEVANA-KEY:` stable unless the same finding moved. Add dated notes below with evidence checked.

## Status Notes

- 2026-06-27: open by Devana. Verified runtime output `<base href="javascript:alert(1)">` from `resolveTakiContributions([baseHref("javascript:alert(1)")], page)`.
- 2026-06-27: fixed. Confirmed URL-bearing fragment tags emitted resolved hrefs/srcs verbatim with no scheme allowlisting, so `<base href="javascript:...">` (the highest-impact case — it rewrites every relative link/form action to a javascript: URL) and script src/link href could carry executable schemes, reachable via the typed helper or an assetMap/resolver remap. Added `DANGEROUS_URL_SCHEME_RE` (javascript|vbscript|data|file|blob) and `isSafeFragmentUrl`, which normalizes by stripping ASCII whitespace/control chars (U+0000–U+0020) before testing — closing the `java\tscript:` style bypass that browsers tolerate. Applied it after `resolveAssetUrl` to `<base>`, `<link>`/typed link helpers, external scripts, and Cloudflare-injected scripts; an unsafe URL drops the whole fragment (renderLinkFragment/renderBaseFragment now return null; external/cloudflare scripts are skipped) and emits a console.warn. Relative, anchor, query, protocol-relative (//host), and http/https/at/mailto/tel URLs are unaffected. Raw htmlFragment() remains a documented trust boundary and is intentionally not filtered. Added regression tests "drops base and script fragments with dangerous URL schemes" (literal, leading-space, tab-embedded, data: script, and assetMap-remap cases) and "keeps base and script fragments with safe URL schemes". typecheck clean, full suite green (30 tests).

DEVANA-KEY: src/index.ts:1111-1124,1251-1271 | basehref-javascript-scheme
DEVANA-SUMMARY: fixed | P1 | high | Fragment base/link/script URLs are now scheme-checked (whitespace-normalized) after assetMap resolution; dangerous-scheme fragments are dropped with a warning, closing the base-tag XSS.