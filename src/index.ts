import {
  definePlugin,
  type PageFragmentContribution,
  type PageMetadataContribution,
  type PluginCapability,
  type PluginDescriptor,
} from "emdash";
import type {
  TakiAssetMap,
  TakiBaseHrefRule,
  CloudflareTurnstileRule,
  CloudflareWebAnalyticsRule,
  CloudflareZarazRule,
  TakiCloudflareRule,
  TakiCreatePluginOptions,
  TakiAttributes,
  TakiDescriptorOptions,
  TakiEmDashRule,
  TakiFragmentRule,
  TakiHtmlHelperOptions,
  TakiInlineStyleRule,
  TakiJsonValue,
  TakiLinkTagRule,
  TakiLinkTagOptions,
  TakiMatcher,
  TakiMetadataLinkRel,
  TakiMetadataRule,
  TakiPageContext,
  TakiPlacement,
  TakiRenderPhase,
  TakiResolverResult,
  TakiResolverRule,
  TakiResolver,
  TakiTemplateInput,
  TakiTemplateModule,
  TakiTemplateModuleMap,
  TakiTemplateResolver,
  TakiTemplateResolverMap,
  TakiTemplatesOptions,
  TakiRuntimeConfig,
  TakiRuntimeInput,
  TakiRuntimeOptions,
  TakiResolveOptions,
  TakiRenderOptions,
  TakiRule,
  TakiStaticRule,
} from "./types";

export type {
  TakiAssetMap,
  TakiBaseHrefRule,
  CloudflareTurnstileRule,
  CloudflareWebAnalyticsRule,
  CloudflareZarazRule,
  TakiAttributes,
  TakiAttributeValue,
  TakiCloudflareRule,
  TakiCreatePluginOptions,
  TakiDescriptorOptions,
  TakiEmDashRule,
  TakiFragmentRule,
  TakiHtmlHelperOptions,
  TakiInlineStyleRule,
  TakiJsonValue,
  TakiLinkTagRule,
  TakiLinkTagOptions,
  TakiMatcher,
  TakiMetadataLinkRel,
  TakiMetadataRule,
  TakiPageContext,
  TakiPlacement,
  TakiRenderPhase,
  TakiResolver,
  TakiResolverContext,
  TakiResolverErrorMode,
  TakiResolverMap,
  TakiResolverResult,
  TakiResolverRule,
  TakiTemplateInput,
  TakiTemplateModule,
  TakiTemplateModuleMap,
  TakiTemplateResolver,
  TakiTemplateResolverContext,
  TakiTemplateResolverMap,
  TakiTemplatesOptions,
  TakiRuntimeConfig,
  TakiRuntimeInput,
  TakiRuntimeOptions,
  TakiResolveOptions,
  TakiRenderOptions,
  TakiRule,
  TakiStaticRule,
  TakiWaterfallRule,
  ResolvedTakiContributions,
} from "./types";

const PLUGIN_ID = "taki";
const PLUGIN_VERSION = "0.1.1";
const PACKAGE_NAME = "@bnomei/emdash-taki";
const DEFAULT_RESOLVER = "default";
const TEMPLATE_RESOLVER = "templates";
const EARLY_TAKI_FRAGMENT_KEY_PREFIX = "emdash-taki:early:";
const PAGE_FRAGMENTS_CAPABILITY = "hooks.page-fragments:register";
const CLOUDFLARE_WEB_ANALYTICS_SRC = "https://static.cloudflareinsights.com/beacon.min.js";
const CLOUDFLARE_ZARAZ_SRC = "/cdn-cgi/zaraz/i.js";
const CLOUDFLARE_TURNSTILE_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";
const HTTP_URL_RE = /^https?:\/\//i;
const DATA_IMAGE_RE = /^data:image\//i;
const OTHER_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;
const FORBIDDEN_HTML_ATTRIBUTE_NAME_CHARS = `"'>/=`;

type ExternalScriptRule = Extract<TakiFragmentRule, { kind: "external-script" }>;
type InlineScriptRule = Extract<TakiFragmentRule, { kind: "inline-script" }>;
type HtmlFragmentRule = Extract<TakiFragmentRule, { kind: "html" }>;
type ExternalScriptHelperOptions = Omit<ExternalScriptRule, "kind" | "src" | "placement"> & {
  placement?: TakiPlacement;
};
type InlineScriptHelperOptions = Omit<InlineScriptRule, "kind" | "code" | "placement"> & {
  placement?: TakiPlacement;
};
type HtmlFragmentHelperOptions = Omit<HtmlFragmentRule, "kind" | "html" | "placement"> & {
  placement?: TakiPlacement;
};
type ScriptHelperOptions = Omit<
  ExternalScriptRule,
  "kind" | "src" | "placement" | "async" | "defer"
> & {
  placement?: TakiPlacement;
};

export function takiPlugin(
  options: TakiDescriptorOptions = {},
): PluginDescriptor<TakiCreatePluginOptions> {
  const entrypoint = options.runtime ?? PACKAGE_NAME;
  const createOptions = createPluginOptions(options);
  const capabilities = uniqueCapabilities([
    ...(createOptions.capabilities ?? []),
    ...fragmentCapabilities(createOptions.rules ?? []),
  ]);

  return {
    id: PLUGIN_ID,
    version: PLUGIN_VERSION,
    format: "native",
    entrypoint,
    capabilities,
    options: createOptions,
  };
}

export function createPlugin(
  options: TakiCreatePluginOptions = {},
  runtimeInput: TakiRuntimeInput = {},
) {
  const runtimeOptions = normalizeRuntimeInput(runtimeInput);
  const rules = options.rules ?? [];
  const fragmentHookCapabilities = fragmentCapabilities(rules);
  const capabilities = uniqueCapabilities([
    ...(options.capabilities ?? []),
    ...fragmentHookCapabilities,
  ]);
  const pageCache = new WeakMap<
    TakiPageContext,
    Promise<Awaited<ReturnType<typeof resolveTakiContributions>>>
  >();

  const resolveForPage = (page: TakiPageContext, ctx: NonNullable<TakiResolveOptions["ctx"]>) => {
    const cached = pageCache.get(page);
    if (cached) return cached;

    const promise = resolveTakiContributions(rules, page, {
      assetMap: options.assetMap,
      ctx,
      resolve: runtimeOptions.resolve,
      resolvers: runtimeOptions.resolvers,
      templates: runtimeOptions.templates,
    });
    pageCache.set(page, promise);
    return promise;
  };

  return definePlugin({
    id: PLUGIN_ID,
    version: PLUGIN_VERSION,
    allowedHosts: options.allowedHosts,
    capabilities,
    hooks: {
      "page:metadata": {
        priority: options.priority ?? 40,
        handler: async (event, ctx) => (await resolveForPage(event.page, ctx)).metadata,
      },
      ...(fragmentHookCapabilities.length
        ? {
            "page:fragments": {
              priority: options.priority ?? 40,
              handler: async (event, ctx) => (await resolveForPage(event.page, ctx)).fragments,
            },
          }
        : {}),
    },
  });
}

export function defineTakiRuntime(runtimeInput: TakiRuntimeInput = {}) {
  const runtimeOptions = normalizeRuntimeInput(runtimeInput);

  return (options: TakiCreatePluginOptions = {}) => createPlugin(options, runtimeOptions);
}

export function meta(
  name: string,
  content: string,
  options: Omit<TakiMetadataRule & { kind: "meta" }, "kind" | "name" | "content"> = {},
): TakiMetadataRule {
  return { kind: "meta", name, content, ...options };
}

export function property(
  propertyName: string,
  content: string,
  options: Omit<TakiMetadataRule & { kind: "property" }, "kind" | "property" | "content"> = {},
): TakiMetadataRule {
  return { kind: "property", property: propertyName, content, ...options };
}

export function link(
  rel: TakiMetadataLinkRel,
  href: string,
  options: Omit<TakiMetadataRule & { kind: "link" }, "kind" | "rel" | "href"> = {},
): TakiMetadataRule {
  return { kind: "link", rel, href, ...options };
}

export function jsonLd(
  id: string,
  graph: Record<string, unknown> | Array<Record<string, unknown>>,
  options: Omit<TakiMetadataRule & { kind: "jsonld" }, "kind" | "id" | "graph"> = {},
): TakiMetadataRule {
  return { kind: "jsonld", id, graph, ...options };
}

export function siteStandardDocument(
  href: string,
  options: Omit<TakiEmDashRule & { kind: "emdash:site-standard-document" }, "kind" | "href"> = {},
): TakiEmDashRule {
  return { kind: "emdash:site-standard-document", href, ...options };
}

export function nlweb(
  href: string,
  options: Omit<TakiEmDashRule & { kind: "emdash:nlweb" }, "kind" | "href"> = {},
): TakiEmDashRule {
  return { kind: "emdash:nlweb", href, ...options };
}

export function externalScript(
  src: string,
  options: ExternalScriptHelperOptions = {},
): TakiFragmentRule {
  const { placement = "head", ...rest } = options;
  return { kind: "external-script", placement, src, ...rest };
}

export function asyncScript(src: string, options: ScriptHelperOptions = {}): TakiFragmentRule {
  return {
    kind: "external-script",
    placement: options.placement ?? "head",
    phase: "early",
    src,
    ...options,
    async: true,
  };
}

export function blockingScript(src: string, options: ScriptHelperOptions = {}): TakiFragmentRule {
  return {
    kind: "external-script",
    placement: options.placement ?? "head",
    phase: "early",
    src,
    ...options,
  };
}

export function deferScript(src: string, options: ScriptHelperOptions = {}): TakiFragmentRule {
  return {
    kind: "external-script",
    placement: options.placement ?? "head",
    phase: "early",
    src,
    ...options,
    defer: true,
  };
}

export function inlineScript(
  code: string,
  options: InlineScriptHelperOptions = {},
): TakiFragmentRule {
  const { placement = "head", ...rest } = options;
  return { kind: "inline-script", placement, code, ...rest };
}

export function htmlFragment(
  html: string,
  options: HtmlFragmentHelperOptions = {},
): TakiFragmentRule {
  const { placement = "head", ...rest } = options;
  return { kind: "html", placement, html, ...rest };
}

export function baseHref(href: string, options: TakiHtmlHelperOptions = {}): TakiBaseHrefRule {
  return { kind: "base", phase: "early", href, ...options };
}

export function linkTag(
  rel: string,
  href: string,
  options: TakiLinkTagOptions = {},
): TakiLinkTagRule {
  return htmlLink(rel, href, options);
}

export function preconnect(href: string, options: TakiLinkTagOptions = {}): TakiLinkTagRule {
  return htmlLink("preconnect", href, { phase: "early", ...options });
}

export function dnsPrefetch(href: string, options: TakiLinkTagOptions = {}): TakiLinkTagRule {
  return htmlLink("dns-prefetch", href, { phase: "early", ...options });
}

export function stylesheet(href: string, options: TakiLinkTagOptions = {}): TakiLinkTagRule {
  return htmlLink("stylesheet", href, { phase: "early", ...options });
}

export function preload(
  href: string,
  as: string,
  options: TakiLinkTagOptions = {},
): TakiLinkTagRule {
  return htmlLink("preload", href, { phase: "early", ...options, as });
}

export function prefetch(href: string, options: TakiLinkTagOptions = {}): TakiLinkTagRule {
  return htmlLink("prefetch", href, { phase: "early", ...options });
}

export function prerender(href: string, options: TakiLinkTagOptions = {}): TakiLinkTagRule {
  return htmlLink("prerender", href, { phase: "early", ...options });
}

export function icon(href: string, options: TakiLinkTagOptions = {}): TakiLinkTagRule {
  return htmlLink("icon", href, options);
}

export function manifest(href: string, options: TakiLinkTagOptions = {}): TakiLinkTagRule {
  return htmlLink("manifest", href, options);
}

export function feed(href: string, options: TakiLinkTagOptions = {}): TakiLinkTagRule {
  return htmlLink("alternate", href, {
    type: "application/rss+xml",
    title: "RSS",
    ...options,
  });
}

export function inlineStyle(css: string, options: TakiHtmlHelperOptions = {}): TakiInlineStyleRule {
  return { kind: "inline-style", phase: "early", css, ...options };
}

export function cloudflareWebAnalytics(
  token: string,
  options: Omit<CloudflareWebAnalyticsRule, "kind" | "token"> = {},
): CloudflareWebAnalyticsRule {
  return { kind: "cloudflare:web-analytics", token, ...options };
}

export function cloudflareZaraz(
  options: Omit<CloudflareZarazRule, "kind"> = {},
): CloudflareZarazRule {
  return { kind: "cloudflare:zaraz", ...options };
}

export function cloudflareTurnstile(
  options: Omit<CloudflareTurnstileRule, "kind"> = {},
): CloudflareTurnstileRule {
  return { kind: "cloudflare:turnstile", ...options };
}

export function template(
  name: string,
  options: TakiTemplatesOptions = {},
): TakiResolverRule<TakiTemplateInput> {
  return templates({
    ...options,
    input: { ...options.input, template: name },
    when: options.when ?? { pageType: name },
  });
}

export function templates(options: TakiTemplatesOptions = {}): TakiResolverRule<TakiTemplateInput> {
  return {
    kind: "resolve",
    resolver: TEMPLATE_RESOLVER,
    ...options,
  };
}

type ResolverRuleOptions<TInput extends TakiJsonValue = TakiJsonValue> = Omit<
  TakiResolverRule<TInput>,
  "kind" | "resolver"
>;

export function resolve<TInput extends TakiJsonValue = TakiJsonValue>(
  options?: ResolverRuleOptions<TInput>,
): TakiResolverRule<TInput>;

export function resolve<TInput extends TakiJsonValue = TakiJsonValue>(
  resolver: string,
  options?: ResolverRuleOptions<TInput>,
): TakiResolverRule<TInput>;

export function resolve<TInput extends TakiJsonValue = TakiJsonValue>(
  resolverOrOptions?: string | ResolverRuleOptions<TInput>,
  options: ResolverRuleOptions<TInput> = {},
): TakiResolverRule<TInput> {
  if (typeof resolverOrOptions === "string") {
    return { kind: "resolve", resolver: resolverOrOptions, ...options };
  }

  return {
    kind: "resolve",
    resolver: DEFAULT_RESOLVER,
    ...resolverOrOptions,
  };
}

export async function resolveTakiContributions(
  rules: TakiRule[],
  page: TakiPageContext,
  options: TakiResolveOptions = {},
) {
  const resolved = await resolveRules(rules, page, options);

  return {
    metadata: dedupeMetadataLastWins(collectMetadata(resolved.rules, page, resolved.assetMap)),
    fragments: dedupeFragmentsLastWins(collectFragments(resolved.rules, page, resolved.assetMap)),
  };
}

export function isEarlyTakiFragment(contribution: PageFragmentContribution): boolean {
  return (
    contribution.placement === "head" &&
    typeof contribution.key === "string" &&
    contribution.key.startsWith(EARLY_TAKI_FRAGMENT_KEY_PREFIX)
  );
}

export async function renderTakiStart(
  page: TakiPageContext,
  locals: Record<string, unknown>,
): Promise<string> {
  const pageApi = await import("emdash/page");
  const runtime = pageApi.getPageRuntime(locals);
  if (!runtime) return "";

  const fragments = await runtime.collectPageFragments(page);
  const earlyFragments = pageApi.resolveFragments(fragments.filter(isEarlyTakiFragment), "head");
  removeEarlyTakiFragments(fragments);

  return pageApi.renderFragments(earlyFragments, "head");
}

export async function renderTaki(
  page: TakiPageContext,
  locals: Record<string, unknown>,
  options: TakiRenderOptions = {},
): Promise<string> {
  const [emdash, pageApi] = await Promise.all([import("emdash"), import("emdash/page")]);
  const runtime = pageApi.getPageRuntime(locals);
  const basicsHtml = renderTakiBasics(options, page);

  if (!runtime) {
    const resolved = pageApi.resolvePageMetadata(pageApi.generateBaseSeoContributions(page));
    return joinTakiHtml([basicsHtml, pageApi.renderPageMetadata(resolved)]);
  }

  const [siteSettings, pluginContributions, fragments] = await Promise.all([
    emdash.getSiteSettings(),
    runtime.collectPageMetadata(page),
    runtime.collectPageFragments(page),
  ]);

  const defaultOgImage = absolutizeMediaUrl(
    siteSettings.seo?.defaultOgImage?.url,
    siteSettings.url,
    page,
  );
  const baseContributions = pageApi.generateBaseSeoContributions(page, defaultOgImage);
  const siteContributions = pageApi.generateSiteSeoContributions(siteSettings.seo);
  const resolved = pageApi.resolvePageMetadata([
    ...pluginContributions,
    ...siteContributions,
    ...baseContributions,
  ]);

  const headFragments = pageApi.resolveFragments(fragments, "head");
  const earlyFragments = headFragments.filter(isEarlyTakiFragment);
  const lateFragments = headFragments.filter((fragment) => !isEarlyTakiFragment(fragment));

  return joinTakiHtml([
    basicsHtml,
    pageApi.renderFragments(earlyFragments, "head"),
    pageApi.renderPageMetadata(resolved),
    renderSiteIdentity(siteSettings),
    pageApi.renderFragments(lateFragments, "head"),
  ]);
}

export default takiPlugin;

function createPluginOptions(options: TakiDescriptorOptions): TakiCreatePluginOptions {
  const rules = createRules(options);

  return {
    ...(options.allowedHosts ? { allowedHosts: options.allowedHosts } : {}),
    ...(options.assetMap ? { assetMap: options.assetMap } : {}),
    ...(options.capabilities ? { capabilities: options.capabilities } : {}),
    ...(options.priority !== undefined ? { priority: options.priority } : {}),
    ...(rules.length ? { rules } : {}),
  };
}

function createRules(options: TakiDescriptorOptions): TakiRule[] {
  const rules = [...(options.rules ?? [])];

  if (shouldAutoRegisterTemplates(options, rules)) {
    const templateOptions = isRecord(options.templates) ? options.templates : {};
    rules.push(templates(templateOptions));
  }

  return rules;
}

function shouldAutoRegisterTemplates(options: TakiDescriptorOptions, rules: TakiRule[]): boolean {
  if (!options.runtime) return false;
  if (options.templates === false) return false;
  return !rules.some(isTemplateResolverRule);
}

function normalizeRuntimeInput(runtimeInput: TakiRuntimeInput): TakiRuntimeOptions {
  if (typeof runtimeInput === "function") {
    return { resolve: runtimeInput };
  }

  if (isRuntimeConfig(runtimeInput)) {
    return {
      resolve: runtimeInput.resolve,
      resolvers: runtimeInput.resolvers,
      templates: runtimeInput.templates
        ? normalizeTemplateModules(runtimeInput.templates)
        : undefined,
    };
  }

  return { templates: normalizeTemplateModules(runtimeInput) };
}

function isRuntimeConfig(input: TakiRuntimeInput): input is TakiRuntimeConfig {
  return isRecord(input) && ("resolve" in input || "resolvers" in input || "templates" in input);
}

function normalizeTemplateModules(
  modules: TakiTemplateModuleMap | TakiTemplateResolverMap,
): TakiTemplateResolverMap {
  const resolvers: TakiTemplateResolverMap = {};

  for (const [path, module] of Object.entries(modules)) {
    const templateName = templateNameFromPath(path);
    const resolver = resolveTemplateModule(templateName, module);
    if (resolver) resolvers[templateName] = resolver;
  }

  return resolvers;
}

function resolveTemplateModule(
  templateName: string,
  module: TakiTemplateModule,
): TakiTemplateResolver | undefined {
  if (typeof module === "function") return module;
  if (!isRecord(module)) return undefined;

  const exportNames = templateExportNames(templateName);
  for (const exportName of exportNames) {
    const exported = module[exportName];
    if (typeof exported === "function") return exported as TakiTemplateResolver;
  }

  const functionExports = Object.values(module).filter(
    (exported): exported is TakiTemplateResolver => typeof exported === "function",
  );

  if (functionExports.length === 1) return functionExports[0];

  return undefined;
}

function templateExportNames(templateName: string): string[] {
  const identifier = templateIdentifier(templateName);
  return uniqueStrings([
    "default",
    "taki",
    templateName,
    `${templateName}Taki`,
    identifier,
    `${identifier}Taki`,
  ]);
}

function templateIdentifier(templateName: string): string {
  return templateName
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part, index) =>
      index === 0
        ? part.charAt(0).toLowerCase() + part.slice(1)
        : part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join("");
}

function templateNameFromPath(path: string): string {
  const fileName = path.split(/[\\/]/).pop() ?? path;
  return fileName.replace(/\.[cm]?[jt]sx?$/i, "").replace(/\.(head|template)$/i, "");
}

async function resolveRules(
  rules: TakiRule[],
  page: TakiPageContext,
  options: TakiResolveOptions,
): Promise<{ assetMap?: TakiAssetMap; rules: TakiStaticRule[] }> {
  const resolvedRules: TakiStaticRule[] = [];
  let assetMap = options.assetMap ? { ...options.assetMap } : undefined;

  for (const rule of rules) {
    if (!isResolverRule(rule)) {
      resolvedRules.push(rule);
      continue;
    }

    if (!matchesPage(rule.when, page)) continue;

    const resolver = getResolver(rule.resolver, options);
    if (!resolver || !options.ctx) {
      const error = new Error(`Taki resolver "${rule.resolver}" is not registered`);
      handleResolverError(rule, error, options);
      continue;
    }

    try {
      const result = await resolver({
        ctx: options.ctx,
        input: rule.input,
        page,
        rule,
      });
      const normalized = normalizeResolverResult(result);
      resolvedRules.push(...normalized.rules);
      if (normalized.assetMap) {
        assetMap = { ...assetMap, ...normalized.assetMap };
      }
    } catch (error) {
      handleResolverError(rule, error, options);
    }
  }

  return { assetMap, rules: resolvedRules };
}

function getResolver(resolverName: string, options: TakiResolveOptions): TakiResolver | undefined {
  if (resolverName === TEMPLATE_RESOLVER) {
    return createTemplateDispatcher(options.templates);
  }

  return (
    options.resolvers?.[resolverName] ??
    (resolverName === DEFAULT_RESOLVER ? options.resolve : undefined)
  );
}

function createTemplateDispatcher(
  templateResolvers: TakiTemplateResolverMap | undefined,
): TakiResolver {
  return async (context) => {
    const templateName = templateNameFromContext(context);
    if (!templateName) return null;

    const resolver =
      templateResolvers?.[templateName] ?? templateResolvers?.[templateNameFromPath(templateName)];
    if (!resolver) return null;

    return resolver({
      ...context,
      input: isRecord(context.input) ? (context.input as TakiTemplateInput) : undefined,
      rule: context.rule as TakiResolverRule<TakiTemplateInput>,
      template: templateName,
    });
  };
}

function templateNameFromContext(context: Parameters<TakiResolver>[0]) {
  if (isRecord(context.input) && typeof context.input.template === "string") {
    return context.input.template;
  }

  return context.page.pageType;
}

function normalizeResolverResult(result: TakiResolverResult): {
  assetMap?: TakiAssetMap;
  rules: TakiStaticRule[];
} {
  if (!result) return { rules: [] };

  if (Array.isArray(result)) {
    return { rules: result.filter(isStaticRule) };
  }

  return {
    assetMap: result.assetMap,
    rules: [
      ...(result.rules ?? []),
      ...(result.metadata ?? []),
      ...(result.fragments ?? []),
    ].filter(isStaticRule),
  };
}

function handleResolverError(
  rule: TakiResolverRule,
  error: unknown,
  options: TakiResolveOptions,
): void {
  if (rule.onError === "throw") {
    throw error;
  }

  options.ctx?.log.warn(`Taki resolver "${rule.resolver}" failed`, {
    error: error instanceof Error ? error.message : String(error),
  });
}

function renderTakiBasics(options: TakiRenderOptions, page: TakiPageContext): string {
  const basics = options.basics ?? false;
  const charset = optionValue(options.charset, basics ? "utf-8" : null);
  const viewport = optionValue(options.viewport, basics ? "width=device-width" : null);
  const title = titleValue(options.title, page, basics);
  const parts: string[] = [];

  if (charset) {
    parts.push(`<meta charset="${escapeHtmlAttr(charset)}">`);
  }

  if (viewport) {
    parts.push(`<meta name="viewport" content="${escapeHtmlAttr(viewport)}">`);
  }

  if (title) {
    parts.push(`<title>${escapeHtmlText(title)}</title>`);
  }

  return parts.join("\n");
}

function optionValue(value: boolean | string | undefined, fallback: string | null): string | null {
  if (value === false) return null;
  if (value === true) return fallback;
  if (typeof value === "string") return value;
  return fallback;
}

function titleValue(
  value: boolean | string | undefined,
  page: TakiPageContext,
  basics: boolean,
): string | null {
  if (value === false) return null;
  if (typeof value === "string") return value;
  if (value === true || basics) return page.title ?? page.pageTitle ?? null;
  return null;
}

function renderSiteIdentity(settings: {
  favicon?: { contentType?: string | null; url?: string | null };
}): string {
  const favicon = settings.favicon;
  if (!favicon?.url) return "";

  let tag = `<link rel="icon" href="${escapeHtmlAttr(favicon.url)}"`;
  if (favicon.contentType) {
    tag += ` type="${escapeHtmlAttr(favicon.contentType)}"`;
  }
  tag += ">";
  return tag;
}

function joinTakiHtml(parts: string[]): string {
  return parts.filter(Boolean).join("\n");
}

function removeEarlyTakiFragments(fragments: PageFragmentContribution[]): void {
  for (let index = fragments.length - 1; index >= 0; index -= 1) {
    if (isEarlyTakiFragment(fragments[index])) fragments.splice(index, 1);
  }
}

function dedupeMetadataLastWins(metadata: PageMetadataContribution[]): PageMetadataContribution[] {
  return dedupeLastWins(metadata, metadataDedupeKey);
}

function dedupeFragmentsLastWins(
  fragments: PageFragmentContribution[],
): PageFragmentContribution[] {
  return dedupeLastWins(fragments, fragmentDedupeKey);
}

function dedupeLastWins<T>(items: T[], keyFor: (item: T) => string | undefined): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (!item) continue;

    const key = keyFor(item);
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
    }

    result.push(item);
  }

  return result.reverse();
}

function metadataDedupeKey(contribution: PageMetadataContribution): string | undefined {
  if (contribution.kind === "meta") {
    return `meta:${contribution.key ?? contribution.name}`;
  }

  if (contribution.kind === "property") {
    return `property:${contribution.key ?? contribution.property}`;
  }

  if (contribution.kind === "link") {
    if (contribution.rel === "canonical") return "link:canonical";
    return `link:${contribution.rel}:${contribution.key ?? contribution.hreflang ?? contribution.href}`;
  }

  if (contribution.id) {
    return `jsonld:${contribution.id}`;
  }

  return undefined;
}

function fragmentDedupeKey(contribution: PageFragmentContribution): string | undefined {
  if (contribution.key) {
    return `fragment:${contribution.placement}:key:${contribution.key}`;
  }

  if (contribution.kind === "external-script") {
    return `fragment:${contribution.placement}:src:${contribution.src}`;
  }

  return undefined;
}

function uniqueCapabilities(capabilities: PluginCapability[]): PluginCapability[] {
  return Array.from(new Set(capabilities));
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function htmlLink(rel: string, href: string, options: TakiLinkTagOptions): TakiLinkTagRule {
  return { kind: "link-tag", rel, href, ...options };
}

function renderVoidElement(name: string, attributes: TakiAttributes): string {
  return `<${name}${renderAttributes(attributes)}>`;
}

function renderElement(
  name: string,
  attributes: TakiAttributes | undefined,
  content: string,
): string {
  return `<${name}${renderAttributes(attributes)}>${content}</${name}>`;
}

function renderAttributes(attributes: TakiAttributes | undefined): string {
  if (!attributes) return "";
  validateAttributeNames(attributes);
  return Object.entries(attributes)
    .filter(([, value]) => value !== undefined && value !== null && value !== false)
    .map(([key, value]) => {
      const escapedKey = escapeHtmlAttr(key);
      if (value === true) return ` ${escapedKey}`;
      return ` ${escapedKey}="${escapeHtmlAttr(String(value))}"`;
    })
    .join("");
}

function validateAttributeNames<T extends TakiAttributes | Record<string, string> | undefined>(
  attributes: T,
): T {
  if (!attributes) return attributes;

  for (const name of Object.keys(attributes)) {
    if (!isValidHtmlAttributeName(name)) {
      throw new Error(
        `Invalid HTML attribute name "${name}". Attribute names must be non-empty and must not contain whitespace, control characters, quotes, apostrophes, ">", "/", or "=".`,
      );
    }
  }

  return attributes;
}

function isValidHtmlAttributeName(name: string): boolean {
  if (name.length === 0) return false;

  for (const char of name) {
    const code = char.charCodeAt(0);
    if (code <= 0x20 || (code >= 0x7f && code <= 0x9f)) return false;
    if (FORBIDDEN_HTML_ATTRIBUTE_NAME_CHARS.includes(char)) return false;
  }

  return true;
}

function escapeHtmlAttr(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    if (char === "&") return "&amp;";
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    if (char === '"') return "&quot;";
    return "&#39;";
  });
}

function escapeHtmlText(value: string): string {
  return value.replace(/[&<>]/g, (char) => {
    if (char === "&") return "&amp;";
    if (char === "<") return "&lt;";
    return "&gt;";
  });
}

function escapeStyleText(value: string): string {
  return value.replace(/<\/style/gi, "<\\/style");
}

function collectMetadata(
  rules: TakiRule[],
  page: TakiPageContext,
  assetMap?: TakiAssetMap,
): PageMetadataContribution[] {
  const metadata: PageMetadataContribution[] = [];

  for (const rule of rules) {
    if (!matchesPage(rule.when, page)) continue;

    if (rule.kind === "meta") {
      metadata.push({ kind: "meta", name: rule.name, content: rule.content, key: rule.key });
    } else if (rule.kind === "property") {
      metadata.push({
        kind: "property",
        property: rule.property,
        content: rule.content,
        key: rule.key,
      });
    } else if (rule.kind === "link") {
      metadata.push({
        kind: "link",
        rel: rule.rel,
        href: resolveAssetUrl(rule.href, assetMap),
        hreflang: rule.hreflang,
        key: rule.key,
      });
    } else if (rule.kind === "jsonld") {
      metadata.push({ kind: "jsonld", id: rule.id ?? rule.key, graph: rule.graph });
    } else if (rule.kind === "emdash:site-standard-document") {
      metadata.push({
        kind: "link",
        rel: "site.standard.document",
        href: resolveAssetUrl(rule.href, assetMap),
        key: rule.key ?? "emdash-taki:site-standard-document",
      });
    } else if (rule.kind === "emdash:nlweb") {
      metadata.push({
        kind: "link",
        rel: "nlweb",
        href: resolveAssetUrl(rule.href, assetMap),
        key: rule.key ?? "emdash-taki:nlweb",
      });
    }
  }

  return metadata;
}

function collectFragments(
  rules: TakiRule[],
  page: TakiPageContext,
  assetMap?: TakiAssetMap,
): PageFragmentContribution[] {
  const fragments: PageFragmentContribution[] = [];

  for (const rule of rules) {
    if (!matchesPage(rule.when, page)) continue;

    if (rule.kind === "external-script") {
      fragments.push({
        kind: "external-script",
        placement: rule.placement,
        src: resolveAssetUrl(rule.src, assetMap),
        async: rule.async,
        defer: rule.defer,
        attributes: validateAttributeNames(rule.attributes),
        key: fragmentKey(rule, `script:${rule.src}`),
      });
    } else if (rule.kind === "inline-script") {
      fragments.push({
        kind: "inline-script",
        placement: rule.placement,
        code: rule.code,
        attributes: validateAttributeNames(rule.attributes),
        key: fragmentKey(rule, `inline-script:${hashString(rule.code)}`),
      });
    } else if (rule.kind === "html") {
      fragments.push({
        kind: "html",
        placement: rule.placement,
        html: rule.html,
        key: fragmentKey(rule, `html:${hashString(rule.html)}`),
      });
    } else if (rule.kind === "link-tag") {
      fragments.push(renderLinkFragment(rule, assetMap));
    } else if (rule.kind === "base") {
      fragments.push(renderBaseFragment(rule, assetMap));
    } else if (rule.kind === "inline-style") {
      fragments.push(renderInlineStyleFragment(rule));
    } else if (isCloudflareRule(rule)) {
      fragments.push(...cloudflareFragments(rule, assetMap));
    }
  }

  return fragments;
}

function renderLinkFragment(
  rule: TakiLinkTagRule,
  assetMap?: TakiAssetMap,
): PageFragmentContribution {
  const {
    rel,
    href,
    placement = "head",
    attributes,
    as,
    crossorigin,
    fetchpriority,
    hreflang,
    media,
    sizes,
    title,
    type,
  } = rule;
  const attrs: TakiAttributes = {
    ...attributes,
    rel,
    href: resolveAssetUrl(href, assetMap),
    as,
    crossorigin,
    fetchpriority,
    hreflang,
    media,
    sizes,
    title,
    type,
  };

  return {
    kind: "html",
    placement,
    html: renderVoidElement("link", attrs),
    key: fragmentKey(rule, `link:${rel}:${href}`),
  };
}

function renderBaseFragment(
  rule: TakiBaseHrefRule,
  assetMap?: TakiAssetMap,
): PageFragmentContribution {
  const { href, placement = "head", attributes } = rule;
  return {
    kind: "html",
    placement,
    html: renderVoidElement("base", {
      ...attributes,
      href: resolveAssetUrl(href, assetMap),
    }),
    key: fragmentKey(rule, `base:${href}`),
  };
}

function renderInlineStyleFragment(rule: TakiInlineStyleRule): PageFragmentContribution {
  const { css, placement = "head", attributes } = rule;
  return {
    kind: "html",
    placement,
    html: renderElement("style", attributes, escapeStyleText(css)),
    key: fragmentKey(rule, `style:${hashString(css)}`),
  };
}

function cloudflareFragments(
  rule: TakiCloudflareRule,
  assetMap?: TakiAssetMap,
): PageFragmentContribution[] {
  if (rule.kind === "cloudflare:web-analytics") {
    const beacon: Record<string, unknown> = { token: rule.token };
    if (rule.spa !== undefined) beacon.spa = rule.spa;

    return [
      {
        kind: "external-script",
        placement: rule.placement ?? "body:end",
        src: resolveAssetUrl(rule.src ?? CLOUDFLARE_WEB_ANALYTICS_SRC, assetMap),
        defer: true,
        attributes: validateAttributeNames({
          ...rule.attributes,
          "data-cf-beacon": JSON.stringify(beacon),
        }),
        key: fragmentKey(rule, "emdash-taki:cloudflare:web-analytics"),
      },
    ];
  }

  if (rule.kind === "cloudflare:zaraz") {
    return [
      {
        kind: "external-script",
        placement: rule.placement ?? "head",
        src: resolveAssetUrl(rule.src ?? CLOUDFLARE_ZARAZ_SRC, assetMap),
        attributes: validateAttributeNames({
          ...rule.attributes,
          referrerpolicy: rule.referrerPolicy ?? "origin",
        }),
        key: fragmentKey(rule, "emdash-taki:cloudflare:zaraz"),
      },
    ];
  }

  const src =
    rule.render === "explicit"
      ? `${CLOUDFLARE_TURNSTILE_SRC}?render=explicit`
      : CLOUDFLARE_TURNSTILE_SRC;
  const fragments: PageFragmentContribution[] = [];

  if (rule.preconnect) {
    fragments.push({
      kind: "html",
      placement: "head",
      html: '<link rel="preconnect" href="https://challenges.cloudflare.com">',
      key: fragmentKey(rule, "emdash-taki:cloudflare:turnstile:preconnect"),
    });
  }

  fragments.push({
    kind: "external-script",
    placement: rule.placement ?? "head",
    src: resolveAssetUrl(src, assetMap),
    async: rule.render !== "explicit",
    defer: true,
    attributes: validateAttributeNames(rule.attributes),
    key: fragmentKey(rule, "emdash-taki:cloudflare:turnstile"),
  });

  return fragments;
}

function usesFragments(rules: TakiRule[]): boolean {
  return rules.some(
    (rule) =>
      rule.kind === "external-script" ||
      rule.kind === "inline-script" ||
      rule.kind === "html" ||
      rule.kind === "link-tag" ||
      rule.kind === "base" ||
      rule.kind === "inline-style" ||
      (rule.kind === "resolve" && rule.fragments === true) ||
      isCloudflareRule(rule),
  );
}

function fragmentCapabilities(rules: TakiRule[]): PluginCapability[] {
  return usesFragments(rules) ? [PAGE_FRAGMENTS_CAPABILITY] : [];
}

function isCloudflareRule(rule: TakiRule): rule is TakiCloudflareRule {
  return rule.kind.startsWith("cloudflare:");
}

function isResolverRule(rule: TakiRule): rule is TakiResolverRule {
  return rule.kind === "resolve";
}

function isTemplateResolverRule(rule: TakiRule): boolean {
  return isResolverRule(rule) && rule.resolver === TEMPLATE_RESOLVER;
}

function isStaticRule(rule: TakiRule): rule is TakiStaticRule {
  return !isResolverRule(rule);
}

function fragmentKey(rule: { key?: string; phase?: TakiRenderPhase }, fallback: string): string {
  const key = rule.key ?? fallback;
  if (rule.phase === "early") return `${EARLY_TAKI_FRAGMENT_KEY_PREFIX}${key}`;
  return key;
}

function hashString(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

function resolveAssetUrl(value: string, assetMap: TakiAssetMap | undefined): string {
  if (!assetMap) return value;

  const exact = assetMap[value];
  if (exact) return exact;

  if (/^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith("//") || value.startsWith("#")) {
    return value;
  }

  const candidates = new Set<string>();
  candidates.add(value.replace(/^\/+/, ""));
  if (value.startsWith("./")) candidates.add(value.slice(2));
  if (!value.startsWith("/")) candidates.add(`/${value}`);

  for (const candidate of candidates) {
    const resolved = assetMap[candidate];
    if (resolved) return resolved;
  }

  return value;
}

function absolutizeMediaUrl(
  value: string | undefined,
  configuredSiteUrl: string | undefined,
  page: TakiPageContext,
): string | null {
  if (!value || hasWhitespaceOrControl(value)) return null;
  if (HTTP_URL_RE.test(value) || DATA_IMAGE_RE.test(value)) return value;
  if (value.startsWith("//") || OTHER_SCHEME_RE.test(value)) return null;

  const origin = siteOrigin(configuredSiteUrl, page);
  if (!origin) return value;
  return `${origin}${value.startsWith("/") ? value : `/${value}`}`;
}

function siteOrigin(configuredSiteUrl: string | undefined, page: TakiPageContext): string | null {
  for (const candidate of [configuredSiteUrl, page.siteUrl, page.url]) {
    if (!candidate) continue;
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
      if (!parsed.origin || parsed.origin === "null") continue;
      return parsed.origin.replace(/\/$/, "");
    } catch {
      // Ignore malformed origins and try the next candidate.
    }
  }

  return null;
}

function hasWhitespaceOrControl(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code <= 0x20 || (code >= 0x7f && code <= 0x9f) || char.trim() === "") {
      return true;
    }
  }

  return false;
}

function matchesPage(
  matchers: TakiMatcher | TakiMatcher[] | undefined,
  page: TakiPageContext,
): boolean {
  if (!matchers) return true;
  const list = Array.isArray(matchers) ? matchers : [matchers];
  return list.some((matcher) => matchesSinglePage(matcher, page));
}

function matchesSinglePage(matcher: TakiMatcher, page: TakiPageContext): boolean {
  if (matcher.kind !== undefined && !matchesOneOrMany(matcher.kind, page.kind)) return false;
  if (matcher.pageType !== undefined && !matchesOneOrMany(matcher.pageType, page.pageType))
    return false;
  if (
    matcher.collection !== undefined &&
    !matchesOneOrMany(matcher.collection, page.content?.collection)
  ) {
    return false;
  }
  if (matcher.locale !== undefined && !matchesOneOrMany(matcher.locale, page.locale)) return false;
  if (matcher.path !== undefined && !matchesOneOrMany(matcher.path, page.path)) return false;
  if (matcher.pathPrefix !== undefined && !matchesPrefix(matcher.pathPrefix, page.path))
    return false;
  return true;
}

function matchesOneOrMany<T extends string | null | undefined>(
  expected: T | T[],
  actual: T,
): boolean {
  return (Array.isArray(expected) ? expected : [expected]).includes(actual);
}

function matchesPrefix(prefix: string | string[], path: string): boolean {
  return (Array.isArray(prefix) ? prefix : [prefix]).some((value) => path.startsWith(value));
}
