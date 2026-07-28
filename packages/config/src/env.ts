import { z } from 'zod';

/** Env tipada, fail-fast com mensagem clara (SPEC_INFRA §3). */
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
     * Flag de arquitetura 100% Open Source no monorepo unificado:
     * true = modo Community/Self-Hosted (recursos e limites comerciais liberados localmente);
     * false = modo Managed/Cloud (ativa enforcement comercial de planos Grátis/Pro/Premium no SaaS)
     */
    IS_SELF_HOSTED: z
      .union([z.boolean(), z.string()])
      .default('true')
      .transform((v) => v === true || v === 'true'),
    /**
     * Oculta botões de upgrade, telas de faturamento da Stripe e promoções de planos na UI.
     */
    HIDE_BILLING: z
      .union([z.boolean(), z.string()])
      .default('true')
      .transform((v) => v === true || v === 'true'),

    // Cobrança (Stripe) — só no gerenciado. Sem STRIPE_SECRET_KEY o billing fica desligado
    // e o PlanPolicy libera tudo, mesmo com IS_SELF_HOSTED=false: instalação sem cobrança
    // não se auto-bloqueia.
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

    ENCRYPTION_KEY: z
      .string()
      .length(64, 'ENCRYPTION_KEY: 32 bytes em hex (64 chars) — gere com: openssl rand -hex 32'),

    // Clerk é o único autenticador humano. API/web/all exigem as duas chaves; o worker
    // dedicado não autentica humanos e não recebe o secret.
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
    CLERK_SECRET_KEY: z.string().min(1).optional(),
    /** chave pública PEM opcional: quando presente, a validação do JWT não consulta JWKS */
    CLERK_JWT_KEY: z.string().min(1).optional(),

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
    // YouTube: client OAuth do tipo "Web application" no Google Cloud. Os dois escopos que o
    // provider pede (youtube.upload/youtube.readonly) sao sensiveis e passam pela verificacao
    // do Google; metricas exigem um TERCEIRO escopo sensivel, por isso ficam atras de um flag.
    YOUTUBE_CLIENT_ID: z.string().optional(),
    YOUTUBE_CLIENT_SECRET: z.string().optional(),
    YOUTUBE_ENABLE_ANALYTICS: z.string().optional(),
    // Threads (família Meta): id/secret da app Meta com o caso de uso "Threads API"
    THREADS_APP_ID: z.string().optional(),
    THREADS_APP_SECRET: z.string().optional(),
    // Instagram (standalone, via Instagram Login — sem Página do Facebook): App ID/Secret do
    // produto "Instagram" no painel da Meta (distintos dos FACEBOOK_APP_* do IG via Business)
    INSTAGRAM_APP_ID: z.string().optional(),
    INSTAGRAM_APP_SECRET: z.string().optional(),
    // Facebook Pages + Instagram via Facebook Business (família Meta): App ID/Secret do produto
    // "Facebook Login" no painel da Meta — a MESMA app serve os dois providers
    FACEBOOK_APP_ID: z.string().optional(),
    FACEBOOK_APP_SECRET: z.string().optional(),
    // Streaming — publicam no chat ao vivo, não em feed.
    TWITCH_CLIENT_ID: z.string().optional(),
    TWITCH_CLIENT_SECRET: z.string().optional(),
    KICK_CLIENT_ID: z.string().optional(),
    KICK_CLIENT_SECRET: z.string().optional(),

    STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
    UPLOAD_DIR: z.string().default('./uploads'),
    /**
     * URL base sob a qual as CHAVES de mídia são servidas publicamente (bucket público/CDN,
     * ex.: `https://media.dominio`). A família Meta e o Dev.to fazem *pull* da mídia por essa
     * URL, sem credencial — por isso ela não pode depender da origem do app. Obrigatória com
     * `STORAGE_PROVIDER=s3`. Vazia no driver local = `PUBLIC_URL/uploads` (comportamento
     * histórico); apontá-la para o driver local exige rotear a raiz desse host p/ `/uploads`.
     */
    MEDIA_PUBLIC_URL: z.string().url().optional(),
    /**
     * Bucket S3-compatível (R2/S3/MinIO) e credenciais dele. Use um bucket POR AMBIENTE —
     * compartilhar bucket entre staging e produção compartilha credencial, regra de ciclo de
     * vida e raio de dano. Obrigatórias com `STORAGE_PROVIDER=s3`.
     */
    S3_BUCKET: z.string().optional(),
    /** `auto` no R2; a região real na AWS */
    S3_REGION: z.string().optional(),
    /** endpoint do serviço — obrigatório no R2/MinIO, dispensável na AWS */
    S3_ENDPOINT: z.string().url().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    MEDIA_MAX_IMAGE_MB: z.coerce.number().min(1).default(10),
    MEDIA_MAX_VIDEO_MB: z.coerce.number().min(1).default(200),
    /** permite /media/from-url apontar p/ rede privada (apenas dev/e2e — anti-SSRF desligado) */
    MEDIA_ALLOW_PRIVATE_URLS: z
      .string()
      .default('false')
      .transform((v) => v === 'true'),

    // IA agnóstica de provedor (SPEC_AI §2 / DECISIONS §8). Os valores abaixo nomeiam
    // PROTOCOLO, não fornecedor — é por isso que este arquivo está na allowlist do
    // scripts/check-ai-providers.ts. Fora daqui e de core/src/infra/ai, nome nenhum.
    AI_PROVIDER: z.enum(['none', 'openai-compatible', 'anthropic']).default('none'),
    AI_BASE_URL: z.string().url().optional(),
    /**
     * Opcional de propósito: runtime de modelo local (na mesma máquina/rede) costuma não pedir
     * credencial, e exigir uma forçaria todo self-hoster a inventar um valor falso. Ausente,
     * o adapter simplesmente não manda header de autorização.
     */
    AI_API_KEY: z.string().optional(),
    AI_MODEL: z.string().optional(),
    /** teto de tempo de UMA chamada ao modelo — impede que o upstream segure a requisição HTTP */
    AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300_000).default(45_000),
    /**
     * Teto de tokens de saída por chamada — impede custo sem limite numa resposta desgovernada.
     *
     * O default é folgado de propósito: **modelo de raciocínio gasta tokens de saída pensando**
     * antes de escrever a primeira letra, então um teto apertado o corta no meio da palavra
     * (verificado contra um provedor real). Resposta cortada vira `ai.invalid_response`
     * nomeando esta variável — nunca é entregue como se estivesse pronta.
     */
    AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(64).max(32_000).default(4000),
    /**
     * Provedor de imagem independente. Ausente = modo de compatibilidade, herdando a conexão
     * completa de texto; `none` desliga somente imagens.
     */
    AI_IMAGE_PROVIDER: z.enum(['none', 'openai-compatible']).optional(),
    AI_IMAGE_BASE_URL: z.string().url().optional(),
    AI_IMAGE_API_KEY: z.string().optional(),
    /** opt-in explícito: `AI_MODEL` nunca é presumido capaz de desenhar */
    AI_IMAGE_MODEL: z.string().optional(),

    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
    // /metrics (SPEC_INFRA §4): se setado, exige Authorization: Bearer <token>; vazio = /metrics aberto
    // (self-hosted em rede privada — a exposição não contém segredos, só contadores)
    METRICS_TOKEN: z.string().optional(),
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
  })
  // storage de bucket falha FECHADO no boot, nomeando a variável que falta: um `s3` mal
  // configurado publicaria URL inalcançável, e p/ a família Meta isso é falha PERMANENTE
  .superRefine((env, ctx) => {
    if (env.STORAGE_PROVIDER !== 's3') return;
    const obrigatorias = [
      'S3_BUCKET',
      'S3_ACCESS_KEY_ID',
      'S3_SECRET_ACCESS_KEY',
      'MEDIA_PUBLIC_URL',
    ] as const;
    for (const nome of obrigatorias) {
      if (!env[nome]) {
        ctx.addIssue({
          code: 'custom',
          path: [nome],
          message: `${nome} é obrigatória com STORAGE_PROVIDER=s3`,
        });
      }
    }
  })
  // IA também falha FECHADO no boot: um AI_PROVIDER selecionado sem endereço ou sem modelo
  // só descobriria o problema na primeira geração do usuário, já com a franquia reservada.
  // AI_API_KEY fica de fora de propósito (runtime local sem credencial é caso legítimo).
  .superRefine((env, ctx) => {
    if (env.AI_PROVIDER === 'none') return;
    for (const nome of ['AI_BASE_URL', 'AI_MODEL'] as const) {
      if (!env[nome]) {
        ctx.addIssue({
          code: 'custom',
          path: [nome],
          message: `${nome} é obrigatória com AI_PROVIDER=${env.AI_PROVIDER}`,
        });
      }
    }
  })
  // Imagens têm conexão própria. Quando o provider é explícito, endpoint e credencial nunca
  // vazam da configuração de texto. Provider omitido é somente a compatibilidade histórica:
  // herda a conexão inteira, desde que o protocolo tenha adapter de imagem registrado.
  .superRefine((env, ctx) => {
    if (env.AI_IMAGE_PROVIDER === 'none') return;

    if (env.AI_IMAGE_PROVIDER === 'openai-compatible') {
      for (const nome of ['AI_IMAGE_BASE_URL', 'AI_IMAGE_MODEL'] as const) {
        if (!env[nome]) {
          ctx.addIssue({
            code: 'custom',
            path: [nome],
            message: `${nome} é obrigatória com AI_IMAGE_PROVIDER=${env.AI_IMAGE_PROVIDER}`,
          });
        }
      }
      return;
    }

    if (env.AI_IMAGE_BASE_URL || env.AI_IMAGE_API_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['AI_IMAGE_PROVIDER'],
        message:
          'AI_IMAGE_PROVIDER é obrigatória ao configurar endpoint ou credencial próprios de imagem',
      });
    }

    if (env.AI_IMAGE_MODEL && env.AI_PROVIDER !== 'openai-compatible') {
      ctx.addIssue({
        code: 'custom',
        path: ['AI_IMAGE_PROVIDER'],
        message:
          'AI_IMAGE_PROVIDER é obrigatória porque o protocolo de texto não tem adapter de imagem registrado',
      });
    }
  })
  .superRefine((env, ctx) => {
    if (env.MODE === 'worker') return;
    if (!env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'],
        message: 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY é obrigatória fora do worker dedicado',
      });
    }
    if (!env.CLERK_SECRET_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['CLERK_SECRET_KEY'],
        message: 'CLERK_SECRET_KEY é obrigatória fora do worker dedicado',
      });
    }
  });

export type Env = z.infer<typeof EnvSchema>;

export type ClerkConfig = {
  publishableKey: string;
  secretKey: string;
  jwtKey: string | undefined;
  authorizedParties: string[];
};

/** `host:porta` normalizado de uma URL (undefined se a URL não veio ou é inválida). */
function hostOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return undefined; // URL inválida já é reprovada pelo z.string().url()
  }
}

/** Configuração Clerk sem valores implícitos vindos do browser. */
export function clerkConfig(env: Env): ClerkConfig {
  if (!env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !env.CLERK_SECRET_KEY) {
    throw new Error('configuração Clerk ausente no runtime humano');
  }
  return {
    publishableKey: env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    secretKey: env.CLERK_SECRET_KEY,
    jwtKey: env.CLERK_JWT_KEY,
    authorizedParties: [new URL(env.PUBLIC_URL).origin],
  };
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

/**
 * Configuração resolvida do storage de mídia — fonte única para a api E o worker dedicado
 * (mesmo precedente do `providerSecretsFromEnv`: os dois composition roots já divergiram uma
 * vez). A forma espelha `MediaStorageConfig` de `@manypost/core`; `config` vem antes do core
 * no grafo de pacotes, então a compatibilidade é estrutural e o typecheck do composition root
 * é quem a prova.
 */
export type MediaStorageConfig =
  | { driver: 'local'; dir: string; publicBase: string }
  | {
      driver: 's3';
      bucket: string;
      region?: string;
      endpoint?: string;
      accessKeyId: string;
      secretAccessKey: string;
      publicBase: string;
    };

export function mediaStorageConfigFromEnv(env: Env): MediaStorageConfig {
  if (env.STORAGE_PROVIDER === 's3') {
    // o schema já reprovou o boot sem estas variáveis; o `!` aqui é a consequência disso
    return {
      driver: 's3',
      bucket: env.S3_BUCKET!,
      ...(env.S3_REGION ? { region: env.S3_REGION } : {}),
      ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT } : {}),
      accessKeyId: env.S3_ACCESS_KEY_ID!,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
      publicBase: env.MEDIA_PUBLIC_URL!,
    };
  }
  return {
    driver: 'local',
    dir: env.UPLOAD_DIR,
    // sem MEDIA_PUBLIC_URL, a mídia continua saindo pela rota /uploads da própria origem —
    // é a forma das URLs já materializadas dentro de publications.content
    publicBase: env.MEDIA_PUBLIC_URL ?? `${env.PUBLIC_URL.replace(/\/+$/, '')}/uploads`,
  };
}

/**
 * Configuração resolvida de IA — fonte única para a api E o worker dedicado (mesmo precedente
 * do `mediaStorageConfigFromEnv`). `null` = instalação sem IA: o container não monta o adapter
 * e as rotas respondem `capability.disabled` (SPEC_AI §5.2), nunca 500.
 *
 * `protocol` nomeia o DIALETO HTTP falado, não o fornecedor: qualquer gateway ou runtime local
 * que fale um dos dois serve, e trocar de fornecedor é mudar `AI_BASE_URL`, não código.
 */
export type AiConfig = {
  protocol: 'openai-compatible' | 'anthropic';
  baseUrl: string;
  /** ausente = sem header de autorização (runtime local) */
  apiKey?: string;
  model: string;
  timeoutMs: number;
  maxOutputTokens: number;
};

export function aiConfigFromEnv(env: Env): AiConfig | null {
  if (env.AI_PROVIDER === 'none') return null;
  // o schema já reprovou o boot sem estas duas; o `!` aqui é a consequência disso
  return {
    protocol: env.AI_PROVIDER,
    baseUrl: env.AI_BASE_URL!,
    ...(env.AI_API_KEY ? { apiKey: env.AI_API_KEY } : {}),
    model: env.AI_MODEL!,
    timeoutMs: env.AI_TIMEOUT_MS,
    maxOutputTokens: env.AI_MAX_OUTPUT_TOKENS,
  };
}

export type ImageConfig = {
  protocol: 'openai-compatible';
  baseUrl: string;
  /** ausente = sem header de autorização (runtime local) */
  apiKey?: string;
  model: string;
  timeoutMs: number;
};

/**
 * Configuração de imagem resolvida. Provider explícito possui conexão inteiramente própria;
 * provider omitido herda a conexão inteira de texto para preservar instalações existentes.
 */
export function imageConfigFromEnv(env: Env): ImageConfig | null {
  if (!env.AI_IMAGE_MODEL || env.AI_IMAGE_PROVIDER === 'none') return null;

  if (env.AI_IMAGE_PROVIDER === 'openai-compatible') {
    return {
      protocol: env.AI_IMAGE_PROVIDER,
      baseUrl: env.AI_IMAGE_BASE_URL!,
      ...(env.AI_IMAGE_API_KEY ? { apiKey: env.AI_IMAGE_API_KEY } : {}),
      model: env.AI_IMAGE_MODEL,
      timeoutMs: env.AI_TIMEOUT_MS,
    };
  }

  // O schema garante que esta herança só existe para um protocolo com adapter registrado.
  return {
    protocol: 'openai-compatible',
    baseUrl: env.AI_BASE_URL!,
    ...(env.AI_API_KEY ? { apiKey: env.AI_API_KEY } : {}),
    model: env.AI_IMAGE_MODEL,
    timeoutMs: env.AI_TIMEOUT_MS,
  };
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
  // enableAnalytics NAO entra em requiredSecrets do provider: ausente, a rede continua disponivel
  // e so as metricas ficam de fora (o escopo sensivel a mais so entra quando a instalacao liga)
  youtube: {
    clientId: 'YOUTUBE_CLIENT_ID',
    clientSecret: 'YOUTUBE_CLIENT_SECRET',
    enableAnalytics: 'YOUTUBE_ENABLE_ANALYTICS',
  },
  threads: { appId: 'THREADS_APP_ID', appSecret: 'THREADS_APP_SECRET' },
  'instagram-standalone': { appId: 'INSTAGRAM_APP_ID', appSecret: 'INSTAGRAM_APP_SECRET' },
  facebook: { appId: 'FACEBOOK_APP_ID', appSecret: 'FACEBOOK_APP_SECRET' },
  // Instagram via Facebook Business usa a MESMA app do `facebook` (produto "Facebook Login"):
  // habilitar o Facebook habilita as duas redes, sem par de variáveis novo
  instagram: { appId: 'FACEBOOK_APP_ID', appSecret: 'FACEBOOK_APP_SECRET' },
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
