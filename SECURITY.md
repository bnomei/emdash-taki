# Security Policy

## Raw head helpers

`@bnomei/emdash-taki` escapes values emitted by typed helpers where the library
constructs HTML, such as attributes on link/base tags and text in generated
metadata. The raw helpers are different: they are deliberate escape hatches for
already-trusted markup, script, or CSS.

Treat these helpers as trust-boundary crossings:

- `htmlFragment(html)` inserts the supplied HTML fragment as-is.
- `inlineScript(code)` passes the supplied JavaScript to EmDash as inline script
  code as-is.
- `inlineStyle(css)` emits global CSS inside a `<style>` element. It is not
  scoped or sanitized; the renderer only prevents literal closing `</style>`
  sequences from breaking out of the element.

Do not pass user-generated, CMS-authored, request-derived, or third-party data to
these helpers unless your application has validated and sanitized that data for
the exact target context first. Prefer typed helpers such as `stylesheet()`,
`preload()`, `baseHref()`, and metadata helpers whenever possible because they
centralize escaping and URL handling.

## Reporting vulnerabilities

Please report suspected vulnerabilities through GitHub security advisories for
this repository, or contact the maintainer listed in `package.json` if advisories
are not available. Include a minimal reproduction and avoid publicly disclosing
exploit details until a fix is available.
