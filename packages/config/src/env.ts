import { z } from 'zod';

/**
 * Env tipada, fail-fast com mensagem clara (SPEC_INFRA §3).
 * Equivalente melhorado do ConfigurationChecker do Postiz.
 */
const EnvSchema = z
  .object({
    MODE: z.enum(['api', 'worker', 'all', 'web', 'standalone', 'full']).default('all'),
    PORT: z.coerce.number().default(3000),
    PUBLIC_URL: z.string().url(),

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
    // guia leigo em docs/INTEGRATIONS_SETUP.md). Bluesky/Mastodon não precisam de env.
    MASTODON_DEFAULT_INSTANCE: z.string().url().optional(), // pré-preenche a instância no connect
    TELEGRAM_BOT_TOKEN: z.string().optional(),
    DISCORD_CLIENT_ID: z.string().optional(),
    DISCORD_CLIENT_SECRET: z.string().optional(),
    DISCORD_BOT_TOKEN: z.string().optional(),
    LINKEDIN_CLIENT_ID: z.string().optional(),
    LINKEDIN_CLIENT_SECRET: z.string().optional(),
    X_CLIENT_ID: z.string().optional(),
    X_CLIENT_SECRET: z.string().optional(),

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
  })
  .refine((env) => env.ENCRYPTION_KEY !== env.JWT_SECRET, {
    message: 'ENCRYPTION_KEY e JWT_SECRET devem ser segredos DISTINTOS (SPEC_DATA §5)',
  });

export type Env = z.infer<typeof EnvSchema>;

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
 * env → ctx.secrets por provider (SPEC_INTEGRATIONS §2). Fonte única para a api E o
 * worker dedicado — o refresh de token (LinkedIn/X) roda no worker e precisa das
 * credenciais do app tanto quanto o connect.
 */
export function providerSecretsFromEnv(env: Env): Record<string, Record<string, string>> {
  const prune = (o: Record<string, string | undefined>) =>
    Object.fromEntries(Object.entries(o).filter(([, v]) => v)) as Record<string, string>;
  return {
    mastodon: prune({ defaultInstance: env.MASTODON_DEFAULT_INSTANCE }),
    telegram: prune({ botToken: env.TELEGRAM_BOT_TOKEN }),
    discord: prune({
      clientId: env.DISCORD_CLIENT_ID,
      clientSecret: env.DISCORD_CLIENT_SECRET,
      botToken: env.DISCORD_BOT_TOKEN,
    }),
    linkedin: prune({ clientId: env.LINKEDIN_CLIENT_ID, clientSecret: env.LINKEDIN_CLIENT_SECRET }),
    x: prune({ clientId: env.X_CLIENT_ID, clientSecret: env.X_CLIENT_SECRET }),
  };
}
