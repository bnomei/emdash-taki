# @bnomei/emdash-taki

[![npm version](https://img.shields.io/npm/v/@bnomei/emdash-taki.svg)](https://www.npmjs.com/package/@bnomei/emdash-taki)
[![npm downloads](https://img.shields.io/npm/dm/@bnomei/emdash-taki.svg)](https://www.npmjs.com/package/@bnomei/emdash-taki)
[![license](https://img.shields.io/npm/l/@bnomei/emdash-taki.svg)](https://www.npmjs.com/package/@bnomei/emdash-taki)
[![types](https://img.shields.io/badge/types-included-blue.svg)](./package.json)
[![source](https://img.shields.io/badge/source-GitHub-181717.svg?logo=github)](https://github.com/bnomei/emdash-taki)

HTML head waterfall renderer and dynamic helpers for EmDash, Astro, and
Cloudflare sites.

`@bnomei/emdash-taki` provides dynamic, server-resolved head contributions with
static fallbacks and a strict resource waterfall renderer. The goal is to keep
shared head policy in one native EmDash plugin, compute page-specific metadata
on the server, and leave template-local rendering in Astro.

## What You Get

- Template-based server-resolved metadata with static fallbacks.
- Typed helpers for metadata, JSON-LD, resource hints, CSS, scripts, icons, and
  feeds.
- A `renderTakiStart()` helper that renders critical resource hints
  before EmDash's normal metadata output.
- Optional fragment, Cloudflare, cache-busting, and waterfall helpers for
  special cases.

## Install

```sh
npm install @bnomei/emdash-taki
```

## Quick Start: Template Taki Files With Static Fallbacks

Put stable site-wide rules in `astro.config.mjs`, point `emdash-taki` at a
runtime file, then add one file per template in `src/taki/`. When `runtime` is
configured, template loading is automatic unless `templates: false` is set.

### 1. Register Static Rules

```js
import emdash from "emdash/astro";
import takiPlugin, * as taki from "@bnomei/emdash-taki";

const rules = [
  taki.meta("theme-color", "#101820"),
  taki.meta("description", "Default description"),
  taki.property("og:title", "Example"),
  taki.deferScript("/scripts/app.js"),
  taki.icon("/favicon.svg", { type: "image/svg+xml" }),
];

export default {
  integrations: [
    emdash({
      plugins: [
        takiPlugin({
          runtime: "./src/emdash-taki-runtime.ts",
          capabilities: ["content:read"],
          rules,
        }),
      ],
    }),
  ],
};
```

### 2. Export the Runtime

Create the file referenced by `runtime`: `src/emdash-taki-runtime.ts`. EmDash
loads this native module and expects it to export `createPlugin`.
`defineTakiRuntime()` creates that export from a Vite glob.

```ts
import { defineTakiRuntime } from "@bnomei/emdash-taki";

export const createPlugin = defineTakiRuntime(
  import.meta.glob("./taki/*.{ts,js}", { eager: true }),
);
```

### 3. Add Template Taki Files

Each file name maps to `page.pageType`: `src/taki/article.ts` handles the
`article` template, `src/taki/product.ts` handles `product`, and so on.

```ts
// src/taki/article.ts
import { jsonLd, meta, property } from "@bnomei/emdash-taki";

export default async function articleTaki({ page, ctx }) {
  if (!page.content || !ctx.content) return null;

  const entry = await ctx.content.get(page.content.collection, page.content.id);
  if (!entry) return null;

  const title = String(entry.data.title ?? page.title ?? "");
  const description = String(entry.seo?.description ?? page.description ?? "");

  return [
    meta("description", description),
    property("og:title", title),
    jsonLd("article", {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: title,
      url: page.url,
    }),
  ];
}
```

Template modules can export `default`, `taki`, `<template>`, `<template>Taki`,
or a single function export. For `src/taki/article.ts`, all of these are valid:
`default`, `taki`, `article`, or `articleTaki`.

The naming split is from EmDash's native plugin contract:

- `takiPlugin()` is what you register in `astro.config.mjs`.
- `createPlugin` is the export EmDash loads from `src/emdash-taki-runtime.ts`.
- `defineTakiRuntime()` builds that `createPlugin` export from your template
  modules.

### 4. Render Taki

Edit the Astro layout that already renders your page `<head>`, usually
`src/layouts/Base.astro` or the equivalent site shell. Keep the usual Astro and
EmDash tags, and add the waterfall helper immediately before `EmDashHead`.

```astro
---
import { EmDashHead, EmDashBodyStart, EmDashBodyEnd } from "emdash/ui";
import { renderTakiStart } from "@bnomei/emdash-taki";
const resolvedTitle = pageContext.title ?? "Example";
const taki = await renderTakiStart(pageContext, Astro.locals);
---

<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width" />
  <title>{resolvedTitle}</title>
  <Fragment set:html={taki} />
  <EmDashHead page={pageContext} />
</head>
<body>
  <EmDashBodyStart page={pageContext} />
  <slot />
  <EmDashBodyEnd page={pageContext} />
</body>
```

This gives you static fallback metadata, server-resolved page metadata, stable
dedupe, and strict ordering for resource helpers. The usual first tags
`charset`, `viewport`, and `title` stay in your layout. `renderTakiStart()`
only moves `emdash-taki`'s early resource fragments before `EmDashHead`; it also
removes those fragments from EmDash's cached fragment list so `EmDashHead` does
not render duplicates.

To disable automatic template loading, set `templates: false` and remove the
glob from the runtime file:

```js
takiPlugin({
  runtime: "./src/emdash-taki-runtime.ts",
  templates: false,
  rules,
});
```

## Strict Waterfall Renderer

The default renderer is `renderTakiStart()`. It complements EmDash's
stock `EmDashHead`, so existing layouts only need one extra HTML line before
`EmDashHead`.

The helper renders in this order:

```html
<!-- Your normal Astro layout -->
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width" />
<title>...</title>

<!-- renderTakiStart() -->
<link rel="preconnect" href="..." />
<link rel="stylesheet" href="..." />
<script src="..." defer></script>

<!-- EmDashHead -->
<meta name="description" content="..." />
<meta property="og:title" content="..." />
<link rel="canonical" href="..." />
<script type="application/ld+json">
  ...
</script>

<!-- Site identity and late fragments -->
<link rel="icon" href="..." />
```

The early group is controlled by the `emdash-taki` helpers.
`renderTakiStart()` renders those early fragments and removes them from
the EmDash fragment cache before stock `EmDashHead` runs, so the same stylesheet,
preload, or script is not emitted twice.

These helpers default to `phase: "early"` because Harry Roberts' head waterfall
puts resource discovery before SEO/social metadata:

- `preconnect()`
- `dnsPrefetch()`
- `asyncScript()`
- `blockingScript()`
- `inlineStyle()`
- `stylesheet()`
- `preload()`
- `deferScript()`
- `prefetch()`
- `prerender()`
- `baseHref()`

These helpers stay late unless you pass `{ phase: "early" }`:

- `externalScript()`
- `inlineScript()`
- `htmlFragment()`
- `icon()`
- `manifest()`
- `feed()`
- Cloudflare helpers

Use stock `EmDashHead` when a project only needs metadata and does not care
about strict resource discovery order. With stock `EmDashHead`, all head
fragments still render after typed metadata because that is EmDash core's
current render order.

For full control, use `renderTaki()` instead of `EmDashHead`. That
helper renders basics, early fragments, metadata, site identity, and late
fragments in one HTML string. This is the advanced path for layouts that do not
want the stock EmDash head component at all.

## Static Fallbacks and Constants

Use static rules for site-wide constants, resource hints, and fallback values.
Template files run after those rules, so dynamic template output can overwrite
fallbacks with the same dedupe key.

```js
rules: [
  taki.meta("theme-color", "#101820", {
    key: "theme-color",
  }),
  taki.meta("description", "Default description", {
    key: "description",
  }),
];
```

Template handlers and resolvers can return an ordered rule array, or an object
with `rules`, `metadata`, `fragments`, and `assetMap`.

```ts
return [
  meta("robots", "noindex", {
    key: "robots",
  }),
  jsonLd("custom", graph, {
    key: "custom-jsonld",
  }),
];
```

If template files return fragments and no static fragment rule already exists,
opt automatic templates into the fragment hook:

```js
takiPlugin({
  runtime: "./src/emdash-taki-runtime.ts",
  templates: { fragments: true },
  rules,
});
```

Use `capabilities` on `takiPlugin()` for anything the resolver needs from
`ctx`, such as `content:read`, `media:read`, or `network:request`. Use
`allowedHosts` with `network:request`.

## Template, Collection, and URI Rules

Automatic template loading uses `page.pageType`. Use explicit rules only when
you want to restrict, rename, or add a non-template case.

```js
// Explicit template rule. Equivalent to the automatic pageType dispatch.
taki.template("article");

// Match a route section that is not cleanly expressed as a template.
taki.resolve({
  when: { pathPrefix: "/docs/" },
  input: { type: "docs" },
});

// Static assets can still use matchers.
taki.stylesheet("/styles/docs.css", {
  when: { collection: "docs" },
});
```

Matchers can target `kind`, `pageType`, `collection`, `locale`, exact `path`,
or `pathPrefix`. Keep the default path template-first. Use collection, kind, or
path matching when the template name is not precise enough.

## Advanced: Cache-Busted Assets

Native plugin options are JSON data, so `rules` cannot contain Astro imported
asset modules. Most projects should use public URLs, external URLs, or Astro
imports in the template itself. Use `assetMap` only when a host, cache layer, or
resolver already knows the final built URL.

```js
const assetMap = {
  "src/styles/global.css": "/_astro/global.D7a8Qx4k.css",
  "src/scripts/app.js": "/_astro/app.Dq8nT6pL.js",
  "src/fonts/app.woff2": "/_astro/app.Dz3u1K2f.woff2",
};

takiPlugin({
  assetMap,
  rules: [
    taki.stylesheet("src/styles/global.css"),
    taki.preload("src/fonts/app.woff2", "font", {
      type: "font/woff2",
      crossorigin: true,
    }),
    taki.deferScript("src/scripts/app.js"),
  ],
});
```

The helper argument is the lookup key. If `assetMap` contains that key, the
final cached URL is emitted. If the key is missing, the literal value is emitted
because `emdash-taki` cannot invent the hashed URL.

Resolvers can also return an `assetMap` when URLs are only known at runtime.
The returned map is merged for the whole resolved page, so later collection uses
it for static rules and resolver-returned rules.

Use Astro instead when the asset needs Astro component semantics: scoped styles,
component scripts, ESM imports, image transforms, or template-local data.

## Resource Helpers

Resource helpers emit fragments and default to `placement: "head"`. Use them in
static `rules` or return them from a template file that opts into fragments.
With `renderTakiStart()`, resource-discovery helpers marked
`phase: "early"` render before SEO/social metadata.

```js
rules: [
  taki.preconnect("https://fonts.gstatic.com", { crossorigin: true }),
  taki.stylesheet("src/styles/global.css"),
  taki.preload("src/fonts/app.woff2", "font", { crossorigin: true }),
  taki.deferScript("src/scripts/app.js"),
  taki.icon("/favicon.svg", { type: "image/svg+xml" }),
  taki.manifest("/site.webmanifest"),
];
```

### Waterfall Order

Use this order for strict browser resource discovery:

```js
rules: [
  // 1. Early origin hints
  taki.preconnect("https://fonts.gstatic.com", { crossorigin: true }),
  taki.dnsPrefetch("https://analytics.example.com"),

  // 2. Early async scripts, only when they need discovery before CSS
  taki.asyncScript("src/scripts/app-async.js"),

  // 3. Blocking scripts, only when blocking is intentional
  taki.blockingScript("src/scripts/app-blocking.js"),

  // 4. Critical inline CSS, then external CSS
  taki.inlineStyle(":root { color-scheme: light dark; }", {
    key: "critical-css",
  }),
  taki.stylesheet("src/styles/global.css"),

  // 5. Preload assets needed soon
  taki.preload("src/fonts/app.woff2", "font", {
    type: "font/woff2",
    crossorigin: true,
  }),

  // 6. Deferred scripts
  taki.deferScript("src/scripts/app-defer.js"),

  // 7. Future navigation hints
  taki.prefetch("/next-page/"),
  taki.prerender("/next-page/"),

  // 8. Favicons, app icons, manifests, feeds, and other stable extras
  taki.icon("/favicon.svg", { type: "image/svg+xml" }),
  taki.manifest("/site.webmanifest"),
  taki.feed("/feed.xml", { title: "RSS" }),
];
```

If a resource hint, stylesheet, or script must appear before all metadata for
performance reasons, add `renderTakiStart()` immediately before
EmDash's stock `EmDashHead`.

## Cloudflare Snippets

Use the Cloudflare helpers when the site wants these snippets controlled by the
same head policy.

```js
rules: [
  taki.cloudflareZaraz(),
  taki.cloudflareTurnstile({ render: "explicit", preconnect: true }),
  taki.cloudflareWebAnalytics("YOUR_TOKEN"),
];
```

## Runtime Boundaries

The serialized `takiPlugin({ rules })` side is intentionally data-only because
EmDash writes native plugin options into the runtime module. Do not pass
functions, class instances, Astro components, or imported asset objects in
`rules`.

For simple dynamic SEO values, prefer the EmDash page context first.
EmDash's stock `EmDashHead` derives base description, canonical, Open Graph,
Twitter Card, article metadata, and primary JSON-LD from the current page
context, with plugin metadata able to override by key. The advanced
`renderTaki()` helper mirrors that behavior when replacing `EmDashHead`
entirely.

For custom dynamic JSON-LD or fragments that depend on data outside the page
context, use template Taki files plus the native runtime wrapper. Render the
item in Astro only when it depends on template-local data that should remain in
that template, or when the asset/component should stay inside Astro's own import
and rendering pipeline.

For strict waterfall-critical resources, prefer `renderTakiStart()`
immediately before stock `EmDashHead`. Use the advanced `renderTaki()`
helper only when the layout wants to replace `EmDashHead` entirely.

Templates and resolvers are metadata-only by default. Use
`templates: { fragments: true }`, `taki.templates({ fragments: true })`, or
`fragments: true` on a resolver rule when dynamic output can include page
fragments and no static fragment helper already registers the fragment hook.

Automatic template dispatch calls the matching template handler directly from
the page hooks. It does not issue an internal HTTP request to the same site. If
you also need a plugin API route for admin preview or debugging, expose a route
in your wrapper and call the same handler from that route.

## Option Reference

Every helper returns a plain JSON-serializable rule object. Native plugin
options are serialized by EmDash when it generates the runtime plugin module, so
do not pass functions, class instances, or runtime-only objects in `rules`.

### Common Options

`takiPlugin()` accepts:

- `allowedHosts`: host allowlist used by `ctx.http` when `network:request` is
  declared.
- `assetMap`: serializable lookup from stable asset key to final cached URL.
- `capabilities`: additional EmDash capabilities needed by server resolvers.
- `runtime`: native runtime wrapper module used when registering resolvers.
- `priority`: EmDash hook priority.
- `rules`: ordered head rules.
- `templates`: `true` by default when `runtime` is set; use `false` to disable
  automatic template dispatch, or pass options such as `{ fragments: true }`.

All rules accept:

- `key`: stable dedupe key.
- `when`: page matcher object or array of matcher objects.

Fragment helpers also accept:

- `placement`: `"head"`, `"body:start"`, or `"body:end"`.
- `phase`: `"early"` or `"late"` for `renderTakiStart()` and
  `renderTaki()`. Early head
  fragments render before metadata.

The waterfall helpers default to `placement: "head"` unless documented
otherwise.

URL fields in typed helpers resolve through `assetMap` first. Missing entries
fall back to the literal value.

Within `emdash-taki`, later matching contributions with the same dedupe key
overwrite earlier ones. This is how `taki.resolve()` can override static
fallbacks while still returning a clean first-wins list to EmDash.

### `defineTakiRuntime(runtime)`

Builds the `createPlugin` export for the runtime file referenced by
`takiPlugin({ runtime })`.

```ts
export const createPlugin = defineTakiRuntime(
  import.meta.glob("./taki/*.{ts,js}", { eager: true }),
);
```

The export must be named `createPlugin` because EmDash loads that symbol from
the native runtime module. Pass a Vite glob map for the default template-file
workflow. Template names are inferred from file names, and each module can
export `default`, `taki`, `<template>`, `<template>Taki`, or a single function
export.

Use explicit maps or named resolvers only when the project needs more control:

```ts
export const createPlugin = defineTakiRuntime({
  templates: {
    article: async ({ page, ctx }) => {
      return [property("og:type", "article")];
    },
  },
  resolvers: {
    productTaki: async ({ page, ctx }) => {
      return [property("og:type", "product")];
    },
  },
});
```

### `renderTakiStart(page, locals)`

Returns only the early resource-discovery fragments. Use this before stock
`EmDashHead`.

```astro
---
import { EmDashHead } from "emdash/ui";
import { renderTakiStart } from "@bnomei/emdash-taki";

const taki = await renderTakiStart(pageContext, Astro.locals);
---

<Fragment set:html={taki} />
<EmDashHead page={pageContext} />
```

Arguments:

- `page`: EmDash public page context.
- `locals`: Astro locals, used to read the EmDash page runtime.

Call this before `EmDashHead` with the same `pageContext` object. The helper
removes early fragments from EmDash's cached fragment list after rendering them,
so stock `EmDashHead` still renders metadata, site identity, and late fragments
without duplicating early resources.

### `renderTaki(page, locals, options)`

Returns the full `<head>` contribution HTML that replaces EmDash's stock
`EmDashHead`. This is the full-control path.

```astro
---
import { renderTaki } from "@bnomei/emdash-taki";

const headHtml = await renderTaki(pageContext, Astro.locals, {
  basics: true,
});
---

<Fragment set:html={headHtml} />
```

Options:

- `page`: EmDash public page context.
- `locals`: Astro locals, used to read the EmDash page runtime.
- `basics`: renders `<meta charset="utf-8">`, viewport, and title from the page
  context.
- `charset`: `true` uses `utf-8`, a string overrides it, `false` disables it.
- `viewport`: `true` uses `width=device-width`, a string overrides it, `false`
  disables it.
- `title`: `true` uses the page title, a string overrides it, `false` disables
  it.

This helper replaces `EmDashHead`. Keep using `EmDashBodyStart` and
`EmDashBodyEnd` from `emdash/ui`.

### `template(name, options)`

Runs the template dispatcher for one template name.

```js
taki.template("article");
taki.template("product", { fragments: true });
```

By default this matches `when: { pageType: name }` and passes
`input: { template: name }` to the template dispatcher. Use this when automatic
template dispatch is disabled or when one template needs custom options.

### `templates(options)`

Runs the global template dispatcher.

```js
taki.templates({ fragments: true });
```

When `takiPlugin({ runtime })` is configured, this rule is added automatically
unless `templates: false` is set or an explicit template rule already exists.
The dispatcher uses `page.pageType` to select the matching template module.

### `resolve(options)`

Runs the default server resolver from the native runtime wrapper.

```js
taki.resolve({
  when: { pageType: "article" },
  input: { type: "article" },
});
taki.resolve({
  when: { collection: "products" },
  input: { type: "product" },
});
```

Use this for non-template dynamic cases where the value cannot be expressed as
static JSON in `astro.config.mjs`, but can be computed from `event.page`,
`ctx.content`, `ctx.media`, `ctx.kv`, or another server-side EmDash context API.
The resolver input must be serializable.

Options:

- `fragments`: set to `true` when this resolver can return page fragments and no
  other static fragment rule registers the fragment hook.
- `input`: JSON-serializable resolver input.
- `onError`: `ignore` by default; use `throw` to fail the hook when a resolver
  fails.

### `resolve(resolver, options)`

Runs a named server resolver from the native runtime wrapper.

```js
taki.resolve("productTaki", {
  when: { collection: "products" },
  input: { type: "product" },
  onError: "ignore",
});
```

Use this only when the runtime wrapper registers multiple resolvers. The
resolver name and `input` must be serializable.

Options:

- `fragments`: set to `true` when this resolver can return page fragments and no
  other static fragment rule registers the fragment hook.
- `input`: JSON-serializable resolver input.
- `onError`: `ignore` by default; use `throw` to fail the hook when a resolver
  fails.

### `preconnect(href, options)`

Emits `<link rel="preconnect">`.

```js
taki.preconnect("https://fonts.gstatic.com", { crossorigin: true });
```

Use this before the browser discovers a critical cross-origin request. Avoid
spraying preconnects for origins that are not needed immediately.

### `dnsPrefetch(href, options)`

Emits `<link rel="dns-prefetch">`.

```js
taki.dnsPrefetch("https://analytics.example.com");
```

Use this for lower-priority origins where resolving DNS early is useful but a
full connection is too expensive.

### `asyncScript(src, options)`

Emits an external script with `async`.

```js
taki.asyncScript("/vendor/app-async.js");
```

Use only for scripts that can execute independently. `async` can still compete
with CSS discovery or inject more work, so keep it early only when early
discovery is intentional. `src` resolves through `assetMap` when present.

### `blockingScript(src, options)`

Emits an external script with no `async` or `defer`.

```js
taki.blockingScript("/vendor/app-blocking.js");
```

This blocks parsing. Use it only when the page truly depends on the script
before rendering continues. `src` resolves through `assetMap` when present.

### `inlineStyle(css, options)`

Emits a `<style>` fragment.

```js
taki.inlineStyle(":root { color-scheme: light dark; }", {
  key: "critical-css",
});
```

Use this for small, trusted critical CSS. It is emitted as raw global CSS and is
not scoped, bundled, deduped, or transformed by Astro.

### `stylesheet(href, options)`

Emits `<link rel="stylesheet">`.

```js
taki.stylesheet("/styles/global.css");
```

Stylesheets are render-blocking. Keep scripts that do not need to run before CSS
out of the gap between related stylesheets. Use public or remote URLs directly,
or use `assetMap` when a cache layer already knows the final built CSS URL. For
component-scoped CSS or CSS that Astro should still discover and bundle from an
import, keep it in Astro.

### `preload(href, as, options)`

Emits `<link rel="preload">`.

```js
taki.preload("/fonts/app.woff2", "font", {
  type: "font/woff2",
  crossorigin: true,
});
```

Use this for assets needed soon by the current navigation. Preload has a cost;
do not use it for speculative assets. `href` resolves through `assetMap` when
present.

### `deferScript(src, options)`

Emits an external script with `defer`.

```js
taki.deferScript("/vendor/app-defer.js");
```

Use this for first-party scripts that should download during parsing and execute
after the document is parsed. Use `assetMap` when a cache layer already knows
the final built script URL. For component scripts that Astro should still
discover, bundle, and dedupe from the template, keep them in Astro.

### `prefetch(href, options)`

Emits `<link rel="prefetch">`.

```js
taki.prefetch("/next-page/");
```

Use this for likely future navigations or assets. It should come after current
page critical work. `href` resolves through `assetMap` when present.

### `prerender(href, options)`

Emits `<link rel="prerender">`.

```js
taki.prerender("/next-page/");
```

Use this only when the next navigation is highly likely and the page is safe to
pre-render. `href` resolves through `assetMap` when present.

### `icon(href, options)`

Emits `<link rel="icon">`.

```js
taki.icon("/favicon.svg", { type: "image/svg+xml" });
```

Use this for favicons and app icons. EmDash site identity may also render a
favicon from site settings, so set stable `key` values if you need predictable
dedupe. `href` resolves through `assetMap` when present.

### `manifest(href, options)`

Emits `<link rel="manifest">`.

```js
taki.manifest("/site.webmanifest");
```

Use this for web app manifests and related static app metadata. `href` resolves
through `assetMap` when present.

### `feed(href, options)`

Emits an RSS feed link.

```js
taki.feed("/feed.xml", { title: "RSS" });
```

The helper emits `rel="alternate"` and defaults `type` to
`application/rss+xml`. `href` resolves through `assetMap` when present.

### `linkTag(rel, href, options)`

Emits a generic `<link>` fragment.

```js
taki.linkTag("license", "https://example.com/license");
```

Use this when no dedicated helper exists. For EmDash metadata rels such as
`canonical`, `alternate`, `author`, `license`, `nlweb`, and
`site.standard.document`, prefer the typed `link()` helper instead. `href`
resolves through `assetMap` when present.

### `baseHref(href, options)`

Emits `<base href="...">`.

```js
taki.baseHref("https://example.com/");
```

Use cautiously. Current EmDash core metadata and site identity render before
head fragments, so this cannot affect URLs that EmDash has already emitted.
`href` resolves through `assetMap` when present.

### `meta(name, content, options)`

Adds a typed EmDash `meta` contribution.

```js
taki.meta("robots", "noindex", {
  key: "robots",
  when: { pathPrefix: "/preview" },
});
```

Use this for standard name/content tags such as `robots`, `description`,
`theme-color`, and similar page-level metadata.

### `property(property, content, options)`

Adds a typed EmDash property contribution.

```js
taki.property("og:title", "Example Article", {
  key: "og:title",
  when: { pageType: "article" },
});
```

Use this for Open Graph and other property/content metadata.

### `link(rel, href, options)`

Adds a typed EmDash metadata link contribution.

```js
taki.link("canonical", "https://example.com/articles/example");
taki.link("alternate", "https://example.com/de/articles/example", {
  hreflang: "de",
});
```

Supported rel values are `canonical`, `alternate`, `author`, `license`,
`nlweb`, and `site.standard.document`. EmDash only renders metadata link `href`
values with safe absolute schemes: `http://`, `https://`, or `at://`. `href`
resolves through `assetMap` when present, but metadata links should usually stay
absolute.

This is the metadata helper. For stylesheet, preload, preconnect, prefetch,
prerender, icon, manifest, and feed tags, use the fragment helpers above.

### `jsonLd(id, graph, options)`

Adds a typed EmDash JSON-LD contribution.

```js
taki.jsonLd("organization", {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Example",
  url: "https://example.com",
});
```

Use a stable `id` so the JSON-LD block can be deduped predictably. Static
JSON-LD objects are safely serialized by EmDash. JSON-LD that depends on
server-side data belongs in `taki.resolve()`. Keep it in Astro only when it
depends on template-local data.

### `siteStandardDocument(href, options)`

Adds EmDash's allowlisted `site.standard.document` metadata link.

```js
taki.siteStandardDocument("https://example.com/.well-known/site-standard.json");
```

The URL must use a safe absolute scheme.

### `nlweb(href, options)`

Adds EmDash's allowlisted `nlweb` metadata link.

```js
taki.nlweb("https://example.com/.well-known/nlweb.json");
```

The URL must use a safe absolute scheme.

### `externalScript(src, options)`

Adds a generic external script fragment.

```js
taki.externalScript("https://cdn.example.com/widget.js", { defer: true });
```

Use the specific `asyncScript()`, `blockingScript()`, or `deferScript()` helpers
when the waterfall semantics matter. `src` resolves through `assetMap` when
present. Default placement is `"head"`.

### `inlineScript(code, options)`

Adds an inline script fragment.

```js
taki.inlineScript("window.exampleConfig = { enabled: true };", {
  key: "example-config",
});
```

Use sparingly. Inline scripts in `<head>` can block parsing and interfere with
stylesheet discovery when placed between CSS resources. Default placement is
`"head"`.

### `htmlFragment(html, options)`

Adds a raw HTML fragment.

```js
taki.htmlFragment('<meta name="vendor-verification" content="abc123">', {
  key: "vendor-verification",
});
```

Use this when EmDash has no typed primitive or dedicated helper yet. Raw HTML is
not scanned for `assetMap` replacements. Default placement is `"head"`.

### `cloudflareWebAnalytics(token, options)`

Adds Cloudflare Web Analytics.

```js
taki.cloudflareWebAnalytics("YOUR_TOKEN");
```

Default placement is `body:end`, matching Cloudflare's manual snippet placement
before `</body>`. Options:

- `placement`: `body:end` by default; `"head"` is available but usually not
  needed.
- `src`: override the default beacon URL.
- `spa`: writes Cloudflare's SPA flag into `data-cf-beacon`.
- `attributes`: extra script attributes.

### `cloudflareZaraz(options)`

Adds Cloudflare Zaraz manual loading.

```js
taki.cloudflareZaraz();
```

Default placement is `"head"`, with source `/cdn-cgi/zaraz/i.js`. This is for
sites where Cloudflare's Zaraz auto-inject option is disabled. Cloudflare places
manual Zaraz loading immediately before `</head>`, which matches the late
`<EmDashHead />` slot.

Options:

- `placement`: `"head"` by default; `body:end` is available for custom setups.
- `src`: override `/cdn-cgi/zaraz/i.js`.
- `referrerPolicy`: defaults to `origin`.
- `attributes`: extra script attributes.

### `cloudflareTurnstile(options)`

Adds Cloudflare Turnstile.

```js
taki.cloudflareTurnstile({ render: "explicit", preconnect: true });
```

Default placement is `"head"`, with source
`https://challenges.cloudflare.com/turnstile/v0/api.js`.

Options:

- `render`: `implicit` by default. Use `explicit` to append `?render=explicit`.
- `preconnect`: emits a preconnect to `https://challenges.cloudflare.com`.
- `placement`: `"head"` by default; `body:end` is available for custom setups.
- `attributes`: extra script attributes.

## Matching

Every rule accepts `when` to limit where it applies:

```js
taki.meta("robots", "noindex", {
  when: { pathPrefix: "/preview" },
});

taki.jsonLd("article-extra", graph, {
  when: { pageType: "article", collection: ["posts", "newsletters"] },
});
```

Supported match fields:

- `kind`
- `pageType`
- `collection`
- `locale`
- `path`
- `pathPrefix`

Arrays match any value. Multiple matcher objects also match any object.

## Ordering, Dedupe, and Scope

EmDash renders plugin metadata before site and base metadata. Since EmDash
metadata dedupe is first-wins, `emdash-taki` rules can override defaults when
they use the same metadata key.

Fragment order follows rule order within the fragment group. Metadata and
fragments are separate groups in current EmDash core, so resource-order-sensitive
tags should use the fragment helpers.

Generic response headers, cache tags, redirects, and Cloudflare request
personalization are intentionally out of scope for this package. Use Astro
middleware or Worker code for those surfaces.

## Research Notes

The waterfall is based on Harry Roberts' "Get Your Head Straight" guidance and
`ct.css` diagnostics: the document head is render-critical, async scripts can
still affect CSS discovery, and SEO/social metadata can live later after
critical resource discovery. Astro changes the implementation detail, not the
browser constraint: this package centralizes the head waterfall as EmDash rules
while still using Astro for the layout shell.

References:

- [Get Your Head Straight](https://speakerdeck.com/csswizardry/get-your-head-straight)
- [CSS and Network Performance](https://www.smashingmagazine.com/2021/09/css-head-tag/)
- [ct.css](https://csswizardry.com/ct/)
- [Astro client-side scripts](https://docs.astro.build/en/guides/client-side-scripts/)
- [Astro styling and bundle control](https://docs.astro.build/en/guides/styling/)
- [Cloudflare Zaraz manual loading](https://developers.cloudflare.com/zaraz/advanced/load-zaraz-manually/)
- [Cloudflare Web Analytics setup](https://developers.cloudflare.com/web-analytics/get-started/)

## Package Surface

- ESM entry: `@bnomei/emdash-taki`.
- Type declarations are included from `dist/`.
- Peer dependency: `emdash` `>=0.19.0`.

## Status

This package ships as a native EmDash plugin because trusted page fragments run
as first-party browser code. Structured metadata rules remain compatible with
EmDash's `page:metadata` contribution model.

## License

MIT.
