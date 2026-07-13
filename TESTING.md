# Testar o manypost na sua máquina

Guia sem tecniquês para **clonar e experimentar** o manypost. Você não precisa saber
programar — só instalar o Docker e colar alguns comandos.

> **O que é o manypost?** Um agendador/publicador de posts para redes sociais. Ainda **não
> tem tela visual** (a interface web está em construção). Por enquanto você testa pela
> **API**, usando um explorador no navegador que deixa você clicar e ver o resultado.

---

## 1. O que você vai precisar

- **Docker Desktop** instalado e **aberto** (Windows, Mac ou Linux):
  <https://www.docker.com/products/docker-desktop/>
- **Git** para clonar o repositório: <https://git-scm.com/downloads>

Nada mais. Não precisa instalar banco de dados, Node, Bun nem nada disso — o Docker cuida de tudo.

---

## 2. Baixar e subir (um comando)

Abra o terminal (no Windows: "PowerShell" ou "Prompt de Comando") e rode:

```bash
git clone <URL-do-repositorio> manypost
cd manypost
docker compose up
```

Na **primeira vez** ele baixa e monta tudo — pode levar alguns minutos. Quando aparecer uma
linha parecida com:

```
manypost api (MODE=all) on :3000
```

...está no ar. Deixe esse terminal aberto (ele mostra os logs).

Para conferir, abra no navegador: **<http://localhost:3000>** — deve aparecer uma página
inicial com os links de teste.

---

## 3. Teste rápido de 10 segundos (opcional, sem configurar nada)

Quer só confirmar que funciona? **Abra outro terminal**, entre na mesma pasta e rode:

```bash
docker compose exec app bun run scripts/demo.ts
```

Isso cria uma conta de teste, conecta um canal **fake** (uma rede "de mentira", só para ver
o mecanismo), agenda um post e espera publicar. Se tudo estiver certo, você verá:

```
🎉 publicado! url simulada: https://fake.example/p/...
```

Pronto — a stack está viva. Agora, se quiser mexer você mesmo, siga para o explorador.

---

## 4. Testar clicando: o explorador de API

Abra no navegador: **<http://localhost:3000/docs>**

É uma página onde cada operação da API vira um formulário: você preenche, clica em **Send /
Enviar** e vê a resposta. Faça nesta ordem:

### 4.1. Criar sua conta

1. Procure **`POST /v1/auth/register`**.
2. No corpo (body) da requisição, coloque:
   ```json
   { "email": "voce@teste.local", "password": "uma-senha-bem-forte-123", "name": "Você" }
   ```
3. Clique em enviar. Resposta **201** = conta criada. A partir daqui o navegador já fica
   "logado" (via cookie) — as próximas chamadas funcionam sozinhas.

   > Se alguma chamada seguinte responder **401 (não autorizado)**, copie o campo
   > `accessToken` da resposta do register, clique em **Authentication/Authorize** no topo do
   > explorador e cole como **Bearer token**.

### 4.2. Conectar um canal de teste (fake)

Para publicar sem precisar de nenhuma rede social real, conecte o canal **fake**:

1. Envie **`POST /v1/channels/connect`** com o corpo:
   ```json
   { "provider": "fake" }
   ```
2. A resposta traz um campo **`url`** (algo como
   `http://localhost:3000/v1/channels/callback/fake?...`). **Copie essa url e abra numa nova
   aba do navegador.** Isso simula a "autorização" da rede fake e conecta o canal. Você verá
   um JSON com o `id` do canal — **guarde esse `id`**.
3. Confira em **`GET /v1/channels`**: seu canal fake deve aparecer na lista.

### 4.3. Agendar um post

Envie **`POST /v1/posts`** com o corpo (troque `ID-DO-CANAL` pelo `id` do passo anterior):

```json
{
  "text": "Meu primeiro post de teste 🚀",
  "channelIds": ["ID-DO-CANAL"],
  "publishAt": "2030-01-01T00:00:05.000Z"
}
```

> Dica: em `publishAt` use uma data/hora **poucos segundos no futuro** para ver publicar
> agora. Se preferir, use um horário bem no futuro para ver o post ficar "agendado".

Resposta **201** traz o `id` do grupo de publicação.

### 4.4. Ver publicar

Envie **`GET /v1/posts/{groupId}`** com o `id` do grupo. Repita algumas vezes: o estado da
publicação vai de `SCHEDULED` → `PUBLISHING` → **`PUBLISHED`**, com uma `releaseUrl`
simulada. É o worker publicando no horário.

Você acabou de exercitar o coração do produto: **conectar canal → agendar → publicar**.

---

## 5. Parar e limpar

- **Parar** (mantém os dados): no terminal do `docker compose up`, aperte `Ctrl+C`.
- **Parar e remover os containers**:
  ```bash
  docker compose down
  ```
- **Apagar tudo, inclusive o banco** (recomeçar do zero):
  ```bash
  docker compose down -v
  ```

---

## 6. Publicar numa rede social de verdade (opcional)

O canal fake é só para ver o mecanismo. Para publicar **de verdade**, o manypost já suporta
**Telegram, Bluesky, Discord e Mastodon**. O jeito mais fácil pela linha de comando é o
script guiado:

```bash
docker compose exec app bun run scripts/connect-and-post.ts
```

Ele pergunta qual rede você quer, pede a credencial e publica um post de teste. O que cada
rede precisa:

- **Bluesky** — seu handle (ex.: `voce.bsky.social`) + um *App Password*
  (Configurações → App Passwords no Bluesky). Não precisa mexer no servidor.
- **Discord** — a *URL de um webhook* do canal (Config. do servidor → Integrações →
  Webhooks → Novo webhook → Copiar URL). Não precisa mexer no servidor.
- **Telegram** — exige um *bot token*. Crie um bot com o
  [@BotFather](https://t.me/BotFather), adicione o bot como **administrador** do seu
  canal/grupo, e passe o token para o servidor: no `compose.yaml`, descomente a linha
  `TELEGRAM_BOT_TOKEN` e cole o token; depois `docker compose up` de novo.
- **Mastodon** — conexão por navegador (OAuth); o script te guia com o link.

Passo a passo completo e sem pressa para conseguir cada credencial:
[`docs/INTEGRATIONS_SETUP.md`](docs/INTEGRATIONS_SETUP.md).

> **Segurança:** os `compose.yaml` deste guia usam segredos fixos, apenas para teste local.
> Não exponha essa configuração na internet e não a use em produção.

---

## 7. Deu problema?

| Sintoma | O que fazer |
|---|---|
| `docker: command not found` | Instale e **abra** o Docker Desktop antes de rodar os comandos. |
| Erro de porta `3000` ocupada | Algo já usa a porta 3000. Feche o outro programa, ou mude `ports` para `3001:3000` no `compose.yaml` e acesse por `http://localhost:3001`. |
| A página `/docs` não carrega o conteúdo | O explorador baixa a interface da internet — confira sua conexão. A API em si é local e continua funcionando. |
| `401` no explorador | Veja a dica em 4.1 (usar o `accessToken` como Bearer). |
| Post fica em `SCHEDULED` e não publica | Confirme que a `publishAt` já passou. Se travar, veja os logs no terminal do `docker compose up`. |
| Quer recomeçar do zero | `docker compose down -v` e suba de novo. |

Ainda com dúvida? Anote a mensagem de erro que apareceu no terminal do `docker compose up` e
mande para quem te passou o projeto.
