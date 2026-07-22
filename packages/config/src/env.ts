import { z } from 'zod';

/**
 * Env tipada, fail-fast com mensagem clara (SPEC_INFRA §3).
 * Equivalente melhorado do ConfigurationChecker do Postiz.
 */
const EnvSchema = z
  .object({
    MODE: z.enum(['api', 'worker', 'all', 'web', 'standalone', 'full']).default('all'),
    PORT: z.coerce.number().default(3000),
    /**
     * Origem do produto para humanos (web): OAuth de canal, link de aprovação, URL pública
     * de mídia e cookies dependem dela. NÃO é o host das superfícies de máquina (abaixo).
     */
    PUBLIC_URL: z.string().url(),

    /**
     * Host dedicado da API REST de máquina (ex.: `https://api.manypost.com.br`), servida ali
     * em `/v1` — sem passar pelo proxy do Next (SPEC_API_MCP §3). É um 2º domínio custom no
     * MESMO serviço da API: o roteamento é por Host. Vazio = superfície só em `/public/v1`
     * na origem da própria API (self-host).
     */
    API_PUBLIC_URL: z.string().url().optional(),
    /**
     * Host dedicado do servidor MCP (ex.: `https://mcp.manypost.com.br`), servido na **raiz**
     * (`/`, com `/mcp` como alias) — SPEC_API_MCP §5. Pode ser o MESMO host de `API_PUBLIC_URL`
     * (aí um host serve `/v1` + `/mcp`). Vazio = MCP só em `/mcp` na origem da própria API.
     */
    MCP_PUBLIC_URL: z.string().url().optional(),

    /**
     * Flag de arquitetura 100% Open Source (monorepo unificado, estilo Postiz IS_GENERAL/IS_CLOUD):
     * true = modo Community/Self-Hosted (recursos e limites comerciais liberados localmente);
     * false = modo Managed/Cloud (ativa enforcement comercial de planos Grátis/Pro/Premium no SaaS)
     */
    IS_SELF_HOSTED: z
      .union([z.boolean(), z.string()])
      .default('true')
      .transform((v) => v === true || v === 'true'),
    /**
     * Oculta botões de upgrade, telas de faturamento da Stripe e promoções de planos na UI (estilo Postiz DISALLOW_PLUS)
     */
    HIDE_BILLING: z
      .union([z.boolean(), z.string()])
      .default('true')
      .transform((v) => v === true || v === 'true'),

    // Cobrança (Stripe) — só no gerenciado. Sem STRIPE_SECRET_KEY o billing fica desligado
    // e o PlanPolicy libera tudo, mesmo com IS_SELF_HOSTED=false (equivale ao gate por
    // STRIPE_PUBLISHABLE_KEY do Postiz): instalação sem cobrança não se auto-bloqueia.
    STRIPE_SECRET_KEY: z.string().optional(),
    /** `whsec_…` do endpoint de webhook (Stripe Dashboard → Developers → Webhooks) */
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    /** dias de teste grátis na assinatura; 0 = sem trial (a landing já vende o plano Grátis) */
    BILLING_TRIAL_DAYS: z.coerce.number().min(0).max(90).default(0),

    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1),
    /** auto = roda migrations no boot (advisory lock); off = útil em dev/smoke sem DB */
    DB_MIGRATE: z.enum(['auto', 'off']).default('auto'),
    /** base do backoff exponencial de publicação (SPEC_QUEUE §7); e2e usa 1 */
    PUBLISH_RETRY_BASE_SEC: z.coerce.number().min(0.001).default(30),
    /** permite webhook para rede privada (apenas dev/e2e — anti-SSRF fica desligado) */
    WEBHOOKS_ALLOW_PRIVATE: z
      .string()
      .default('false')
      .transform((v) => v === 'true'),

    JWT_SECRET: z.string().min(32, 'JWT_SECRET precisa de >= 32 chars'),
    ENCRYPTION_KEY: z
      .string()
      .length(64, 'ENCRYPTION_KEY: 32 bytes em hex (64 chars) — gere com: openssl rand -hex 32'),

    // Login social (opcional — sem env, o botão não aparece)
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),

    // Credenciais de providers de rede (opcionais — sem env, o provider some do catálogo;
    // guia leigo em docs/principal/INTEGRATIONS_SETUP.md). Bluesky/Mastodon não precisam de env.
    MASTODON_DEFAULT_INSTANCE: z.string().url().optional(), // pré-preenche a instância no connect
    TELEGRAM_BOT_TOKEN: z.string().optional(),
    DISCORD_CLIENT_ID: z.string().optional(),
    DISCORD_CLIENT_SECRET: z.string().optional(),
    DISCORD_BOT_TOKEN: z.string().optional(),
    LINKEDIN_CLIENT_ID: z.string().optional(),
    LINKEDIN_CLIENT_SECRET: z.string().optional(),
    X_CLIENT_ID: z.string().optional(),
    X_CLIENT_SECRET: z.string().optional(),
    TIKTOK_CLIENT_KEY: z.string().optional(),
    TIKTOK_CLIENT_SECRET: z.string().optional(),
    // Threads (família Meta): id/secret da app Meta com o caso de uso "Threads API"
    THREADS_APP_ID: z.string().optional(),
    THREADS_APP_SECRET: z.string().optional(),
    // Streaming — publicam no CHAT ao vivo, não em feed (paridade Postiz)
    TWITCH_CLIENT_ID: z.string().optional(),
    TWITCH_CLIENT_SECRET: z.string().optional(),
    KICK_CLIENT_ID: z.string().optional(),
    KICK_CLIENT_SECRET: z.string().optional(),

    STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
    UPLOAD_DIR: z.string().default('./uploads'),
    MEDIA_MAX_IMAGE_MB: z.coerce.number().min(1).default(10),
    MEDIA_MAX_VIDEO_MB: z.coerce.number().min(1).default(200),
    /** permite /media/from-url apontar p/ rede privada (apenas dev/e2e — anti-SSRF desligado) */
    MEDIA_ALLOW_PRIVATE_URLS: z
      .string()
      .default('false')
      .transform((v) => v === 'true'),

    // IA agnóstica de provedor (SPEC_AI §2 / DECISIONS §8)
    AI_PROVIDER: z.enum(['none', 'openai-compatible', 'anthropic']).default('none'),
    AI_BASE_URL: z.string().url().optional(),
    AI_API_KEY: z.string().optional(),
    AI_MODEL: z.string().optional(),

    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
    // /metrics (SPEC_INFRA §4): se setado, exige Authorization: Bearer <token>; vazio = /metrics aberto
    // (self-hosted em rede privada — a exposição não contém segredos, só contadores)
    METRICS_TOKEN: z.string().optional(),
  })
  .refine((env) => env.ENCRYPTION_KEY !== env.JWT_SECRET, {
    message: 'ENCRYPTION_KEY e JWT_SECRET devem ser segredos DISTINTOS (SPEC_DATA §5)',
  })
  .refine((env) => hostOf(env.API_PUBLIC_URL) !== hostOf(env.PUBLIC_URL), {
    message:
      'API_PUBLIC_URL precisa de um host DIFERENTE de PUBLIC_URL (ex.: api.dominio) — mesmo host esconderia a interface web',
    path: ['API_PUBLIC_URL'],
  })
  .refine((env) => hostOf(env.MCP_PUBLIC_URL) !== hostOf(env.PUBLIC_URL), {
    message:
      'MCP_PUBLIC_URL precisa de um host DIFERENTE de PUBLIC_URL (ex.: mcp.dominio) — mesmo host esconderia a interface web',
    path: ['MCP_PUBLIC_URL'],
  });

export type Env = z.infer<typeof EnvSchema>;

/** `host:porta` normalizado de uma URL (undefined se a URL não veio ou é inválida). */
function hostOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return undefined; // URL inválida já é reprovada pelo z.string().url()
  }
}

/**
 * Hosts das superfícies de máquina (SPEC_API_MCP §3/§5). O roteamento da API é por **Host**:
 * um mesmo serviço atende o host do app (`PUBLIC_URL`), o da API REST e o do MCP. Os dois
 * últimos podem coincidir (um subdomínio servindo `/v1` + `/mcp`) ou ficar vazios (self-host,
 * onde as superfícies vivem em `/public/v1` e `/mcp` da própria origem).
 */
/**
 * URLs que uma máquina (integração/agente) deve usar — fonte única para a mensagem de erro da
 * API, o `/v1/capabilities` (a UI mostra ao criar a chave) e a documentação. Com host dedicado
 * são `api./v1` e `mcp.`; sem ele, caem nos caminhos da própria origem (self-host).
 */
export const machineEndpoints = (env: Env): { restBaseUrl: string; mcpUrl: string } => {
  const base = (url: string) => url.replace(/\/+$/, '');
  const api = env.API_PUBLIC_URL ? base(env.API_PUBLIC_URL) : undefined;
  return {
    restBaseUrl: api ? `${api}/v1` : `${base(env.PUBLIC_URL)}/public/v1`,
    mcpUrl: env.MCP_PUBLIC_URL
      ? base(env.MCP_PUBLIC_URL)
      : `${api ?? base(env.PUBLIC_URL)}/mcp`,
  };
};

export const machineHosts = (env: Env): { api?: string; mcp?: string } => {
  const api = hostOf(env.API_PUBLIC_URL);
  const mcp = hostOf(env.MCP_PUBLIC_URL);
  return { ...(api ? { api } : {}), ...(mcp ? { mcp } : {}) };
};

/**
 * Fronteira Community × Cloud (DECISIONS §15). Cobrança e enforcement de plano só existem
 * quando a instalação é gerenciada E tem Stripe configurada. Em qualquer outro caso o
 * `PlanPolicy` responde `allowed` para tudo e a UI esconde o billing.
 */
export const isBillingEnabled = (env: Env): boolean =>
  !env.IS_SELF_HOSTED && !env.HIDE_BILLING && Boolean(env.STRIPE_SECRET_KEY);

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Configuração inválida:\n${issues}`);
  }
  return parsed.data;
}

/** chaves do Env que guardam texto — o `satisfies` abaixo barra nome de variável errado */
type StringEnvKey = {
  [K in keyof Env]-?: NonNullable<Env[K]> extends string ? K : never;
}[keyof Env];

/**
 * `ctx.secrets` de cada provider ← variável de ambiente que o preenche (SPEC_INTEGRATIONS §2).
 * Fonte única de DUAS coisas: os secrets injetados no provider e o **nome da variável que falta**
 * quando ele aparece indisponível na UI (`providerEnvVarNames`) — sem isso o self-hoster só via
 * a rede sumir do catálogo, sem pista do que configurar.
 */
const PROVIDER_ENV = {
  mastodon: { defaultInstance: 'MASTODON_DEFAULT_INSTANCE' },
  telegram: { botToken: 'TELEGRAM_BOT_TOKEN' },
  discord: {
    clientId: 'DISCORD_CLIENT_ID',
    clientSecret: 'DISCORD_CLIENT_SECRET',
    botToken: 'DISCORD_BOT_TOKEN',
  },
  linkedin: { clientId: 'LINKEDIN_CLIENT_ID', clientSecret: 'LINKEDIN_CLIENT_SECRET' },
  x: { clientId: 'X_CLIENT_ID', clientSecret: 'X_CLIENT_SECRET' },
  // TikTok usa client_key (não client_id) — SPEC_INTEGRATIONS §4 (onda 2)
  tiktok: { clientKey: 'TIKTOK_CLIENT_KEY', clientSecret: 'TIKTOK_CLIENT_SECRET' },
  threads: { appId: 'THREADS_APP_ID', appSecret: 'THREADS_APP_SECRET' },
  twitch: { clientId: 'TWITCH_CLIENT_ID', clientSecret: 'TWITCH_CLIENT_SECRET' },
  kick: { clientId: 'KICK_CLIENT_ID', clientSecret: 'KICK_CLIENT_SECRET' },
} as const satisfies Record<string, Record<string, StringEnvKey>>;

/**
 * env → ctx.secrets por provider. Fonte única para a api E o worker dedicado — o refresh de
 * token (LinkedIn/X/Threads) roda no worker e precisa das credenciais do app tanto quanto o connect.
 */
export function providerSecretsFromEnv(env: Env): Record<string, Record<string, string>> {
  return Object.fromEntries(
    Object.entries(PROVIDER_ENV).map(([provider, keys]) => [
      provider,
      Object.fromEntries(
        Object.entries(keys as Record<string, StringEnvKey>)
          .map(([secret, envKey]) => [secret, env[envKey]])
          .filter(([, value]) => value),
      ) as Record<string, string>,
    ]),
  );
}

/**
 * Nomes das variáveis de ambiente que preenchem estes secrets de um provider — é o que a UI
 * mostra ao self-hoster ("falta THREADS_APP_ID") em vez de esconder a rede. Secret sem mapa
 * (provider novo que esqueceu de entrar no PROVIDER_ENV) simplesmente não aparece na lista.
 */
export function providerEnvVarNames(providerId: string, secretKeys: string[]): string[] {
  const map = (PROVIDER_ENV as Record<string, Record<string, string>>)[providerId] ?? {};
  return secretKeys.map((k) => map[k]).filter((v): v is string => Boolean(v));
}
