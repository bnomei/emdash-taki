import type {
  PageFragmentContribution,
  PageMetadataContribution,
  PagePlacement,
  PluginCapability,
  PluginContext,
  PublicPageContext,
} from "emdash";

export type TakiPageContext = PublicPageContext;

export type TakiPlacement = PagePlacement;

export type TakiRenderPhase = "early" | "late";

export type TakiAttributeValue = string | number | boolean | null | undefined;

export type TakiAttributes = Record<string, TakiAttributeValue>;

export type TakiAssetMap = Record<string, string>;

export type TakiResolveOptions = {
  assetMap?: TakiAssetMap;
  ctx?: PluginContext;
  resolve?: TakiResolver;
  resolvers?: TakiResolverMap;
  templates?: TakiTemplateResolverMap;
};

export type TakiJsonValue =
  | string
  | number
  | boolean
  | null
  | TakiJsonValue[]
  | { [key: string]: TakiJsonValue };

export type TakiMetadataLinkRel =
  | "canonical"
  | "alternate"
  | "author"
  | "license"
  | "nlweb"
  | "site.standard.document";

export type TakiMatcher = {
  kind?: PublicPageContext["kind"] | PublicPageContext["kind"][];
  pageType?: string | string[];
  collection?: string | string[];
  locale?: string | string[] | null;
  path?: string | string[];
  pathPrefix?: string | string[];
};

export type TakiRuleBase = {
  key?: string;
  when?: TakiMatcher | TakiMatcher[];
};

export type TakiResolverErrorMode = "ignore" | "throw";

export type TakiHtmlHelperOptions = TakiRuleBase & {
  placement?: TakiPlacement;
  phase?: TakiRenderPhase;
  attributes?: TakiAttributes;
};

export type TakiLinkTagOptions = TakiHtmlHelperOptions & {
  as?: string;
  crossorigin?: boolean | string;
  fetchpriority?: "high" | "low" | "auto";
  hreflang?: string;
  media?: string;
  sizes?: string;
  title?: string;
  type?: string;
};

export type TakiLinkTagRule = TakiRuleBase &
  TakiLinkTagOptions & {
    kind: "link-tag";
    rel: string;
    href: string;
  };

export type TakiBaseHrefRule = TakiRuleBase &
  TakiHtmlHelperOptions & {
    kind: "base";
    href: string;
  };

export type TakiInlineStyleRule = TakiRuleBase &
  TakiHtmlHelperOptions & {
    kind: "inline-style";
    css: string;
  };

export type TakiResolverRule<TInput = unknown> = TakiRuleBase & {
  kind: "resolve";
  resolver: string;
  fragments?: boolean;
  input?: TInput;
  onError?: TakiResolverErrorMode;
};

export type TakiMetadataRule =
  | (TakiRuleBase & {
      kind: "meta";
      name: string;
      content: string;
    })
  | (TakiRuleBase & {
      kind: "property";
      property: string;
      content: string;
    })
  | (TakiRuleBase & {
      kind: "link";
      rel: TakiMetadataLinkRel;
      href: string;
      hreflang?: string;
    })
  | (TakiRuleBase & {
      kind: "jsonld";
      id?: string;
      graph: Record<string, unknown> | Array<Record<string, unknown>>;
    });

export type TakiFragmentRule =
  | (TakiRuleBase & {
      kind: "external-script";
      placement: TakiPlacement;
      src: string;
      async?: boolean;
      defer?: boolean;
      attributes?: Record<string, string>;
      phase?: TakiRenderPhase;
    })
  | (TakiRuleBase & {
      kind: "inline-script";
      placement: TakiPlacement;
      code: string;
      attributes?: Record<string, string>;
      phase?: TakiRenderPhase;
    })
  | (TakiRuleBase & {
      kind: "html";
      placement: TakiPlacement;
      html: string;
      phase?: TakiRenderPhase;
    });

export type TakiEmDashRule =
  | (TakiRuleBase & {
      kind: "emdash:site-standard-document";
      href: string;
    })
  | (TakiRuleBase & {
      kind: "emdash:nlweb";
      href: string;
    });

export type CloudflareWebAnalyticsRule = TakiRuleBase & {
  kind: "cloudflare:web-analytics";
  token: string;
  placement?: Extract<TakiPlacement, "head" | "body:end">;
  src?: string;
  spa?: boolean;
  attributes?: Record<string, string>;
  phase?: TakiRenderPhase;
};

export type CloudflareZarazRule = TakiRuleBase & {
  kind: "cloudflare:zaraz";
  placement?: Extract<TakiPlacement, "head" | "body:end">;
  src?: string;
  referrerPolicy?: string;
  attributes?: Record<string, string>;
  phase?: TakiRenderPhase;
};

export type CloudflareTurnstileRule = TakiRuleBase & {
  kind: "cloudflare:turnstile";
  placement?: Extract<TakiPlacement, "head" | "body:end">;
  render?: "implicit" | "explicit";
  preconnect?: boolean;
  attributes?: Record<string, string>;
  phase?: TakiRenderPhase;
};

export type TakiCloudflareRule =
  | CloudflareWebAnalyticsRule
  | CloudflareZarazRule
  | CloudflareTurnstileRule;

export type TakiWaterfallRule = TakiLinkTagRule | TakiBaseHrefRule | TakiInlineStyleRule;

export type TakiStaticRule =
  | TakiMetadataRule
  | TakiFragmentRule
  | TakiEmDashRule
  | TakiCloudflareRule
  | TakiWaterfallRule;

export type TakiRule =
  | TakiMetadataRule
  | TakiFragmentRule
  | TakiEmDashRule
  | TakiCloudflareRule
  | TakiWaterfallRule
  | TakiResolverRule<unknown>;

export type TakiResolverResult =
  | TakiStaticRule[]
  | {
      assetMap?: TakiAssetMap;
      fragments?: Array<TakiFragmentRule | TakiCloudflareRule | TakiWaterfallRule>;
      metadata?: Array<TakiMetadataRule | TakiEmDashRule>;
      rules?: TakiStaticRule[];
    }
  | null
  | undefined;

export type TakiResolverContext<TInput = unknown> = {
  ctx: PluginContext;
  input: TInput | undefined;
  page: TakiPageContext;
  rule: TakiResolverRule<TInput>;
};

export type TakiResolver<TInput = unknown> = (
  context: TakiResolverContext<TInput>,
) => TakiResolverResult | Promise<TakiResolverResult>;

export type TakiResolverMap = Record<string, TakiResolver>;

export type TakiTemplateInput = {
  template?: string;
  [key: string]: TakiJsonValue | undefined;
};

export type TakiTemplateResolverContext<TInput extends TakiTemplateInput = TakiTemplateInput> =
  TakiResolverContext<TInput> & {
    template: string;
  };

export type TakiTemplateResolver<TInput extends TakiTemplateInput = TakiTemplateInput> = (
  context: TakiTemplateResolverContext<TInput>,
) => TakiResolverResult | Promise<TakiResolverResult>;

export type TakiTemplateResolverMap = Record<string, TakiTemplateResolver>;

export type TakiTemplateModule = TakiTemplateResolver | Record<string, unknown>;

export type TakiTemplateModuleMap = Record<string, TakiTemplateModule>;

export type TakiRuntimeOptions = {
  resolve?: TakiResolver;
  resolvers?: TakiResolverMap;
  templates?: TakiTemplateResolverMap;
};

export type TakiRuntimeConfig = Omit<TakiRuntimeOptions, "templates"> & {
  templates?: TakiTemplateModuleMap | TakiTemplateResolverMap;
};

export type TakiRuntimeInput = TakiRuntimeConfig | TakiResolver | TakiTemplateModuleMap;

export type TakiRenderOptions = {
  basics?: boolean;
  charset?: boolean | string;
  title?: boolean | string;
  viewport?: boolean | string;
};

export type TakiTemplatesOptions = Omit<
  TakiResolverRule<TakiTemplateInput>,
  "kind" | "resolver" | "input"
> & {
  input?: Omit<TakiTemplateInput, "template">;
};

export type TakiDescriptorOptions = {
  allowedHosts?: string[];
  assetMap?: TakiAssetMap;
  capabilities?: PluginCapability[];
  priority?: number;
  runtime?: string;
  rules?: TakiRule[];
  templates?: boolean | TakiTemplatesOptions;
};

export type TakiCreatePluginOptions = Pick<
  TakiDescriptorOptions,
  "allowedHosts" | "assetMap" | "capabilities" | "priority" | "rules"
>;

export type ResolvedTakiContributions = {
  metadata: PageMetadataContribution[];
  fragments: PageFragmentContribution[];
};
