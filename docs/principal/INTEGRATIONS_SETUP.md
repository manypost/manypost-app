# Guia completo: como conseguir as credenciais de cada rede social

[← Índice da documentação](../README.md) · [STATUS](STATUS.md) · [Specs técnicas](../specs/) · [README do projeto](../../README.md)

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
| Dev.to | muito fácil | grátis | não | 2 minutos |
| Telegram | muito fácil | grátis | não | 5 minutos |
| Discord | muito fácil | grátis | não | 2 minutos |
| Reddit | fácil | grátis | não | 10 minutos |
| LinkedIn (perfil) | média | grátis | não (produtos instantâneos) | 30 minutos |
| X (Twitter) | média | **grátis limitado; pago para volume** | cadastro com justificativa | 1 dia |
| Pinterest | média | grátis | trial imediato; acesso pleno sob revisão | dias–semanas |
| YouTube (Google) | difícil | grátis (quota limitada) | verificação do app + auditoria de quota | dias–semanas |
| Meta (Facebook/Instagram/Threads) | **difícil** | grátis | **App Review + verificação de negócio** | **semanas** |
| TikTok | **difícil** | grátis | **auditoria obrigatória p/ post público** | **semanas** |

**Estratégia recomendada:** conecte hoje as fáceis (Mastodon, Bluesky, Dev.to, Telegram, Discord, Reddit, LinkedIn) e **inicie hoje mesmo** os processos da Meta e do TikTok — eles são a fila mais lenta.

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

### 2.1 Mastodon — não precisa de nada ✅

O manypost registra o app automaticamente na instância quando você clica em conectar. Basta ter uma conta em qualquer instância (ex.: mastodon.social). Opcional: defina a instância padrão no `.env`:

```env
MASTODON_DEFAULT_INSTANCE=https://mastodon.social
```

### 2.2 Bluesky — senha de aplicativo (2 minutos) ✅

Não há portal de desenvolvedor. Você cria uma "senha de aplicativo" na sua própria conta:

1. Entre no Bluesky (app ou bsky.app) → **Settings** (Configurações) → **Privacy and Security** → **App Passwords**.
2. Clique em **Add App Password**, dê um nome (ex.: `manypost`) e confirme.
3. Aparece uma senha no formato `xxxx-xxxx-xxxx-xxxx`. **Copie agora** — ela não aparece de novo.
4. No manypost, ao conectar o Bluesky, informe seu **handle** (ex.: `voce.bsky.social`) e essa senha. Nada vai no `.env`.

⚠️ Nunca use sua senha principal do Bluesky no manypost — sempre a App Password (dá para revogar sem trocar sua senha).

### 2.3 Dev.to — chave da sua própria conta (2 minutos) ✅

O Dev.to não tem cadastro de aplicativo: você gera uma chave na sua conta e cola no manypost.

1. Entre no [dev.to](https://dev.to) → clique na sua foto → **Settings** (Configurações).
2. No menu lateral, abra **Extensions**.
3. Desça até **DEV Community API Keys**, dê um nome à chave (ex.: `manypost`) e clique em
   **Generate API Key**.
4. **Copie a chave agora** — ela não é mostrada de novo. Se perder, gere outra e reconecte.
5. No manypost, ao conectar o Dev.to, cole a chave. Nada vai no `.env`.

O que muda na hora de escrever: o Dev.to publica **artigos**, não posts curtos. Por isso, ao
agendar, abra **Configurações** do canal e preencha o **título** — ele é obrigatório, e sem ele o
manypost recusa o agendamento na hora (em vez de falhar no horário marcado). O texto do post é o
corpo do artigo e aceita **Markdown**. A primeira imagem anexada vira a **capa**.

⚠️ A chave dá acesso de publicação à sua conta inteira. Ela é guardada cifrada, mas se vazar,
revogue na mesma tela em que foi criada. Se você revogar, o canal passa a pedir reconexão.

### 2.4 Telegram — bot pelo BotFather e auto-descoberta `/connect` (5 minutos) ⚠️

No Telegram, quem publica é um **bot global da sua instalação** (ou o seu bot customizado):

1. No Telegram, procure por **@BotFather** (tem selo de verificado) e abra a conversa.
2. Envie `/newbot`. Ele pergunta o **nome** (ex.: `manypost da Minha Agência`) e depois o **username**, que precisa terminar em `bot` (ex.: `minhaagencia_manypost_bot`).
3. O BotFather responde com o **token**, algo como `1234567890:AAExemploDeTokenLongoAqui`. Copie.
4. No `.env` do seu servidor:

```env
TELEGRAM_BOT_TOKEN=1234567890:AAExemploDeTokenLongoAqui
```

5. **Como conectar um canal ou grupo na tela do manypost (Paridade Postiz — "Tudo Pronto"):**
   - **Modo 1: Auto-descoberta por comando (`/connect`) [Recomendado]:**
     1. Adicione o bot (@seu_bot) como **administrador** do seu canal ou grupo com permissão para "Publicar mensagens".
     2. No seu canal ou grupo, envie a mensagem `/connect ABCD` (onde `ABCD` é o código de 4 a 8 caracteres gerado/exibido na tela do manypost ou digitado por você).
     3. Digite `ABCD` (ou `/connect ABCD`) na tela de conexão e clique em Conectar. O manypost localiza automaticamente o canal, valida as permissões e apaga a mensagem `/connect` para manter o canal limpo!
   - **Modo 2: Direto por @username ou ID numérico:**
     1. Se preferir, basta digitar o `@username` (ex.: `@meucanal`) ou o **ID numérico** (`-100...`) do canal onde o bot já foi adicionado como admin. O manypost valida e conecta instantaneamente.

---

## 3. Nível fácil (cadastro simples, sem revisão)

### 3.1 Discord — OAuth2 + Bot (Paridade Postiz, 5 minutos) ✅

O manypost oferece **duas opções** para o Discord: o modo nativo **OAuth2 + Bot** (recomendado, experiência de SaaS em 1 clique) e o modo leve por **Webhook**.

#### A. Modo Principal (`id: discord`) — OAuth2 + Bot (Recomendado para SaaS / "Tudo Pronto")
Neste modo, o usuário clica em "Conectar com Discord", autoriza o seu app e seleciona os canais diretamente na interface.

1. Acesse o **https://discord.com/developers/applications** e clique em **New Application** (ex.: `manypost`).
2. Vá na aba **OAuth2** → em **Redirects**, adicione a URL exata do manypost:
   `https://SEU_DOMINIO/v1/channels/callback/discord`
3. Copie o **Client ID** e o **Client Secret** (clique em *Reset Secret* se necessário).
4. Vá na aba **Bot** no menu lateral, certifique-se de que o bot foi criado, e clique em **Reset Token** para copiar o **Token do Bot**.
5. No `.env`:

```env
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_BOT_TOKEN=...
```

6. **Experiência do usuário:** Ao clicar para conectar o Discord, o usuário é redirecionado para autorizar o bot em seu servidor. Em seguida, o manypost lista os canais de texto/anúncio do servidor para o usuário escolher exatamente onde postar (`twoStepConnect`).

#### B. Modo Alternativo (`id: discord-webhook`) — Webhook do Canal (Leve, sem app)
Para instalações self-hosted onde você não quer criar um aplicativo no Discord Developer Portal:
1. No Discord, clique na engrenagem do canal → **Integrações** → **Webhooks** → **Novo webhook** → **Copiar URL**.
2. Na tela do manypost, selecione o provider **Discord (Webhook)** e cole a URL. Pronto!

### 3.2 Reddit (10 minutos) ✅⚠️ (passando por auditoria, mudou a forma de conseguir o app)

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

### 3.3 LinkedIn — perfil pessoal (30 minutos) ✅

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

### 3.4 Twitch — mensagem no chat da sua live (10 minutos) ✅

> ⚠️ **Leia antes:** a Twitch **não tem feed de posts**. O que o manypost publica é uma **mensagem no chat** da sua transmissão, ou um **anúncio do canal** (aquela mensagem destacada). Como chat só tem plateia enquanto você está ao vivo, agendar para um horário com o canal offline manda a mensagem para uma sala vazia. Use para avisos no meio da live, não como "post agendado".

1. Acesse **https://dev.twitch.tv/console/apps** → faça login com sua conta da Twitch (precisa de **verificação em duas etapas** ativada na conta, senão o console não deixa criar app).
2. **Register Your Application**: dê um nome, em **OAuth Redirect URLs** coloque `https://SEU_DOMINIO/v1/channels/callback/twitch` e escolha a categoria **Application Integration**.
3. Clique em **Manage** no app criado → copie o **Client ID** e clique em **New Secret** para gerar o **Client Secret** (ele só aparece uma vez).
4. No `.env`:

```env
TWITCH_CLIENT_ID=...
TWITCH_CLIENT_SECRET=...
```

5. Reinicie o manypost, conecte em **Conexões** e autorize. Ao compor, o campo **Tipo de mensagem** escolhe entre mensagem comum e anúncio (com cor).

📌 A Twitch **suspende apps que pedem escopos que não usam** — o manypost pede exatamente três (`user:write:chat`, `user:read:chat`, `moderator:manage:announcements`). Não adicione outros no console.

### 3.5 Kick — mensagem no chat da sua live (10 minutos) ✅

> ⚠️ Mesma ressalva da Twitch: o destino é o **chat ao vivo**, não um feed.

1. Acesse **https://kick.com** logado → **Configurações** (Settings) → aba **Developer** → **Create new app**.
2. Preencha o nome e, em **Redirect URI**, coloque `https://SEU_DOMINIO/v1/channels/callback/kick`.
3. Copie o **Client ID** e o **Client Secret**.
4. No `.env`:

```env
KICK_CLIENT_ID=...
KICK_CLIENT_SECRET=...
```

5. Reinicie o manypost e conecte em **Conexões**. A Kick usa OAuth 2.1 (com PKCE) — do seu lado é igual às outras: clica, autoriza, pronto.

📌 A API pública da Kick é **recente e ainda muda com frequência**. Se um dia a conexão parar de funcionar sem você ter mexido em nada, é provável que seja mudança do lado deles — vale conferir a documentação oficial antes de procurar erro na configuração.

---

## 4. Nível médio

### 4.1 X (Twitter) — atenção ao custo ✅⚠️ (virou PaaS - paga por uso)

O X cobra pela API acima de um limite gratuito pequeno. **Referência (confira em https://developer.x.com/en/portal/products, muda com frequência):** Free = algumas centenas de posts/mês por app; **Basic ≈ US$ 200/mês**; Pro ≈ US$ 5.000/mês. Para 1 marca postando algumas vezes ao dia, o Free costuma bastar no começo.

1. Acesse **https://developer.x.com** → **Sign up / Developer Portal**, logado na conta X que será a "dona" do app (pode ser sua conta de empresa).
2. No cadastro do tier **Free**, descreva o uso em inglês simples, ex.: *"I schedule and publish my own social media posts using a self-hosted tool (manypost)."* Aceite os termos.
3. No portal, crie um **Project** e dentro dele um **App** (o Free permite 1).
4. No app, vá em **User authentication settings** → **Set up**:
   - **App permissions**: `Read and write`;
   - **Type of App**: `Web App, Automated App or Bot`;
   - **Callback URI**: `https://SEU_DOMINIO/v1/channels/callback/x`;
   - **Website URL**: a URL do seu manypost. Salve.
5. Aba **Keys and Tokens**: em **OAuth 2.0 Client ID and Client Secret** (aparece depois de salvar o passo 4), copie o **Client ID** e o **Client Secret** (se o Secret não aparecer, clique Regenerate). ⚠️ Não confunda com as "Consumer Keys" (API Key/Secret) que ficam logo acima — o manypost usa o par OAuth 2.0.
6. No `.env`:

```env
X_CLIENT_ID=...
X_CLIENT_SECRET=...
```

⚠️ O limite do Free/Basic é **por app** (soma de todas as contas conectadas na sua instalação), não por conta. Se estourar, os posts falham com erro 429 até o mês virar — o manypost reagenda automaticamente, mas o teto é da X.

### 4.2 Pinterest - ✅⚠️ (passando por auditoria)

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

**Threads (já funciona no manypost — entregue na onda 11):** é um caso de uso separado dentro do mesmo painel da Meta, e **não exige Página do Facebook nem Portfólio de Negócios** para testar. Passo a passo:

1. Em **https://developers.facebook.com** → **My Apps** → seu app (ou **Create App**) → adicione o caso de uso **Threads API** ("Access the Threads API").
2. Na configuração do caso de uso, marque as permissões: **`threads_basic`**, **`threads_content_publish`**, `threads_manage_replies` e `threads_manage_insights`.
3. Em **Threads API → Settings**, no campo **Redirect Callback URLs**, cole:
   `https://SEU_DOMINIO/v1/channels/callback/threads` — precisa ser **HTTPS** (a Meta recusa `http://localhost`; em desenvolvimento use um túnel, ex.: `ngrok`/`cloudflared`).
4. Copie o **Threads App ID** e o **Threads App Secret** dessa tela (são os do caso de uso, não confunda com os de outro produto) e preencha:

```env
THREADS_APP_ID=...
THREADS_APP_SECRET=...
```

5. Reinicie o manypost: o Threads aparece na tela **Conexões**. Conecte com a sua conta — em modo desenvolvimento funciona **inteiro** (publicar texto, foto, carrossel e thread) para quem tem papel no app (**App Roles → Roles**).
6. Para outras pessoas conectarem, é o mesmo **App Review** do item 10 acima, pedindo `threads_content_publish` com screencast.

**Duas coisas que costumam pegar no Threads:**
- **A Meta busca a mídia na sua URL** (não recebe o arquivo). Se o seu manypost estiver em `localhost`, a publicação com foto/vídeo falha com "The media could not be fetched from this URI" — post só de texto funciona normalmente. Em produção, use armazenamento acessível por HTTPS.
- **O acesso vale ~60 dias** e é renovado sozinho a cada publicação. Uma conta que fica 60 dias sem publicar pede reconexão (o canal aparece como "precisa reconectar").

**Facebook Pages (já funciona no manypost — entregue na onda 16):** usa o **Facebook Login** do mesmo painel (as `FACEBOOK_APP_ID`/`FACEBOOK_APP_SECRET` acima). Passo a passo:

1. No app da Meta, **Add Product → Facebook Login** (se ainda não tiver) e, em **Facebook Login → Settings**, no campo **Valid OAuth Redirect URIs**, cole `https://SEU_DOMINIO/v1/channels/callback/facebook` (precisa ser **HTTPS**; em dev use um túnel).
2. Reinicie o manypost: o **Facebook** aparece em **Conexões**. Conecte com a sua conta — em modo desenvolvimento funciona **inteiro** para quem tem papel no app (**App Roles → Roles**).
3. **A Página é escolhida em cada post, não na conexão.** O canal representa a sua conta; no compositor, em **Configurações** do canal Facebook, você seleciona a **Página** de destino (o manypost lista as Páginas que você administra) e se é **Feed** ou **Story**.
4. Publica: **texto**, **foto/álbum** (até 10), **vídeo (reel)** e **story** (uma foto ou um vídeo). As **respostas da thread viram comentários** no post.
5. Para outras pessoas conectarem, é o mesmo **App Review** do item 10 (peça `pages_manage_posts`, `pages_read_engagement`, `business_management`).

**Facebook também busca a mídia na sua URL** (igual ao Threads/Instagram): em `localhost`, foto/vídeo falham; post só de texto funciona. Em produção, use armazenamento acessível por HTTPS.

**Instagram — duas variantes, as duas prontas.** Escolha pela sua conta:

| | **Instagram** (Instagram Login) | **Instagram (Facebook Business)** |
|---|---|---|
| Quando usar | Sua conta profissional **não** é ligada a nenhuma Página | Sua conta é **vinculada a uma Página** que você administra |
| Credenciais | `INSTAGRAM_APP_ID/SECRET` (produto "Instagram") | **as mesmas** `FACEBOOK_APP_ID/SECRET` — se o Facebook já funciona, esta rede já está pronta |
| Como conecta | Login direto no Instagram | Login no Facebook; a conta é escolhida **em cada post** |
| Entregue | onda 15 | **onda 17** |

**Instagram via Facebook Business (entregue na onda 17)** — passo a passo:

1. Em **Facebook Login → Settings → Valid OAuth Redirect URIs**, acrescente `https://SEU_DOMINIO/v1/channels/callback/instagram` (a mesma app do Facebook; **HTTPS**, em dev use um túnel).
2. Reinicie o manypost: **Instagram (Facebook Business)** aparece em **Conexões**. Conecte com a sua conta do Facebook e **marque todas as permissões** no diálogo — sem `instagram_content_publish` a conexão é recusada com uma mensagem clara.
3. **A conta do Instagram é escolhida em cada post**, nas **Configurações** do canal no compositor: o manypost lista as contas profissionais vinculadas às suas Páginas (pelo `@` da conta) e você escolhe **Feed** ou **Story**.
4. Publica: **foto**, **reel** (vídeo único), **carrossel** (2 a 10, misturando foto e vídeo) e **story** (uma mídia). As **respostas da thread viram comentários** no post. Toda publicação leva mídia — o Instagram não aceita post só de texto.
5. Se a Página escolhida não tiver conta do Instagram vinculada, o manypost avisa antes de publicar qualquer coisa (vincule em Instagram → Configurações → Central de Contas).

**As duas variantes também buscam a mídia na sua URL:** em `localhost` a Meta não alcança o arquivo e a publicação falha — em produção, use armazenamento acessível por HTTPS.

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

6. Solicite os escopos **`user.info.basic`, `user.info.profile`, `video.publish`, `video.upload`** (o `user.info.profile` traz o `username`, usado para montar o link do post). Envie o app para **review** (formulário + demonstração, como na Meta).
7. Na Content Posting API, peça a habilitação de **Direct Post** e passe pela **auditoria** específica (eles avaliam o fluxo de publicação — mostre que o usuário revê e confirma o conteúdo). Antes da auditoria aprovada, todo post via API fica privado — use isso para testar.
8. Existe um **modo sandbox** para desenvolvimento — útil enquanto a auditoria não sai (a Client Key de sandbox começa com `sb`).

> **O provider do manypost já está pronto e testado em sandbox** (OAuth2 com PKCE, Direct Post e envio para a caixa de entrada do app, upload de vídeo em partes e foto por URL). Para gravar o vídeo de demonstração da auditoria: (a) o **Redirect URI** cadastrado no portal precisa ser **idêntico** a `PUBLIC_URL/v1/channels/callback/tiktok` — o TikTok exige **HTTPS** (em dev, use um túnel tipo ngrok/cloudflared apontando para a sua API e ponha essa URL https no `PUBLIC_URL` e no portal); (b) conecte o canal em **Conexões**, componha um post **com um vídeo** (o TikTok não aceita post só-texto) e publique; (c) em sandbox/sem auditoria, deixe a privacidade em **"Somente eu" (SELF_ONLY)** — publicar como público antes da auditoria dá erro `unaudited_client_can_only_post_to_private_accounts`. O vídeo enviado por **FILE_UPLOAD** funciona em sandbox; **fotos usam PULL_FROM_URL** e só funcionam com um domínio de mídia verificado no TikTok (deixe fotos para depois da auditoria).

### 5.4 Google Business Profile (fase futura)

O acesso à API do Google Business Profile depende de um **formulário de solicitação** próprio (procure "Google Business Profile API access request") e costuma ser lento. Só relevante para quem gerencia fichas do Google Maps — deixado aqui como referência; o manypost adiciona esse canal numa fase futura.

---

## 6. Tabela final: variáveis do `.env` por rede

| Rede | Variáveis | Onde consegui |
|---|---|---|
| Mastodon | `MASTODON_DEFAULT_INSTANCE` (opcional) | — |
| Bluesky | *(nenhuma — handle + app password na conexão)* | §2.2 |
| Dev.to | *(nenhuma — chave de API da sua conta na conexão)* | §2.3 |
| Telegram | `TELEGRAM_BOT_TOKEN` | §2.4 |
| Discord | *(nenhuma — URL do webhook do canal na conexão)* | §3.1 |
| Reddit | `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` | §3.2 |
| LinkedIn | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | §3.3 |
| Twitch (chat) | `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` | §3.4 |
| Kick (chat) | `KICK_CLIENT_ID`, `KICK_CLIENT_SECRET` | §3.5 |
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
6. Mantenha o registro do andamento em [`platform-gates.md`](platform-gates.md) (tabela de status usada pelo projeto).

---

**Nesta pasta:** [Decisões](DECISIONS.md) · [Planos](PLANS.md) · [Gates das plataformas](platform-gates.md) · [Análise do Postiz](POSTIZ_ANALYSIS.md) · [STATUS](STATUS.md) · [Histórico das ondas](CHANGELOG_ONDAS.md)

**Navegação:** [Índice da documentação](../README.md) · [Specs técnicas](../specs/) · [Marca](../brand/BRAND_SYSTEM.md) · [README do projeto](../../README.md) · [Contribuir](../../CONTRIBUTING.md)
