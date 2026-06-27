import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  asyncScript,
  baseHref,
  blockingScript,
  createPlugin,
  deferScript,
  externalScript,
  feed,
  htmlFragment,
  icon,
  inlineScript,
  inlineStyle,
  isEarlyTakiFragment,
  jsonLd,
  link,
  manifest,
  meta,
  preconnect,
  prefetch,
  preload,
  prerender,
  property,
  renderTaki,
  renderTakiStart,
  resolve,
  resolveTakiContributions,
  siteStandardDocument,
  stylesheet,
  templates,
} from "../dist/index.mjs";
import {
  renderFragments,
  renderPageMetadata,
  resolveFragments,
  resolvePageMetadata,
} from "emdash/page";

const page = {
  kind: "content",
  pageType: "article",
  path: "/docs/guide",
  locale: "en",
  title: "Guide",
  pageTitle: "Guide",
  description: "Default guide description",
  url: "https://example.test/docs/guide",
  siteUrl: "https://example.test",
  content: {
    collection: "docs",
    id: "guide",
  },
};

const ctx = {
  log: {
    warn() {},
  },
};

function primeSiteSettings(settings) {
  const key = Symbol.for("emdash:site-settings");
  const holder = globalThis[key] ?? { version: 0, cached: null, cachedVersion: -1 };
  holder.cached = Promise.resolve(settings);
  holder.cachedVersion = holder.version;
  globalThis[key] = holder;
}

describe("renderer contract", () => {
  test("keeps waterfall helpers in rule order and separates early head fragments", async () => {
    const { fragments } = await resolveTakiContributions(
      [
        preconnect("https://fonts.example", { crossorigin: true }),
        asyncScript("/async.js"),
        blockingScript("/blocking.js"),
        inlineStyle(":root { color-scheme: light; }", { key: "critical-css" }),
        stylesheet("/app.css"),
        preload("/font.woff2", "font", { type: "font/woff2", crossorigin: true }),
        deferScript("/defer.js"),
        prefetch("/next/"),
        prerender("/instant/"),
        icon("/favicon.svg", { type: "image/svg+xml" }),
        manifest("/site.webmanifest"),
        feed("/feed.xml", { title: "Feed" }),
        externalScript("/late.js"),
        inlineScript("window.ready = true;"),
        htmlFragment('<meta name="late-fragment" content="kept">'),
      ],
      page,
    );

    const headFragments = resolveFragments(fragments, "head");
    const earlyHtml = renderFragments(headFragments.filter(isEarlyTakiFragment), "head");
    const lateHtml = renderFragments(
      headFragments.filter((fragment) => !isEarlyTakiFragment(fragment)),
      "head",
    );

    assert.equal(
      earlyHtml,
      [
        '<link rel="preconnect" href="https://fonts.example" crossorigin>',
        '<script src="/async.js" async></script>',
        '<script src="/blocking.js"></script>',
        "<style>:root { color-scheme: light; }</style>",
        '<link rel="stylesheet" href="/app.css">',
        '<link rel="preload" href="/font.woff2" as="font" crossorigin type="font/woff2">',
        '<script src="/defer.js" defer></script>',
        '<link rel="prefetch" href="/next/">',
        '<link rel="prerender" href="/instant/">',
      ].join("\n"),
    );
    assert.equal(
      lateHtml,
      [
        '<link rel="icon" href="/favicon.svg" type="image/svg+xml">',
        '<link rel="manifest" href="/site.webmanifest">',
        '<link rel="alternate" href="/feed.xml" title="Feed" type="application/rss+xml">',
        '<script src="/late.js"></script>',
        "<script>window.ready = true;</script>",
        '<meta name="late-fragment" content="kept">',
      ].join("\n"),
    );
  });

  test("renderTakiStart renders and removes early fragments through the runtime path", async () => {
    const { fragments } = await resolveTakiContributions(
      [stylesheet("/early.css"), icon("/favicon.svg", { type: "image/svg+xml" })],
      page,
    );
    const locals = {
      emdash: {
        collectPageMetadata: async () => [],
        collectPageFragments: async () => fragments,
      },
    };

    assert.equal(await renderTakiStart(page, locals), '<link rel="stylesheet" href="/early.css">');
    assert.deepEqual(fragments, [
      {
        kind: "html",
        placement: "head",
        html: '<link rel="icon" href="/favicon.svg" type="image/svg+xml">',
        key: "link:icon:/favicon.svg",
      },
    ]);
  });

  test("renderTaki renders basics before fallback metadata when no runtime is available", async () => {
    assert.equal(
      await renderTaki(
        {
          ...page,
          canonical: "https://example.test/docs/guide",
          pageTitle: "Guide Page",
        },
        {},
        { basics: true },
      ),
      [
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width">',
        "<title>Guide</title>",
        '<meta name="description" content="Default guide description">',
        '<meta name="twitter:card" content="summary">',
        '<meta name="twitter:title" content="Guide Page">',
        '<meta name="twitter:description" content="Default guide description">',
        '<meta property="og:type" content="article">',
        '<meta property="og:title" content="Guide Page">',
        '<meta property="og:description" content="Default guide description">',
        '<meta property="og:url" content="https://example.test/docs/guide">',
        '<link rel="canonical" href="https://example.test/docs/guide">',
        '<script type="application/ld+json">{"@context":"https://schema.org","@type":"BlogPosting","headline":"Guide Page","description":"Default guide description","url":"https://example.test/docs/guide","mainEntityOfPage":{"@type":"WebPage","@id":"https://example.test/docs/guide"}}</script>',
      ].join("\n"),
    );
  });

  test("renderTaki honours charset:true and viewport:true without basics", async () => {
    const html = await renderTaki(
      { ...page, title: "Example" },
      {},
      { charset: true, viewport: true, title: true },
    );
    const lines = html.split("\n");

    assert.deepEqual(lines.slice(0, 3), [
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width">',
      "<title>Example</title>",
    ]);
  });

  test("renderTaki orders runtime output from basics through late fragments", async () => {
    primeSiteSettings({
      favicon: {
        url: "/favicon.ico",
        contentType: "image/x-icon",
      },
    });
    const runtimePage = {
      ...page,
      canonical: "https://example.test/docs/guide",
      pageTitle: "Runtime Guide",
    };
    const { fragments } = await resolveTakiContributions(
      [stylesheet("/runtime-early.css"), externalScript("/runtime-late.js")],
      runtimePage,
    );
    const html = await renderTaki(
      runtimePage,
      {
        emdash: {
          collectPageMetadata: async () => [meta("description", "runtime description")],
          collectPageFragments: async () => fragments,
        },
      },
      { basics: true },
    );
    const lines = html.split("\n");

    assert.deepEqual(lines.slice(0, 4), [
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width">',
      "<title>Guide</title>",
      '<link rel="stylesheet" href="/runtime-early.css">',
    ]);

    const metadataIndex = lines.indexOf('<meta name="description" content="runtime description">');
    const siteIdentityIndex = lines.indexOf(
      '<link rel="icon" href="/favicon.ico" type="image/x-icon">',
    );
    const lateFragmentIndex = lines.indexOf('<script src="/runtime-late.js"></script>');

    assert.ok(metadataIndex > 3);
    assert.ok(siteIdentityIndex > metadataIndex);
    assert.ok(lateFragmentIndex > siteIdentityIndex);
    assert.equal(lines.at(-1), '<script src="/runtime-late.js"></script>');
  });

  test("lets later matching metadata override fallback rules while ignoring nonmatches", async () => {
    const { metadata } = await resolveTakiContributions(
      [
        meta("description", "site fallback", {
          key: "description",
          when: { pathPrefix: "/" },
        }),
        meta("description", "draft should not win", {
          key: "description",
          when: { collection: "drafts" },
        }),
        meta("description", "docs fallback", {
          key: "description",
          when: { pathPrefix: "/docs/" },
        }),
        property("og:type", "website"),
        property("og:type", "article", {
          when: [{ pageType: "landing" }, { pageType: "article", locale: "en" }],
        }),
        link("canonical", "https://example.test/old"),
        link("canonical", "https://example.test/docs/guide"),
        jsonLd("page", { name: "old" }),
        jsonLd("page", { name: "Guide" }, { when: { kind: "content" } }),
      ],
      page,
    );
    const resolved = resolvePageMetadata(metadata);

    assert.deepEqual(resolved, {
      meta: [{ name: "description", content: "docs fallback" }],
      properties: [{ property: "og:type", content: "article" }],
      links: [{ rel: "canonical", href: "https://example.test/docs/guide" }],
      jsonld: [{ id: "page", json: '{"name":"Guide"}' }],
    });
  });

  test("dedupes fragments and resolves static plus resolver-provided asset maps", async () => {
    const { fragments, metadata } = await resolveTakiContributions(
      [
        stylesheet("src/styles/app.css", { key: "app-style" }),
        stylesheet("src/styles/old.css", { key: "theme-style" }),
        preload("/fonts/main.woff2", "font", { type: "font/woff2" }),
        deferScript("./scripts/app.js"),
        externalScript("/same.js"),
        externalScript("/same.js"),
        link("alternate", "feed.xml", { hreflang: "en" }),
        siteStandardDocument("/.well-known/site.webmanifest"),
        resolve({
          input: { source: "runtime-assets" },
        }),
        stylesheet("src/styles/theme.css", { key: "theme-style" }),
      ],
      page,
      {
        assetMap: {
          "src/styles/app.css": "/_astro/app.initial.css",
        },
        ctx,
        resolve: ({ input }) => {
          assert.deepEqual(input, { source: "runtime-assets" });
          return {
            assetMap: {
              "src/styles/app.css": "/_astro/app.final.css",
              "src/styles/theme.css": "/_astro/theme.final.css",
              "fonts/main.woff2": "/_astro/main.final.woff2",
              "scripts/app.js": "/_astro/app.final.js",
              "/feed.xml": "https://cdn.example.test/feed.xml",
              "/.well-known/site.webmanifest": "https://cdn.example.test/site.webmanifest",
            },
            metadata: [meta("description", "from resolver")],
          };
        },
      },
    );

    assert.deepEqual(resolvePageMetadata(metadata), {
      meta: [{ name: "description", content: "from resolver" }],
      properties: [],
      links: [
        {
          rel: "alternate",
          href: "https://cdn.example.test/feed.xml",
          hreflang: "en",
        },
        {
          rel: "site.standard.document",
          href: "https://cdn.example.test/site.webmanifest",
        },
      ],
      jsonld: [],
    });
    assert.equal(
      renderFragments(fragments, "head"),
      [
        '<link rel="stylesheet" href="/_astro/app.final.css">',
        '<link rel="preload" href="/_astro/main.final.woff2" as="font" type="font/woff2">',
        '<script src="/_astro/app.final.js" defer></script>',
        '<script src="/same.js"></script>',
        '<link rel="stylesheet" href="/_astro/theme.final.css">',
      ].join("\n"),
    );
  });

  test("keeps shorthand template entries that coexist with a reserved runtime key", async () => {
    const plugin = createPlugin(
      { rules: [templates()] },
      {
        article: () => [meta("description", "article template")],
        product: () => [meta("description", "product template")],
        resolve: () => [meta("description", "default resolver")],
      },
    );

    const contributions = await plugin.hooks["page:metadata"].handler({ page }, ctx);
    assert.deepEqual(resolvePageMetadata(contributions), {
      meta: [{ name: "description", content: "article template" }],
      properties: [],
      links: [],
      jsonld: [],
    });
  });

  test("pathPrefix matcher skips rules instead of crashing when page.path is absent", async () => {
    const pathlessPage = { kind: "content", pageType: "page" };
    const { metadata } = await resolveTakiContributions(
      [
        meta("robots", "noindex", { when: { pathPrefix: "/preview" } }),
        meta("description", "always"),
      ],
      pathlessPage,
    );

    assert.deepEqual(resolvePageMetadata(metadata), {
      meta: [{ name: "description", content: "always" }],
      properties: [],
      links: [],
      jsonld: [],
    });
  });

  test("resolves dot-relative paths against slash-prefixed assetMap keys", async () => {
    const assetMap = { "/scripts/app.js": "/_astro/app.hash.js" };
    for (const spelling of ["./scripts/app.js", "scripts/app.js", "/scripts/app.js"]) {
      const { fragments } = await resolveTakiContributions([deferScript(spelling)], page, {
        assetMap,
      });
      assert.equal(
        renderFragments(fragments, "head"),
        '<script src="/_astro/app.hash.js" defer></script>',
        `spelling ${spelling} should resolve to the hashed URL`,
      );
    }
  });

  test("normalizes boolean and numeric script attributes to strings", async () => {
    const { fragments } = await resolveTakiContributions(
      [
        externalScript("/a.js", { attributes: { nomodule: true, hidden: false, "data-n": 3 } }),
        inlineScript("ready()", { attributes: { defer: true } }),
      ],
      page,
    );

    assert.equal(
      renderFragments(fragments, "head"),
      [
        '<script src="/a.js" nomodule="" data-n="3"></script>',
        '<script defer="">ready()</script>',
      ].join("\n"),
    );
  });

  test("drops base and script fragments with dangerous URL schemes", async () => {
    const original = console.warn;
    console.warn = () => {};
    try {
      const dangerous = [
        baseHref("javascript:alert(1)"),
        baseHref("  javascript:alert(1)"),
        baseHref("java\tscript:alert(1)"),
        externalScript("javascript:alert(1)"),
        externalScript("data:text/javascript,alert(1)"),
      ];
      for (const rule of dangerous) {
        const { fragments } = await resolveTakiContributions([rule], page);
        assert.equal(renderFragments(fragments, "head"), "");
      }

      const remapped = await resolveTakiContributions([baseHref("/")], page, {
        assetMap: { "/": "javascript:alert(1)" },
      });
      assert.equal(renderFragments(remapped.fragments, "head"), "");
    } finally {
      console.warn = original;
    }
  });

  test("keeps base and script fragments with safe URL schemes", async () => {
    const { fragments } = await resolveTakiContributions(
      [
        baseHref("/app/"),
        externalScript("https://cdn.example/app.js"),
        externalScript("//cdn.example/x.js"),
      ],
      page,
    );

    assert.equal(
      renderFragments(fragments, "head"),
      [
        '<base href="/app/">',
        '<script src="https://cdn.example/app.js"></script>',
        '<script src="//cdn.example/x.js"></script>',
      ].join("\n"),
    );
  });

  test("honours a present empty-string assetMap mapping over fuzzy candidates", async () => {
    const { fragments } = await resolveTakiContributions([externalScript("foo.js")], page, {
      assetMap: {
        "foo.js": "",
        "/foo.js": "https://cdn.example/REAL.js",
      },
    });

    assert.equal(renderFragments(fragments, "head"), '<script src=""></script>');
  });

  test("collapses fragments whose distinct source paths resolve to one assetMap URL", async () => {
    const { fragments } = await resolveTakiContributions(
      [deferScript("src/vendor.js"), deferScript("src/app.js")],
      page,
      {
        assetMap: {
          "src/vendor.js": "/_astro/bundle.js",
          "src/app.js": "/_astro/bundle.js",
        },
      },
    );

    assert.equal(
      renderFragments(fragments, "head"),
      '<script src="/_astro/bundle.js" defer></script>',
    );
  });

  test("warns via console when a resolver rule runs without ctx", async () => {
    const original = console.warn;
    const warnings = [];
    console.warn = (...args) => warnings.push(args);
    let result;
    try {
      result = await resolveTakiContributions([resolve({ input: { source: "test" } })], page, {
        resolve: () => [meta("description", "from resolver")],
      });
    } finally {
      console.warn = original;
    }

    assert.deepEqual(result.metadata, []);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0][1].error, /requires a plugin "ctx"/);
  });

  test("throws a ctx-specific error when a missing-ctx resolver opts into onError throw", async () => {
    await assert.rejects(
      () =>
        resolveTakiContributions([resolve({ onError: "throw" })], page, {
          resolve: () => [meta("description", "x")],
        }),
      /requires a plugin "ctx" but none was provided/,
    );
  });

  test("evicts rejected resolver promises so the same page object can retry", async () => {
    let attempt = 0;
    const plugin = createPlugin(
      { rules: [resolve({ onError: "throw" })] },
      {
        resolve: () => {
          attempt += 1;
          if (attempt === 1) throw new Error("transient");
          return [meta("ok", "recovered")];
        },
      },
    );

    const retryPage = { kind: "content", pageType: "page", path: "/retry" };
    await assert.rejects(() => plugin.hooks["page:metadata"].handler({ page: retryPage }, ctx));
    const metadata = await plugin.hooks["page:metadata"].handler({ page: retryPage }, ctx);

    assert.equal(attempt, 2);
    assert.deepEqual(resolvePageMetadata(metadata), {
      meta: [{ name: "ok", content: "recovered" }],
      properties: [],
      links: [],
      jsonld: [],
    });
  });

  test("metadata-only resolvers are not blocked by invalid fragment output", async () => {
    const plugin = createPlugin(
      { rules: [resolve()] },
      {
        resolve: () => [
          meta("description", "ok"),
          {
            kind: "external-script",
            placement: "head",
            src: "/x.js",
            attributes: { "bad name": "x" },
          },
        ],
      },
    );

    assert.equal(plugin.hooks["page:fragments"], undefined);
    const metadata = await plugin.hooks["page:metadata"].handler({ page }, ctx);
    assert.deepEqual(resolvePageMetadata(metadata), {
      meta: [{ name: "description", content: "ok" }],
      properties: [],
      links: [],
      jsonld: [],
    });
  });

  test("registers fragment hooks only when dynamic handlers opt into fragments", async () => {
    const metadataOnlyPlugin = createPlugin(
      {
        rules: [templates()],
      },
      {
        templates: {
          article: () => [meta("description", "metadata only")],
        },
      },
    );
    const fragmentPlugin = createPlugin(
      {
        rules: [templates({ fragments: true })],
      },
      {
        templates: {
          article: () => [
            meta("description", "from template"),
            htmlFragment('<meta name="template-fragment" content="yes">'),
          ],
        },
      },
    );

    assert.equal(metadataOnlyPlugin.capabilities.includes("hooks.page-fragments:register"), false);
    assert.equal(metadataOnlyPlugin.hooks["page:fragments"], undefined);
    assert.equal(fragmentPlugin.capabilities.includes("hooks.page-fragments:register"), true);
    assert.equal(typeof fragmentPlugin.hooks["page:fragments"].handler, "function");
    assert.deepEqual(await fragmentPlugin.hooks["page:metadata"].handler({ page }, ctx), [
      { kind: "meta", name: "description", content: "from template", key: undefined },
    ]);
    const [fragment] = await fragmentPlugin.hooks["page:fragments"].handler({ page }, ctx);
    assert.deepEqual(
      {
        kind: fragment.kind,
        placement: fragment.placement,
        html: fragment.html,
      },
      {
        kind: "html",
        placement: "head",
        html: '<meta name="template-fragment" content="yes">',
      },
    );
    assert.match(fragment.key, /^html:/);
  });

  test("escapes generated fragments and metadata while preserving raw html fragments", async () => {
    const { fragments, metadata } = await resolveTakiContributions(
      [
        meta('unsafe"name', 'Fish & <chips> "quoted"'),
        link("alternate", "https://example.test/feed?x=1&y=<tag>", { hreflang: "en" }),
        jsonLd("unsafe", {
          text: "</script><!-- comment -->",
        }),
        stylesheet("/style.css", {
          attributes: {
            integrity: 'sha256-"x"&<y>',
            disabled: false,
          },
        }),
        baseHref('https://example.test/base?x="quote"&next=<next>'),
        inlineStyle("</style><script>alert(1)</script>", {
          attributes: {
            nonce: 'n"o&<p>',
          },
        }),
        externalScript("/app.js", {
          attributes: {
            nonce: 'n"o&<p>',
            onload: "alert(1)",
          },
        }),
        inlineScript('window.msg = "</script><img>";', {
          attributes: {
            nonce: 'n"o&<p>',
            onclick: "alert(1)",
          },
        }),
        htmlFragment('<meta data-raw="raw & unescaped">'),
      ],
      page,
    );

    assert.equal(
      renderPageMetadata(resolvePageMetadata(metadata)),
      [
        '<meta name="unsafe&quot;name" content="Fish &amp; &lt;chips&gt; &quot;quoted&quot;">',
        '<link rel="alternate" href="https://example.test/feed?x=1&amp;y=&lt;tag&gt;" hreflang="en">',
        '<script type="application/ld+json">{"text":"\\u003c/script\\u003e\\u003c!-- comment --\\u003e"}</script>',
      ].join("\n"),
    );
    assert.equal(
      renderFragments(fragments, "head"),
      [
        '<link integrity="sha256-&quot;x&quot;&amp;&lt;y&gt;" rel="stylesheet" href="/style.css">',
        '<base href="https://example.test/base?x=&quot;quote&quot;&amp;next=&lt;next&gt;">',
        '<style nonce="n&quot;o&amp;&lt;p&gt;"><\\/style><script>alert(1)</script></style>',
        '<script src="/app.js" nonce="n&quot;o&amp;&lt;p&gt;"></script>',
        '<script nonce="n&quot;o&amp;&lt;p&gt;">window.msg = "<\\/script><img>";</script>',
        '<meta data-raw="raw & unescaped">',
      ].join("\n"),
    );
  });
});
