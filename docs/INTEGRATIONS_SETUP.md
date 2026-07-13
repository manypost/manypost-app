# Guia completo: como conseguir as credenciais de cada rede social

> **Para quem é este guia:** qualquer pessoa que vá rodar o manypost (self-host ou operação própria) e precise conectar redes sociais. **Não é preciso saber programar.** Cada seção ensina, clique a clique, como criar o "aplicativo" na rede social e onde colar as chaves no manypost.
>
> **Aviso:** os portais das redes mudam de layout com frequência. Os passos abaixo refletem julho/2026; se algo estiver diferente, o nome das coisas (App ID, Client Secret, Redirect URI) continua o mesmo — procure por esses termos. Em caso de divergência, o portal oficial manda.

---

## 1. Entenda os conceitos (5 minutos que economizam horas)

**Por que preciso disso?** As redes sociais só permitem que programas publiquem em nome de alguém através das **APIs oficiais**. Para usar a API, você registra um **aplicativo** ("app") no site de desenvolvedores da rede — é como abrir um cadastro da *sua instalação do manypost* junto à rede.

| Termo | O que significa, sem tecniquês |
|---|---|
| **App** | O cadastro da sua instalação do manypost dentro da rede social. Cada rede tem o seu. |
| **Client ID / App ID / API Key** | O "número de identidade" público do seu app. Pode aparecer em URLs, não é segredo. |
| **Client Secret / App Secret** | A **senha** do seu app. Nunca compartilhe, nunca poste em print, nunca suba para o GitHub. Se vazar, gere outra no portal. |
| **OAuth** | O mecanismo de "Entrar com...". O dono da conta autoriza o manypost **sem nunca digitar a senha dele no manypost**. Ele é levado ao site da rede, clica em "Autorizar", e volta. |
| **Redirect URI / Callback URL** | O endereço do SEU manypost para onde a rede devolve a pessoa depois do "Autorizar". Precisa ser cadastrado **exatamente igual** no portal da rede, letra por letra. |
| **Escopos / Permissões** | O que o seu app pode fazer (ex.: "publicar posts", "ler métricas"). Você pede só o que precisa. |
| **Modo desenvolvimento vs. produção (Live)** | Todo app nasce em modo de teste: funciona só para você e pessoas convidadas. Para o público geral, algumas redes exigem **revisão** (App Review / auditoria). |
| **App Review / auditoria** | Um humano da rede analisa seu app: o que ele faz, vídeo demonstrando, documentos da empresa. Demora dias a semanas. Só Meta, TikTok, Google e Pinterest exigem de verdade. |

### O que você precisa ter ANTES de começar (para as redes com revisão)

- ✅ manypost rodando em um **domínio com HTTPS** (ex.: `https://social.suaempresa.com.br`) — `localhost` não serve para produção;
- ✅ uma página de **Política de Privacidade** e uma de **Termos de Uso** publicadas nesse domínio (as redes pedem as URLs);
- ✅ um e-mail de contato que você lê;
- ✅ para Meta: **documentos da empresa** (CNPJ/contrato social) para a verificação de negócio.

### Seu Redirect URI no manypost

Em todos os cadastros abaixo, quando pedirem "Redirect URI" / "Callback URL", use:

```
https://SEU_DOMINIO/v1/channels/callback/NOME_DA_REDE
```

Exemplo para o X: `https://social.suaempresa.com.br/v1/channels/callback/x`. A tela de conexão do manypost também mostra a URL exata para copiar.

### Onde colar as chaves no manypost

Todas as chaves vão no arquivo `.env` (ou nas variáveis de ambiente do seu servidor/painel). Depois de colar, **reinicie o manypost**. Rede sem chave configurada simplesmente não aparece no catálogo de conexões — nada quebra.

### Resumo geral (dificuldade, custo, prazo)

| Rede | Dificuldade | Custo | Revisão? | Prazo até publicar |
|---|---|---|---|---|
| Mastodon | nenhuma | grátis | não | imediato |
| Bluesky | muito fácil | grátis | não | 2 minutos |
| Telegram | muito fácil | grátis | não | 5 minutos |
| Discord | fácil | grátis | não | 15 minutos |
| Reddit | fácil | grátis | não | 10 minutos |
| LinkedIn (perfil) | média | grátis | não (produtos instantâneos) | 30 minutos |
| X (Twitter) | média | **grátis limitado; pago para volume** | cadastro com justificativa | 1 dia |
| Pinterest | média | grátis | trial imediato; acesso pleno sob revisão | dias–semanas |
| YouTube (Google) | difícil | grátis (quota limitada) | verificação do app + auditoria de quota | dias–semanas |
| Meta (Facebook/Instagram/Threads) | **difícil** | grátis | **App Review + verificação de negócio** | **semanas** |
| TikTok | **difícil** | grátis | **auditoria obrigatória p/ post público** | **semanas** |

**Estratégia recomendada:** conecte hoje as fáceis (Mastodon, Bluesky, Telegram, Discord, Reddit, LinkedIn) e **inicie hoje mesmo** os processos da Meta e do TikTok — eles são a fila mais lenta.

---

## 1.5 Login social no manypost (Google e GitHub) — opcional, 15 minutos

Isso NÃO é publicação — é deixar seus usuários **entrarem no manypost** com "Continuar com Google/GitHub" em vez de senha. Sem revisão nenhuma (escopos básicos de perfil não passam por verificação pesada).

**Google:**
1. No **https://console.cloud.google.com** (pode ser o mesmo projeto do YouTube, §5.1): **APIs & Services → OAuth consent screen** preenchido (nome, e-mail) — para login, os escopos `openid email profile` não exigem verificação.
2. **Credentials → Create Credentials → OAuth client ID** → tipo **Web application** → em redirect URIs adicione `https://SEU_DOMINIO/v1/auth/social/google/callback` → copie Client ID e Secret.

**GitHub:**
1. **https://github.com/settings/developers** → **OAuth Apps** → **New OAuth App**.
2. Preencha nome, homepage (`https://SEU_DOMINIO`) e **Authorization callback URL**: `https://SEU_DOMINIO/v1/auth/social/github/callback` → Register.
3. Copie o **Client ID** e clique **Generate a new client secret**.

No `.env`:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

Comportamento: se já existir conta com o mesmo e-mail (verificado no provedor), o login social é **vinculado** a ela — a senha continua funcionando. A foto do Google/GitHub vira a foto de perfil **apenas se o usuário ainda não tiver uma**.

## 2. Nível muito fácil (sem cadastro de app)

### 2.1 Mastodon — não precisa de nada

O manypost registra o app automaticamente na instância quando você clica em conectar. Basta ter uma conta em qualquer instância (ex.: mastodon.social). Opcional: defina a instância padrão no `.env`:

```env
MASTODON_DEFAULT_INSTANCE=https://mastodon.social
```

### 2.2 Bluesky — senha de aplicativo (2 minutos)

Não há portal de desenvolvedor. Você cria uma "senha de aplicativo" na sua própria conta:

1. Entre no Bluesky (app ou bsky.app) → **Settings** (Configurações) → **Privacy and Security** → **App Passwords**.
2. Clique em **Add App Password**, dê um nome (ex.: `manypost`) e confirme.
3. Aparece uma senha no formato `xxxx-xxxx-xxxx-xxxx`. **Copie agora** — ela não aparece de novo.
4. No manypost, ao conectar o Bluesky, informe seu **handle** (ex.: `voce.bsky.social`) e essa senha. Nada vai no `.env`.

⚠️ Nunca use sua senha principal do Bluesky no manypost — sempre a App Password (dá para revogar sem trocar sua senha).

### 2.3 Telegram — bot pelo BotFather (5 minutos)

No Telegram, quem publica é um **bot** seu, administrador do seu canal/grupo:

1. No Telegram, procure por **@BotFather** (tem selo de verificado) e abra a conversa.
2. Envie `/newbot`. Ele pergunta o **nome** (ex.: `manypost da Minha Agência`) e depois o **username**, que precisa terminar em `bot` (ex.: `minhaagencia_manypost_bot`).
3. O BotFather responde com o **token**, algo como `1234567890:AAExemploDeTokenLongoAqui`. Copie.
4. Abra o **seu canal** no Telegram → Administradores → **Adicionar administrador** → procure pelo username do bot → conceda ao menos "Publicar mensagens".
5. No `.env`:

```env
TELEGRAM_BOT_TOKEN=1234567890:AAExemploDeTokenLongoAqui
```

6. No manypost, conecte o Telegram informando **onde** o bot vai publicar: o `@username` do canal (ex.: `@minhaagencia`), o link `t.me/minhaagencia`, ou o **id numérico** do grupo (grupos são negativos, ex.: `-1001234567890`). O manypost confere na hora que o bot é admin do chat com permissão de publicar — se não for, mostra o erro exato para corrigir.
   - Um mesmo bot atende **vários canais/grupos**: você conecta cada um separadamente informando o chat de destino; o token do bot no `.env` é compartilhado.
   - Trocar o `TELEGRAM_BOT_TOKEN` depois exige reconectar os canais do Telegram (o token fica guardado cifrado em cada canal no momento da conexão).

---

## 3. Nível fácil (cadastro simples, sem revisão)

### 3.1 Discord (15 minutos)

1. Acesse **https://discord.com/developers/applications** e entre com sua conta.
2. **New Application** → nome (ex.: `manypost`) → Create.
3. Menu lateral **OAuth2**: copie o **Client ID**; em Client Secret clique **Reset Secret** e copie.
4. Ainda em OAuth2 → **Redirects**: adicione `https://SEU_DOMINIO/v1/channels/callback/discord`.
5. Menu **Bot**: clique **Reset Token** e copie o **token do bot**.
6. Convide o bot para o seu servidor: OAuth2 → **URL Generator** → marque `bot` → em permissões marque **Send Messages**, **Attach Files**, **Manage Webhooks** → copie a URL gerada, abra no navegador, escolha o servidor e autorize (você precisa ser admin do servidor).
7. No `.env`:

```env
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_BOT_TOKEN=...
```

### 3.2 Reddit (10 minutos)

1. Logado no Reddit, acesse **https://www.reddit.com/prefs/apps** (é a interface antiga mesmo).
2. Desça até **create another app...**.
3. Preencha: nome `manypost`; tipo **web app**; redirect uri `https://SEU_DOMINIO/v1/channels/callback/reddit`. Crie.
4. O **client id** é o código curto que aparece **logo abaixo do nome do app** (sem rótulo); o **secret** aparece identificado como `secret`.
5. No `.env`:

```env
REDDIT_CLIENT_ID=...
REDDIT_CLIENT_SECRET=...
```

⚠️ O Reddit limita a ~1 requisição/segundo e **cada subreddit tem regras próprias** contra autopromoção — o bloqueio ali é da comunidade, não da API.

### 3.3 LinkedIn — perfil pessoal (30 minutos)

Pré-requisito: uma **LinkedIn Page** (página de empresa) para associar ao app — se não tiver, crie uma gratuita em linkedin.com/company/setup/new (pode ser a página da sua marca).

1. Acesse **https://www.linkedin.com/developers/** → **Create app**.
2. Preencha: nome do app, associe à sua **LinkedIn Page**, logo, e aceite os termos. Crie.
3. Aba **Settings**: clique em **Verify** na associação com a página — o admin da página (você) confirma com um link. Sem verificar, nada funciona.
4. Aba **Products**: solicite **"Sign In with LinkedIn using OpenID Connect"** e **"Share on LinkedIn"** — ambos têm aprovação **instantânea**.
5. Aba **Auth**: copie **Client ID** e **Client Secret**; em **Authorized redirect URLs** adicione `https://SEU_DOMINIO/v1/channels/callback/linkedin`.
6. No `.env`:

```env
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
```

📌 **Publicar como página de empresa** (não como perfil) exige outro produto, **Community Management API**, que tem formulário de parceria e análise que pode levar semanas. Comece pelo perfil pessoal; peça a parceria em paralelo se precisar de páginas.

---

## 4. Nível médio

### 4.1 X (Twitter) — atenção ao custo

O X cobra pela API acima de um limite gratuito pequeno. **Referência (confira em https://developer.x.com/en/portal/products, muda com frequência):** Free = algumas centenas de posts/mês por app; **Basic ≈ US$ 200/mês**; Pro ≈ US$ 5.000/mês. Para 1 marca postando algumas vezes ao dia, o Free costuma bastar no começo.

1. Acesse **https://developer.x.com** → **Sign up / Developer Portal**, logado na conta X que será a "dona" do app (pode ser sua conta de empresa).
2. No cadastro do tier **Free**, descreva o uso em inglês simples, ex.: *"I schedule and publish my own social media posts using a self-hosted tool (manypost)."* Aceite os termos.
3. No portal, crie um **Project** e dentro dele um **App** (o Free permite 1).
4. No app, vá em **User authentication settings** → **Set up**:
   - **App permissions**: `Read and write`;
   - **Type of App**: `Web App, Automated App or Bot`;
   - **Callback URI**: `https://SEU_DOMINIO/v1/channels/callback/x`;
   - **Website URL**: a URL do seu manypost. Salve.
5. Aba **Keys and Tokens**: em **Consumer Keys**, copie **API Key** e **API Key Secret** (se não aparecer, clique Regenerate).
6. No `.env`:

```env
X_API_KEY=...
X_API_SECRET=...
```

⚠️ O limite do Free/Basic é **por app** (soma de todas as contas conectadas na sua instalação), não por conta. Se estourar, os posts falham com erro 429 até o mês virar — o manypost reagenda automaticamente, mas o teto é da X.

### 4.2 Pinterest

1. Acesse **https://developers.pinterest.com** e entre com sua conta Pinterest (converta para **conta business** se pedido — é grátis, em settings).
2. **My apps** → **Create app** (ou "Connect app"): preencha nome e descrição do uso.
3. Você recebe **acesso trial** imediato: funciona, mas com limites baixos e apenas para contas autorizadas por você.
4. No app: copie **App ID** e **App Secret**; cadastre o redirect `https://SEU_DOMINIO/v1/channels/callback/pinterest`.
5. Para uso pleno, solicite **standard access** no próprio portal (formulário: o que o app faz, como usa os dados). Resposta em dias a semanas.
6. No `.env`:

```env
PINTEREST_APP_ID=...
PINTEREST_APP_SECRET=...
```

---

## 5. Nível difícil (revisões formais — comece HOJE)

### 5.1 Google / YouTube

Aqui você cria um projeto no **Google Cloud** (é só um cadastro, não paga nada) e passa por duas etapas de aprovação: a **verificação do app OAuth** e, se precisar de volume, a **auditoria de quota**.

**Parte A — criar o projeto e ativar a API (15 min):**
1. Acesse **https://console.cloud.google.com** com uma conta Google (ideal: conta da empresa).
2. Topo da tela → seletor de projeto → **New Project** → nome `manypost` → Create.
3. Menu ☰ → **APIs & Services** → **Library** → procure **"YouTube Data API v3"** → **Enable**.

**Parte B — tela de consentimento OAuth (20 min):**
4. **APIs & Services** → **OAuth consent screen**: tipo **External** → preencha nome do app (`manypost`), e-mail de suporte, domínio, **URL da política de privacidade e dos termos** (obrigatórias), e-mail do desenvolvedor.
5. Em **Scopes**, adicione: `.../auth/youtube.upload` e `.../auth/youtube.readonly`.
6. Em **Test users**, adicione o seu e-mail (e de quem for testar).

**Parte C — credenciais (5 min):**
7. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID** → tipo **Web application** → em Authorized redirect URIs adicione `https://SEU_DOMINIO/v1/channels/callback/youtube` → Create.
8. Copie **Client ID** e **Client Secret** para o `.env`:

```env
YOUTUBE_CLIENT_ID=...apps.googleusercontent.com
YOUTUBE_CLIENT_SECRET=...
```

**Parte D — as pegadinhas do Google (leia!):**
- Enquanto o app está em modo **Testing**, só os test users conectam **e o acesso expira a cada 7 dias** (o canal "desconecta" sozinho — é normal nessa fase, reconecte).
- Para produção: OAuth consent screen → **Publish app** → como `youtube.upload` é escopo sensível, o Google exige **verificação**: comprovar que o domínio é seu (Search Console) e, às vezes, um vídeo demonstrando o fluxo. Leva de dias a ~2 semanas.
- **Quota:** todo projeto tem 10.000 "unidades"/dia e **cada upload de vídeo custa ~1.600** → ±6 vídeos/dia no total. Para mais, peça aumento no formulário *YouTube API Services – Audit and Quota Extension* (auditoria de conformidade; semanas). Publicação de texto/imagem não existe no YouTube — é vídeo (e Shorts).

### 5.2 Meta — Facebook, Instagram e Threads (o processo mais longo)

**Pré-requisitos (sem eles nada anda):**
- Conta pessoal do Facebook (a Meta não permite conta "fake" de empresa como dev);
- Uma **Página do Facebook** da sua marca;
- **Instagram profissional** (Business ou Creator — muda grátis no app: Configurações → Tipo de conta) **vinculado à Página** (Instagram → Configurações → Central de Contas / Página);
- Um **Portfólio de Negócios** em **https://business.facebook.com** (crie com os dados da empresa).

**Parte A — virar desenvolvedor e criar o app (20 min):**
1. Acesse **https://developers.facebook.com** → **Get Started** → aceite os termos, confirme telefone.
2. **My Apps** → **Create App** → caso de uso: algo como **"Manage everything on your Page"** / tipo **Business** → associe ao seu Portfólio de Negócios → Create.
3. No painel do app: **Settings → Basic**: copie **App ID** e **App Secret**; preencha **Privacy Policy URL**, **Terms of Service URL**, **App domains** (seu domínio) e **Data deletion instructions URL** (pode ser uma página sua explicando como pedir exclusão). Salve.

**Parte B — produtos e login (20 min):**
4. No painel, **Add Product**: adicione **Facebook Login for Business** e **Instagram** (API do Instagram).
5. Em **Facebook Login → Settings**: em **Valid OAuth Redirect URIs** adicione `https://SEU_DOMINIO/v1/channels/callback/facebook` e `https://SEU_DOMINIO/v1/channels/callback/instagram`.
6. No `.env`:

```env
FACEBOOK_APP_ID=...
FACEBOOK_APP_SECRET=...
```

**Parte C — teste em modo desenvolvimento (funciona já!):**
7. Em modo desenvolvimento, o app funciona **para quem tem papel no app**: adicione você mesmo em **App Roles → Roles** (Administrator/Tester).
8. Conecte no manypost e publique na sua Página/Instagram de teste. Tudo deve funcionar — só não funciona para *outras* pessoas ainda.

**Parte D — App Review (o que trava a maioria — reserve semanas):**
9. **Business Verification**: em Settings → Basic → Verification (ou no Business Manager → Security Center) envie documentos da empresa (CNPJ, contrato social, conta de luz/telefone no nome da empresa). Resposta em dias.
10. **App Review → Permissions and Features**: solicite **Advanced Access** para:
    - `pages_show_list`, `pages_read_engagement`, `pages_manage_posts` (Facebook Pages),
    - `instagram_basic`, `instagram_content_publish` (publicar no Instagram),
    - `business_management`,
    - (para métricas: `read_insights`, `instagram_manage_insights`).
11. Para **cada permissão**, a Meta exige: descrição de como você usa + **um screencast** (vídeo da tela) mostrando o fluxo completo *no seu manypost*: entrar → conectar a conta → compor um post → publicar → o post aparecendo no Instagram/Facebook. Grave com o app em modo dev usando sua conta de teste. Dicas: vídeo curto (2–4 min), sem cortes no fluxo essencial, narração ou legendas em inglês simples.
12. Envie e aguarde (tipicamente 3–10 dias úteis por rodada). **Rejeição na primeira tentativa é normal** — leia o motivo, ajuste o vídeo/descrição e reenvie.
13. Aprovado tudo: mude o app para **Live** (chave no topo do painel). Agora qualquer cliente seu conecta.

**Particularidades do Instagram:** a API publica via URL pública da mídia — o manypost precisa estar com armazenamento acessível por HTTPS (S3/R2 ou o próprio domínio), nunca `localhost`. Carrossel, Reels e Stories têm regras próprias de formato — o manypost valida antes de enviar.

**Threads:** é um app/produto separado. Em developers.facebook.com crie (ou adicione ao app) o caso de uso **Threads API**, solicite `threads_basic` e `threads_content_publish` (mesma lógica de review) e preencha:

```env
THREADS_APP_ID=...
THREADS_APP_SECRET=...
```

### 5.3 TikTok — auditoria obrigatória para post público

Sem auditoria aprovada, a API **funciona mas publica como "somente eu"** (privado) — ou seja, inútil em produção. O processo:

1. Acesse **https://developers.tiktok.com** → **Register** como desenvolvedor (pode usar sua conta TikTok).
2. **Manage apps** → **Connect an app** → preencha nome, ícone, descrição, categoria.
3. Em **Add products**, adicione **Login Kit** e **Content Posting API**.
4. Em Login Kit, configure o **Redirect URI**: `https://SEU_DOMINIO/v1/channels/callback/tiktok`.
5. Copie **Client Key** e **Client Secret** para o `.env`:

```env
TIKTOK_CLIENT_KEY=...
TIKTOK_CLIENT_SECRET=...
```

6. Solicite os escopos `user.info.basic`, `video.publish`, `video.upload` e envie o app para **review** (formulário + demonstração, como na Meta).
7. Na Content Posting API, peça a habilitação de **Direct Post** e passe pela **auditoria** específica (eles avaliam o fluxo de publicação — mostre que o usuário revê e confirma o conteúdo). Antes da auditoria aprovada, todo post via API fica privado — use isso para testar.
8. Existe um **modo sandbox** para desenvolvimento — útil enquanto a auditoria não sai.

### 5.4 Google Business Profile (fase futura)

O acesso à API do Google Business Profile depende de um **formulário de solicitação** próprio (procure "Google Business Profile API access request") e costuma ser lento. Só relevante para quem gerencia fichas do Google Maps — deixado aqui como referência; o manypost adiciona esse canal numa fase futura.

---

## 6. Tabela final: variáveis do `.env` por rede

| Rede | Variáveis | Onde consegui |
|---|---|---|
| Mastodon | `MASTODON_DEFAULT_INSTANCE` (opcional) | — |
| Bluesky | *(nenhuma — handle + app password na conexão)* | §2.2 |
| Telegram | `TELEGRAM_BOT_TOKEN` | §2.3 |
| Discord | `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_BOT_TOKEN` | §3.1 |
| Reddit | `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` | §3.2 |
| LinkedIn | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | §3.3 |
| X | `X_API_KEY`, `X_API_SECRET` | §4.1 |
| Pinterest | `PINTEREST_APP_ID`, `PINTEREST_APP_SECRET` | §4.2 |
| YouTube | `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET` | §5.1 |
| Facebook/Instagram | `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` | §5.2 |
| Threads | `THREADS_APP_ID`, `THREADS_APP_SECRET` | §5.2 |
| TikTok | `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` | §5.3 |

Depois de editar o `.env`: reinicie o manypost → a rede aparece em **Conexões** → clique em conectar → autorize → publique um post de teste.

## 7. Problemas comuns (e o que significam)

| Sintoma | Causa provável | Correção |
|---|---|---|
| `redirect_uri mismatch` ao autorizar | A URL cadastrada no portal não é **idêntica** à do manypost | Compare letra a letra (https, barra final, domínio) e corrija no portal |
| "App not active" / só você consegue conectar | App em modo desenvolvimento | Adicione a pessoa como tester, ou conclua o review e mude para Live |
| Canal do YouTube desconecta sozinho toda semana | App Google em modo *Testing* (token expira em 7 dias) | Publique o app e conclua a verificação (§5.1 D) |
| Instagram recusa a mídia | Conta não é profissional/não vinculada à Página, ou mídia sem URL pública | §5.2 pré-requisitos; storage com HTTPS |
| Post do TikTok fica privado | Auditoria de Direct Post ainda não aprovada | §5.3 passo 7 |
| Erro 429 (rate limit) no X | Teto do plano do app (Free/Basic) atingido no mês | Aguarde a virada do mês ou faça upgrade do tier |
| "Not enough scopes" ao conectar | Você desmarcou permissões na tela de autorização, ou o produto/escopo não foi adicionado no portal | Reconecte marcando tudo; confira os produtos do app |

## 8. Dicas de ouro para passar nas revisões (Meta, TikTok, Google)

1. **Grave o screencast no fluxo real**: login → conectar → compor → publicar → post visível na rede. Sem cortes nessa sequência.
2. Use **domínio de produção com HTTPS** no vídeo e nos cadastros — nada de localhost ou IP.
3. Descreva o uso na linguagem deles: *"users schedule and publish their own content to their own accounts"*. Nada de "growth hacking", "automation at scale" ou menção a scraping.
4. Política de privacidade e termos **publicados e coerentes** com o que o app faz.
5. Responda rejeições ponto a ponto e reenvie — cada rodada leva dias, então capriche na primeira.
6. Mantenha o registro do andamento em [`docs/platform-gates.md`](platform-gates.md) (tabela de status usada pelo projeto).
