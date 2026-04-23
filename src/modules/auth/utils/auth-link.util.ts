type LinkConfig = {
   baseAdminUrl?: string | null;
   baseWebUrl?: string | null;
   requestOrigin?: string | null;
};

type BuildAuthLinkInput = LinkConfig & {
   path: string;
   query?: Record<string, string>;
};

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

export function extractRequestOrigin(headers?: {
   origin?: string | string[];
   referer?: string | string[];
   referrer?: string | string[];
}): string | undefined {
   const origin = normalizeOrigin(readHeader(headers?.origin));
   if (origin) return origin;

   const referer =
      readHeader(headers?.referer) ?? readHeader(headers?.referrer);
   if (!referer) return undefined;

   try {
      return new URL(referer).origin;
   } catch {
      return undefined;
   }
}

export function buildAuthFrontendLink(input: BuildAuthLinkInput): string {
   const baseUrl = resolveAuthFrontendBaseUrl(input);
   const url = new URL(input.path, `${baseUrl}/`);

   for (const [key, value] of Object.entries(input.query ?? {})) {
      url.searchParams.set(key, value);
   }

   return url.toString();
}

export function resolveAuthFrontendBaseUrl(input: LinkConfig): string {
   const configuredAdminUrl = normalizeBaseUrl(input.baseAdminUrl);
   const configuredWebUrl = normalizeBaseUrl(input.baseWebUrl);
   const configuredUrl = configuredWebUrl ?? configuredAdminUrl;
   const requestOrigin = normalizeBaseUrl(input.requestOrigin);

   if (configuredUrl && !isLocalUrl(configuredUrl)) {
      return configuredUrl;
   }

   if (requestOrigin && !isLocalUrl(requestOrigin)) {
      return requestOrigin;
   }

   if (configuredUrl) return configuredUrl;
   if (requestOrigin) return requestOrigin;

   throw new Error('URL base do frontend nao configurada para auth.');
}

function readHeader(value?: string | string[]): string | undefined {
   if (Array.isArray(value)) return value[0];
   return value;
}

function normalizeOrigin(value?: string | null): string | undefined {
   const normalized = normalizeBaseUrl(value);
   if (!normalized) return undefined;

   try {
      return new URL(normalized).origin;
   } catch {
      return undefined;
   }
}

function normalizeBaseUrl(value?: string | null): string | undefined {
   const trimmed = value?.trim();
   if (!trimmed) return undefined;

   try {
      const url = new URL(trimmed);
      if (!['http:', 'https:'].includes(url.protocol)) return undefined;
      return url.toString().replace(/\/$/, '');
   } catch {
      return undefined;
   }
}

function isLocalUrl(value: string): boolean {
   try {
      const hostname = new URL(value).hostname.toLowerCase();
      return LOCAL_HOSTS.has(hostname);
   } catch {
      return false;
   }
}
