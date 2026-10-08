# Changelog

## 0.2.0

- Target EmDash 1.2, with compatibility tests pinned to `emdash@1.2.0` and a
  peer dependency of `^1.2.0`.
- Prevent early head resources from rendering twice when EmDash 1.2 creates
  fresh SEO-overlaid page contexts. Consumption is scoped to the request and
  page URL; late head and body fragments are preserved.
- Adapt the renderer tests to EmDash 1.2's request-scoped site-settings cache
  and exercise its actual native hook pipeline and page contribution runtime.
- Align the package and plugin descriptor versions at 0.2.0.
- Require Node.js `^22.22.2 || ^24.15.0 || >=26.0.0` for the installed EmDash
  dependency graph, and update CI and orb setup to Node 22.22.2.
- Document EmDash 1.2's SEO-panel, hreflang, and CSP behavior and the advanced
  full-head renderer's explicit-context boundary.
