export type paths = {
    "/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Status e providers de rede disponíveis */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description health check */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @enum {string} */
                            status: "ok";
                            providers: string[];
                        };
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/auth/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Identidade Clerk com autorização Manypost */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description usuário Clerk com papel Manypost */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Me"];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description papel insuficiente (requer ADMIN/OWNER) */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description provedor externo temporariamente indisponível */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/api-keys": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Lista as API keys da organização */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description API keys da organização (sem hash — chave só aparece na criação) */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApiKey"][];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description papel insuficiente (requer ADMIN/OWNER) */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        /** Cria uma API key (mp_live_…) com escopos */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        name: string;
                        scopes: ("posts:read" | "posts:write" | "channels:read" | "channels:write" | "media:write" | "analytics:read" | "webhooks:manage" | "mcp" | "mcp:read" | "mcp:write")[];
                    };
                };
            };
            responses: {
                /** @description a apiKey em claro aparece SOMENTE nesta resposta */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            apiKey: string;
                            record: components["schemas"]["ApiKey"];
                        };
                    };
                };
                /** @description requisição fora do contrato (problem+json) */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description papel insuficiente (requer ADMIN/OWNER) */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/api-keys/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Revoga uma API key */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description chave revogada */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description papel insuficiente (requer ADMIN/OWNER) */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/channels": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Lista os canais conectados (tokens nunca são expostos) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description canais */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Channel"][];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/channels/providers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Catálogo de providers desta instalação
         * @description Lista **todas** as redes implementadas, com `available` dizendo se as credenciais de app estão no env. Em self-hosted, a indisponível ainda traz `setupEnv` com as variáveis que faltam — assim a UI mostra "precisa de credencial" em vez de esconder a rede.
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description providers */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ChannelProviderInfo"][];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/channels/connect": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Inicia a conexão de um canal
         * @description Provider por credenciais (connectType=fields) conecta direto e devolve o canal (201). Provider OAuth devolve a URL de autorização (200) — o navegador segue e volta em /callback.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        provider: string;
                        fields?: unknown;
                    };
                };
            };
            responses: {
                /** @description URL de autorização OAuth */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            url: string;
                        };
                    };
                };
                /** @description canal conectado (fluxo por credenciais) */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Channel"];
                    };
                };
                /** @description requisição fora do contrato (problem+json) */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description papel insuficiente (requer ADMIN/OWNER) */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não encontrado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/channels/callback/{provider}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Callback OAuth — troca o code pelo token e conecta o canal
         * @description Alvo do redirect OAuth (aberto num popup pela UI). Conecta o canal e devolve uma página HTML que avisa o opener via postMessage (`manypost:oauth:success`) e fecha a janela.
         */
        get: {
            parameters: {
                query: {
                    code: string;
                    state: string;
                };
                header?: never;
                path: {
                    provider: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description página HTML que fecha o popup e notifica o opener — o canal já foi conectado */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/html": string;
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description papel insuficiente (requer ADMIN/OWNER) */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não encontrado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/channels/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Desconecta um canal (soft delete) */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description canal desconectado */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description papel insuficiente (requer ADMIN/OWNER) */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não encontrado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/channels/{id}/sub-accounts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Lista sub-contas ou canais (ex: canais de texto do servidor Discord) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description lista de canais/sub-contas */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            externalId: string;
                            name: string;
                            username?: string;
                            avatarUrl?: string;
                        }[];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description papel insuficiente (requer ADMIN/OWNER) */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não encontrado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/posts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Agenda um post (1 grupo → 1 publicação por canal)
         * @description Valida texto/mídia por canal e enfileira. `textByChannel` personaliza o texto do post principal por canal; `thread` cria réplicas encadeadas; `requireApproval` nasce DRAFT aguardando aprovação por link.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        text: string;
                        channelIds: string[];
                        /** Format: date-time */
                        publishAt: string;
                        /** @default UTC */
                        timezone?: string;
                        settingsByChannel?: {
                            [key: string]: unknown;
                        };
                        textByChannel?: {
                            [key: string]: string;
                        };
                        mediaIds?: string[];
                        thread?: {
                            text: string;
                            mediaIds?: string[];
                            delaySec?: number;
                        }[];
                        requireApproval?: boolean;
                    };
                };
            };
            responses: {
                /** @description grupo agendado (ou DRAFT se requireApproval) */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PostGroup"];
                    };
                };
                /** @description requisição fora do contrato (problem+json) */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não encontrado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/posts/{groupId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Detalhe de um grupo de post
         * @description Além dos estados, expõe o conteúdo completo (texto base, texto/settings por canal e réplicas de thread) — é o que o composer usa p/ duplicar um post.
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description grupo */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PostGroupDetail"];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não encontrado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Edita texto, horário e/ou settings por canal (re-agenda com nova versão de job)
         * @description Editar `text` sobrescreve o content de TODAS as publicações (overrides resetam). `settingsByChannel` (chave = channelId) faz merge nos settings de publicação do canal e é validado por provider.
         */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        text?: string;
                        /** Format: date-time */
                        publishAt?: string;
                        settingsByChannel?: {
                            [key: string]: unknown;
                        };
                    };
                };
            };
            responses: {
                /** @description grupo re-agendado */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PostGroup"];
                    };
                };
                /** @description requisição fora do contrato (problem+json) */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não encontrado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/v1/posts/{groupId}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Cancela um grupo agendado (job antigo morre por versão) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description grupo cancelado */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PostGroup"];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não encontrado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/posts/{groupId}/retry": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Tenta publicar de novo (FAILED/NEEDS_REVIEW → SCHEDULED)
         * @description Kanban "tentar novamente". Com `channelId` no corpo, retenta só aquele canal.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: string;
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** Format: uuid */
                        channelId?: string;
                    };
                };
            };
            responses: {
                /** @description grupo re-agendado */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PostGroup"];
                    };
                };
                /** @description requisição fora do contrato (problem+json) */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não encontrado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/posts/{groupId}/approval-link": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Status do link de aprovação mais recente (ou null) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description status do link (null se nunca houve) */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApprovalLinkStatus"];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        /**
         * Cria o link público de aprovação de um rascunho
         * @description Só para grupos DRAFT (requireApproval). Criar de novo revoga o link anterior.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: string;
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        expiresInHours?: number;
                    };
                };
            };
            responses: {
                /** @description link criado (token só aqui) */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApprovalLink"];
                    };
                };
                /** @description requisição fora do contrato (problem+json) */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não encontrado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        /** Revoga o link de aprovação pendente */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description resultado */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            revoked: boolean;
                        };
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/publications": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Feed flat de publicações (calendário/kanban)
         * @description Uma linha por publicação (o cliente agrupa por groupId). Cada item embute grupo (state/origin/awaitingApproval) e canal. Paginação keyset por (publishAt, id).
         */
        get: {
            parameters: {
                query?: {
                    from?: string;
                    to?: string;
                    state?: string;
                    channelId?: string;
                    cursor?: string;
                    limit?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description página do feed */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PublicationFeed"];
                    };
                };
                /** @description requisição fora do contrato (problem+json) */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Stream SSE de eventos em tempo real
         * @description Eventos nomeados: post.scheduled, post.published, post.failed, channel.refresh_required, notification.created (+ hello no handshake e ping a cada 25s). Sem Redis o stream fica só com keepalive — a UI cai no polling.
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description stream text/event-stream */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/event-stream": string;
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/media/upload": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Envia mídia (multipart) — MIME real por magic bytes */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "multipart/form-data": {
                        /**
                         * Format: binary
                         * @description arquivo (MIME real detectado por magic bytes)
                         */
                        file: string;
                        alt?: string;
                    };
                };
            };
            responses: {
                /** @description mídia criada */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Media"];
                    };
                };
                /** @description requisição fora do contrato (problem+json) */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/media/from-url": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Importa mídia por URL (anti-SSRF, re-valida a cada redirect) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** Format: uri */
                        url: string;
                        alt?: string;
                    };
                };
            };
            responses: {
                /** @description mídia criada */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Media"];
                    };
                };
                /** @description requisição fora do contrato (problem+json) */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/media": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Lista a biblioteca de mídia */
        get: {
            parameters: {
                query?: {
                    limit?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description itens de mídia */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Media"][];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/media/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Remove uma mídia (soft — arquivo fica p/ posts já agendados) */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description mídia removida */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** Atualiza o texto alternativo (alt) de uma mídia */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        alt: string | null;
                    };
                };
            };
            responses: {
                /** @description alt atualizado */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description requisição fora do contrato (problem+json) */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/v1/webhooks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Lista os webhooks de saída */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description webhooks */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Webhook"][];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description papel insuficiente (requer ADMIN/OWNER) */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        /**
         * Cria um webhook (entrega assinada HMAC)
         * @description O secret whsec_ é retornado só aqui — o receptor valida a assinatura com ele.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        name: string;
                        /** Format: uri */
                        url: string;
                        events: ("post.scheduled" | "post.published" | "post.failed" | "channel.refresh_required" | "channel.disconnected" | "mention.received")[];
                        channelIds?: string[];
                    };
                };
            };
            responses: {
                /** @description webhook criado */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["WebhookCreated"];
                    };
                };
                /** @description requisição fora do contrato (problem+json) */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description papel insuficiente (requer ADMIN/OWNER) */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/webhooks/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Remove um webhook */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description webhook removido */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description papel insuficiente (requer ADMIN/OWNER) */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não encontrado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/notifications": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Lista as notificações da organização */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description notificações */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Notification"][];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/notifications/read-all": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Marca todas as notificações como lidas */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description quantas foram marcadas */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            read: number;
                        };
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/notifications/{id}/read": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Marca uma notificação como lida (idempotente) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description lida */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** @enum {boolean} */
                            read: true;
                        };
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não encontrado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/capabilities": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Plano, features liberadas, limites e uso da organização */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description capacidades da organização */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Capabilities"];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/insights/summary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Resumo operacional da organização (tela inicial)
         * @description Contagens agregadas: o que precisa de atenção (falhas, revisão, aprovação, entrega parcial, canais a reconectar), o que sai hoje e a semana por dia. **Não traz métrica de desempenho** — a plataforma não coleta engajamento, então todo número aqui vem do registro do que ela mesma pediu e entregou. As fronteiras de dia são resolvidas no fuso informado em `tz`.
         */
        get: {
            parameters: {
                query?: {
                    tz?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description resumo */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["InsightsSummary"];
                    };
                };
                /** @description requisição fora do contrato (problem+json) */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Busca posts pelo texto (paleta de comandos)
         * @description Busca no conteúdo dos posts da organização autenticada. Escopo por organização vem do principal e nunca da requisição. Consulta de 2 a 80 caracteres, até 10 resultados, restrita aos últimos 180 dias. Devolve excerto, estado e canais — nunca credencial.
         */
        get: {
            parameters: {
                query: {
                    q: string;
                    limit?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description resultados */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SearchResults"];
                    };
                };
                /** @description requisição fora do contrato (problem+json) */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/ai/caption": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Gera uma legenda por canal, adaptada a cada rede
         * @description Requer a feature `ai_caption` (plano Pro). O texto devolvido SEMPRE respeita o limite do canal: se o modelo passar, cortamos numa fronteira de frase e marcamos `shortened`.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        brief: string;
                        /** @description canais de destino — todos precisam ser desta organização */
                        channelIds: string[];
                        tone?: string;
                        /** @description settings da publicação, mergeados com os do canal — mesma semântica do agendamento (uma conta verificada do X, por exemplo, valida contra o limite maior) */
                        settings?: {
                            [key: string]: unknown;
                        };
                    };
                };
            };
            responses: {
                /** @description legendas por canal */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            variants: components["schemas"]["AiVariant"][];
                        };
                    };
                };
                /** @description requisição fora do contrato (problem+json) */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description plano atual não inclui — `extra.requiredTier` diz o plano mínimo */
                402: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não encontrado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description rate limit — aguarde e tente de novo */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/ai/rewrite": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Reescreve um texto seguindo uma instrução
         * @description Requer a feature `ai_caption` (plano Pro). **Nunca encurta o texto**: reescrever é a única operação cuja entrada é o texto que a pessoa escreveu, e cortá-lo para caber num limite que ela não escolheu perderia trabalho. Quando um canal é informado e o resultado passa do limite dele, `overLimit` vem true e o texto vem inteiro — o limite continua sendo imposto no agendamento.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        text: string;
                        /**
                         * @description instrução do catálogo do servidor
                         * @enum {string}
                         */
                        instructionId?: "shorten" | "expand" | "formal" | "casual" | "with_emoji" | "without_emoji" | "fix_grammar";
                        /** @description instrução em texto livre — alternativa a `instructionId` */
                        instruction?: string;
                        /**
                         * Format: uuid
                         * @description opcional: sem canal a reescrita roda e nenhum limite é imposto nem reportado
                         */
                        channelId?: string;
                        /** @description settings da publicação, mergeados com os do canal — mesma semântica do agendamento (uma conta verificada do X, por exemplo, valida contra o limite maior) */
                        settings?: {
                            [key: string]: unknown;
                        };
                    };
                };
            };
            responses: {
                /** @description texto reescrito */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AiRewriteResult"];
                    };
                };
                /** @description requisição fora do contrato (problem+json) */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description plano atual não inclui — `extra.requiredTier` diz o plano mínimo */
                402: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não encontrado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description rate limit — aguarde e tente de novo */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/ai/hashtags": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Sugere hashtags para um texto e uma rede
         * @description Requer a feature `ai_caption` (plano Pro).
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        text: string;
                        /** Format: uuid */
                        channelId: string;
                        count?: number;
                    };
                };
            };
            responses: {
                /** @description hashtags sugeridas */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            hashtags: string[];
                        };
                    };
                };
                /** @description requisição fora do contrato (problem+json) */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description plano atual não inclui — `extra.requiredTier` diz o plano mínimo */
                402: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não encontrado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description rate limit — aguarde e tente de novo */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/ai/alt-text": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Descreve uma imagem da biblioteca para leitores de tela
         * @description Requer a feature `ai_caption` (plano Pro) **e** um modelo que enxergue imagem. Sem essa capacidade responde 501 `ai.capability_unavailable` — descrever pelo nome do arquivo seria pior que não descrever.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** Format: uuid */
                        mediaId: string;
                        context?: string;
                        maxLength?: number;
                    };
                };
            };
            responses: {
                /** @description descrição da imagem */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            alt: string;
                        };
                    };
                };
                /** @description requisição fora do contrato (problem+json) */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description plano atual não inclui — `extra.requiredTier` diz o plano mínimo */
                402: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não encontrado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description rate limit — aguarde e tente de novo */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description capacidade não disponível nesta instalação */
                501: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/ai/draft": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Transforma uma ideia em um rascunho por canal
         * @description Requer a feature `ai_multichannel_draft` (plano Premium).
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        idea: string;
                        /** @description canais de destino — todos precisam ser desta organização */
                        channelIds: string[];
                        tone?: string;
                        /** @description settings da publicação, mergeados com os do canal — mesma semântica do agendamento (uma conta verificada do X, por exemplo, valida contra o limite maior) */
                        settings?: {
                            [key: string]: unknown;
                        };
                    };
                };
            };
            responses: {
                /** @description rascunhos por canal */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            drafts: components["schemas"]["AiVariant"][];
                        };
                    };
                };
                /** @description requisição fora do contrato (problem+json) */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description plano atual não inclui — `extra.requiredTier` diz o plano mínimo */
                402: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não encontrado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description rate limit — aguarde e tente de novo */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/ai/week-plan": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Propõe uma semana de publicações
         * @description Requer a feature `ai_calendar` (plano Premium). **Propõe, não agenda**: nada é criado, agendado ou publicado por esta rota — o resultado é material que uma pessoa aceita.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        goal: string;
                        /** @description canais de destino — todos precisam ser desta organização */
                        channelIds: string[];
                        /**
                         * Format: date-time
                         * @description início da semana, ISO 8601
                         */
                        weekStart: string;
                        slots?: number;
                        /** @description settings da publicação, mergeados com os do canal — mesma semântica do agendamento (uma conta verificada do X, por exemplo, valida contra o limite maior) */
                        settings?: {
                            [key: string]: unknown;
                        };
                    };
                };
            };
            responses: {
                /** @description semana proposta */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            slots: components["schemas"]["AiPlannedSlot"][];
                        };
                    };
                };
                /** @description requisição fora do contrato (problem+json) */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description plano atual não inclui — `extra.requiredTier` diz o plano mínimo */
                402: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não encontrado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description rate limit — aguarde e tente de novo */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/ai/image": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Gera uma imagem e guarda na biblioteca de mídia
         * @description Requer a feature `ai_image` (plano Premium) **e** um provedor que gere imagem; sem essa capacidade responde 501 `ai.capability_unavailable`. O modo `economy` custa 2 créditos e usa renderização baixa; `quality` custa 5 e usa alta. O padrão é `economy`. Uma requisição gera uma imagem. A forma pedida é **proporção**, nunca resolução: quem traduz é o adapter. Os bytes devolvidos pelo provedor são validados por assinatura de arquivo (o `content-type` declarado não é confiável) e entram na biblioteca marcados como gerados, com o prompt e o modelo. Aceita `Idempotency-Key`: repetir uma geração paga não pode cobrar duas vezes.
         */
        post: {
            parameters: {
                query?: never;
                header?: {
                    "Idempotency-Key"?: string;
                };
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        prompt: string;
                        /**
                         * @description proporção; sem ela, `channelId` decide; sem os dois, 1:1
                         * @enum {string}
                         */
                        aspect?: "1:1" | "4:5" | "9:16" | "16:9" | "1.91:1";
                        /**
                         * Format: uuid
                         * @description a proporção vira a que a rede deste canal trata melhor no feed
                         */
                        channelId?: string;
                        /**
                         * @description economy = 2 créditos/low; quality = 5 créditos/high; padrão economy
                         * @enum {string}
                         */
                        mode?: "economy" | "quality";
                        /** @description descrição para leitor de tela */
                        alt?: string;
                    };
                };
            };
            responses: {
                /** @description mídia gerada */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            media: components["schemas"]["AiGeneratedMedia"];
                        };
                    };
                };
                /** @description requisição fora do contrato (problem+json) */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description plano atual não inclui — `extra.requiredTier` diz o plano mínimo */
                402: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não encontrado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description conflito */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description rate limit — aguarde e tente de novo */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description capacidade não disponível nesta instalação */
                501: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/ai/best-times": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Sugere horários de publicação para um canal
         * @description Requer a feature `ai_best_time` (plano Pro). **Não usa modelo e não consome franquia**: é estatística sobre o histórico da própria organização mais uma linha de base por rede. `confidence` e `sampleSize` dizem o quanto a resposta vale — com pouco histórico, `fromBaseline` vem true e a confiança é baixa. Responde mesmo sem IA configurada.
         */
        get: {
            parameters: {
                query: {
                    channelId: string;
                    timezone?: string;
                    limit?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description horários sugeridos */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AiBestTimes"];
                    };
                };
                /** @description requisição fora do contrato (problem+json) */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description plano atual não inclui — `extra.requiredTier` diz o plano mínimo */
                402: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não encontrado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description rate limit — aguarde e tente de novo */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/billing/plans": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Catálogo de planos, preços (centavos) e limites */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description catálogo */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PlanCatalog"];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/billing": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Plano efetivo, uso do período e assinatura da marca */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description estado de cobrança */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["BillingState"];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/billing/checkout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Assina um plano (Checkout) ou troca o plano de quem já assina (proration) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @enum {string} */
                        tier: "PRO" | "PREMIUM";
                        /** @enum {string} */
                        period: "MONTHLY" | "YEARLY";
                    };
                };
            };
            responses: {
                /** @description url = Checkout hospedado; changed = trocou direto; portalUrl = pagamento precisa de ação */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            url?: string;
                            portalUrl?: string;
                            changed?: boolean;
                            identifier: string;
                        };
                    };
                };
                /** @description requisição fora do contrato (problem+json) */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description papel insuficiente (requer ADMIN/OWNER) */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/billing/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Quanto sai agora ao trocar de plano (proration, em centavos) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** @enum {string} */
                        tier: "PRO" | "PREMIUM";
                        /** @enum {string} */
                        period: "MONTHLY" | "YEARLY";
                    };
                };
            };
            responses: {
                /** @description valor a pagar agora */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            amount: number;
                        };
                    };
                };
                /** @description requisição fora do contrato (problem+json) */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description papel insuficiente (requer ADMIN/OWNER) */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/billing/portal": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Link do portal da Stripe (cartão, faturas, dados fiscais) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description portal */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            url: string;
                        };
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description papel insuficiente (requer ADMIN/OWNER) */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/billing/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Cancela ao fim do período (chamar de novo reativa) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        feedback?: string;
                    };
                };
            };
            responses: {
                /** @description cancelAt = quando perde o acesso; canceledImmediately = encerrou na hora (pagamento em atraso) */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            cancelAt: string | null;
                            canceledImmediately: boolean;
                        };
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description papel insuficiente (requer ADMIN/OWNER) */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não encontrado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/billing/invoices": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Faturas pagas da marca (link e PDF hospedados pela Stripe) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description faturas */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            id: string;
                            amountPaid: number;
                            currency: string;
                            status: string;
                            createdAt: string;
                            invoiceUrl: string | null;
                            pdfUrl: string | null;
                        }[];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/billing/sync": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Reconcilia a assinatura com a Stripe (volta do checkout, sem esperar o webhook) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description resultado */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            ok: boolean;
                        };
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description papel insuficiente (requer ADMIN/OWNER) */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/stripe/webhook": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Webhook da Stripe (assinado por HMAC — não usa sessão) */
        post: {
            parameters: {
                query?: never;
                header: {
                    "stripe-signature": string;
                };
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": Record<string, never>;
                };
            };
            responses: {
                /** @description evento processado */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            ok: boolean;
                        };
                    };
                };
                /** @description assinatura HMAC inválida */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            ok: boolean;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/uploads/{org}/{file}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Serve um arquivo de mídia (público, sem auth — chaves UUID) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    org: string;
                    file: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description bytes do arquivo */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/octet-stream": string;
                    };
                };
                /** @description não encontrado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/public/approval/{token}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Preview público do post (sem login, por token)
         * @description 404 uniforme para token inválido/expirado/revogado — sem enumeração.
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    token: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description como o post será publicado */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApprovalPreview"];
                    };
                };
                /** @description não encontrado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description rate limit — aguarde e tente de novo */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/public/approval/{token}/approve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Cliente aprova — agenda o post de verdade (idempotente) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    token: string;
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        name?: string;
                    };
                };
            };
            responses: {
                /** @description resolução */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApprovalResolution"];
                    };
                };
                /** @description não encontrado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description rate limit — aguarde e tente de novo */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/public/approval/{token}/request-changes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Cliente pede ajustes (feedback obrigatório) — mantém rascunho */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    token: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        feedback: string;
                        name?: string;
                    };
                };
            };
            responses: {
                /** @description resolução */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ApprovalResolution"];
                    };
                };
                /** @description requisição fora do contrato (problem+json) */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não encontrado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description rate limit — aguarde e tente de novo */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/public/v1/posts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Agenda um post (escopo posts:write)
         * @description Idempotente com o header `Idempotency-Key`. `requireApproval` nasce DRAFT aguardando link de aprovação; `thread` cria réplicas encadeadas.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        text: string;
                        channelIds: string[];
                        /** Format: date-time */
                        publishAt: string;
                        /** @default UTC */
                        timezone?: string;
                        settingsByChannel?: {
                            [key: string]: unknown;
                        };
                        textByChannel?: {
                            [key: string]: string;
                        };
                        mediaIds?: string[];
                        thread?: {
                            text: string;
                            mediaIds?: string[];
                            delaySec?: number;
                        }[];
                        requireApproval?: boolean;
                    };
                };
            };
            responses: {
                /** @description grupo agendado */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PubPostGroup"];
                    };
                };
                /** @description requisição fora do contrato (problem+json) */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description papel insuficiente (requer ADMIN/OWNER) */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description rate limit — aguarde e tente de novo */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/public/v1/posts/{groupId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Detalhe de um grupo (escopo posts:read) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description grupo */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PubPostGroup"];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description papel insuficiente (requer ADMIN/OWNER) */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não encontrado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description rate limit — aguarde e tente de novo */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        /** Cancela um grupo agendado (escopo posts:write) */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description grupo cancelado */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PubPostGroup"];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description papel insuficiente (requer ADMIN/OWNER) */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não encontrado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description rate limit — aguarde e tente de novo */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** Edita texto/horário/settings e re-agenda (escopo posts:write) */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        text?: string;
                        /** Format: date-time */
                        publishAt?: string;
                        settingsByChannel?: {
                            [key: string]: unknown;
                        };
                    };
                };
            };
            responses: {
                /** @description grupo re-agendado */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PubPostGroup"];
                    };
                };
                /** @description requisição fora do contrato (problem+json) */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description papel insuficiente (requer ADMIN/OWNER) */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não encontrado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description rate limit — aguarde e tente de novo */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/public/v1/posts/{groupId}/retry": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Tenta publicar de novo (escopo posts:write)
         * @description FAILED/NEEDS_REVIEW → SCHEDULED. Com `channelId` no corpo, retenta só o canal.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: string;
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        /** Format: uuid */
                        channelId?: string;
                    };
                };
            };
            responses: {
                /** @description grupo re-agendado */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PubPostGroup"];
                    };
                };
                /** @description requisição fora do contrato (problem+json) */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description papel insuficiente (requer ADMIN/OWNER) */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não encontrado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description rate limit — aguarde e tente de novo */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/public/v1/posts/{groupId}/approval-link": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Cria o link público de aprovação de um rascunho (escopo posts:write) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: string;
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": {
                        expiresInHours?: number;
                    };
                };
            };
            responses: {
                /** @description link criado (token só aqui) */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            token: string;
                            url: string;
                            /** Format: date-time */
                            expiresAt: string;
                        };
                    };
                };
                /** @description requisição fora do contrato (problem+json) */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description papel insuficiente (requer ADMIN/OWNER) */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não encontrado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description rate limit — aguarde e tente de novo */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        /** Revoga o link de aprovação pendente (escopo posts:write) */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    groupId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description resultado */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            revoked: boolean;
                        };
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description papel insuficiente (requer ADMIN/OWNER) */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description rate limit — aguarde e tente de novo */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/public/v1/publications": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Feed flat de publicações — status por canal (escopo posts:read)
         * @description Uma linha por publicação; paginação keyset por (publishAt, id).
         */
        get: {
            parameters: {
                query?: {
                    from?: string;
                    to?: string;
                    state?: string;
                    channelId?: string;
                    cursor?: string;
                    limit?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description página do feed */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PubPublicationFeed"];
                    };
                };
                /** @description requisição fora do contrato (problem+json) */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description papel insuficiente (requer ADMIN/OWNER) */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description rate limit — aguarde e tente de novo */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/public/v1/channels": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Lista os canais conectados (escopo channels:read) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description canais */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PubChannel"][];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description papel insuficiente (requer ADMIN/OWNER) */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description rate limit — aguarde e tente de novo */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/public/v1/channels/providers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Catálogo de providers disponíveis + capacidades (escopo channels:read) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description providers */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            [key: string]: unknown;
                        }[];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description papel insuficiente (requer ADMIN/OWNER) */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description rate limit — aguarde e tente de novo */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/public/v1/channels/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Desconecta um canal (escopo channels:write) */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description canal desconectado */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description papel insuficiente (requer ADMIN/OWNER) */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não encontrado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description rate limit — aguarde e tente de novo */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/public/v1/media/upload": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Envia mídia multipart — MIME real por magic bytes (escopo media:write) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "multipart/form-data": {
                        /** Format: binary */
                        file: string;
                        alt?: string;
                    };
                };
            };
            responses: {
                /** @description mídia criada */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PubMedia"];
                    };
                };
                /** @description requisição fora do contrato (problem+json) */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description papel insuficiente (requer ADMIN/OWNER) */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description rate limit — aguarde e tente de novo */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/public/v1/media/from-url": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Importa mídia por URL (anti-SSRF) (escopo media:write) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** Format: uri */
                        url: string;
                        alt?: string;
                    };
                };
            };
            responses: {
                /** @description mídia criada */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PubMedia"];
                    };
                };
                /** @description requisição fora do contrato (problem+json) */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description papel insuficiente (requer ADMIN/OWNER) */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description rate limit — aguarde e tente de novo */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/public/v1/media": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Lista a biblioteca de mídia (escopo media:write) */
        get: {
            parameters: {
                query?: {
                    limit?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description itens de mídia */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PubMedia"][];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description papel insuficiente (requer ADMIN/OWNER) */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description rate limit — aguarde e tente de novo */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/public/v1/webhooks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Lista os webhooks de saída (escopo webhooks:manage) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description webhooks */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PubWebhook"][];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description papel insuficiente (requer ADMIN/OWNER) */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description rate limit — aguarde e tente de novo */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        /**
         * Cria um webhook — entrega assinada HMAC (escopo webhooks:manage)
         * @description O secret whsec_ é retornado só aqui.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        name: string;
                        /** Format: uri */
                        url: string;
                        events: ("post.scheduled" | "post.published" | "post.failed" | "channel.refresh_required" | "channel.disconnected" | "mention.received")[];
                        channelIds?: string[];
                    };
                };
            };
            responses: {
                /** @description webhook criado (secret só aqui) */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            secret: string;
                            webhook: components["schemas"]["PubWebhook"];
                        };
                    };
                };
                /** @description requisição fora do contrato (problem+json) */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description papel insuficiente (requer ADMIN/OWNER) */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description rate limit — aguarde e tente de novo */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/public/v1/webhooks/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Remove um webhook (escopo webhooks:manage) */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description webhook removido */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description não autenticado */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description papel insuficiente (requer ADMIN/OWNER) */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description não encontrado */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
                /** @description rate limit — aguarde e tente de novo */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["Error"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/.well-known/oauth-authorization-server": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** GET /.well-known/oauth-authorization-server */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description resposta — veja o código / TESTING.md */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/.well-known/oauth-protected-resource": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** GET /.well-known/oauth-protected-resource */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description resposta — veja o código / TESTING.md */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/.well-known/oauth-protected-resource/mcp": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** GET /.well-known/oauth-protected-resource/mcp */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description resposta — veja o código / TESTING.md */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/oauth/register": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** POST /oauth/register */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": Record<string, never>;
                };
            };
            responses: {
                /** @description resposta — veja o código / TESTING.md */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/oauth/authorize": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** GET /oauth/authorize */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description resposta — veja o código / TESTING.md */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/oauth/consent/context": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** GET /oauth/consent/context */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description resposta — veja o código / TESTING.md */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/oauth/consent/approve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** POST /oauth/consent/approve */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": Record<string, never>;
                };
            };
            responses: {
                /** @description resposta — veja o código / TESTING.md */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/oauth/consent/deny": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** POST /oauth/consent/deny */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": Record<string, never>;
                };
            };
            responses: {
                /** @description resposta — veja o código / TESTING.md */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/oauth/token": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** POST /oauth/token */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": Record<string, never>;
                };
            };
            responses: {
                /** @description resposta — veja o código / TESTING.md */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/mcp/.well-known/oauth-protected-resource": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** GET /mcp/.well-known/oauth-protected-resource */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description resposta — veja o código / TESTING.md */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/mcp/.well-known/oauth-protected-resource/mcp": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** GET /mcp/.well-known/oauth-protected-resource/mcp */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description resposta — veja o código / TESTING.md */
                default: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
};
export type webhooks = Record<string, never>;
export type components = {
    schemas: {
        Me: {
            /** @enum {string} */
            kind: "user";
            orgId: string;
            role: string;
            user: {
                id: string;
                email: string;
                name: string | null;
                avatarUrl: string | null;
            } | null;
        };
        Error: {
            /** @example about:blank */
            type: string;
            /**
             * @description código estável do erro
             * @example common.not_found
             */
            title: string;
            /** @example 404 */
            status: number;
            /** @example post não encontrado */
            detail?: string;
            /** @description campos extras (ex.: issues de validação) */
            extra?: unknown;
        };
        ApiKey: {
            id: string;
            name: string;
            prefix: string;
            scopes: string[];
            lastUsedAt: string | null;
            revokedAt: string | null;
            createdAt: string;
        };
        Channel: {
            id: string;
            /** @example mastodon */
            provider: string;
            externalId: string;
            name: string | null;
            username: string | null;
            avatarUrl: string | null;
            /** @example ACTIVE */
            status: string;
            scopes: string[] | null;
        };
        ProviderMediaRule: {
            maxCount: number;
            mimeTypes: string[];
            maxBytes?: number;
            minWidth?: number;
            minHeight?: number;
            maxDurationSec?: number;
        };
        ChannelProviderInfo: {
            id: string;
            name: string;
            /** @enum {string} */
            editor: "plain" | "rich" | "markdown" | "html";
            threads: boolean;
            twoStepConnect: boolean;
            /** @description rede que não aceita post só-texto (ex.: TikTok exige vídeo/foto) */
            requiresMedia: boolean;
            /**
             * @description fields = credenciais; oauth = redirect
             * @enum {string}
             */
            connectType: "fields" | "oauth";
            /** @description limite base de caracteres (sem settings do canal — ex.: X verified pode ser maior) */
            maxLength: number;
            media: {
                images: components["schemas"]["ProviderMediaRule"];
                videos: components["schemas"]["ProviderMediaRule"];
            };
            /** @description JSON Schema dos settings de publicação do provider — é o formato aceito em `settingsByChannel` do POST /v1/posts; a UI renderiza o formulário "Configurações" por canal a partir dele */
            settingsSchema: {
                [key: string]: unknown;
            };
            /** @description JSON Schema dos campos de conexão — é o formato aceito em `fields` do POST /v1/channels/connect; presente só quando o provider pede credenciais/instância (a UI renderiza o formulário de conexão a partir dele; ausente = OAuth sem campos) */
            connectionFieldsSchema?: {
                [key: string]: unknown;
            };
            /** @description feature de plano exigida por esta rede no serviço gerenciado (ex.: `x_network`); ausente = incluída em todos os planos. Em self-hosted nunca é imposta */
            requiredFeature?: string;
            /** @description false = rede implementada, mas SEM as credenciais de app no env desta instalação; `POST /connect` responde 404 até configurar */
            available: boolean;
            /** @description variáveis de ambiente que faltam para habilitar a rede (ex.: `["THREADS_APP_ID"]`). Só vem em instalação self-hosted, onde quem opera é quem usa; no serviço gerenciado é omitido */
            setupEnv?: string[];
        };
        MediaRef: {
            mediaId?: string;
            /** @example image */
            type: string;
            url: string;
            /** @example image/png */
            mime: string;
            alt?: string | null;
        };
        Publication: {
            id: string;
            channelId: string;
            /** @example SCHEDULED */
            state: string;
            media: components["schemas"]["MediaRef"][];
            /** @description itens da thread (1 = post simples) */
            itemCount: number;
            /** @description cursor da thread: itens ≤ este índice já estão na rede */
            lastPublishedIndex: number | null;
            attemptCount: number;
            externalId: string | null;
            releaseUrl: string | null;
            errorClass: string | null;
            errorMessage: string | null;
        };
        PostGroup: {
            id: string;
            /** @example SCHEDULED */
            state: string;
            /** Format: date-time */
            publishAt: string | null;
            publications: components["schemas"]["Publication"][];
        };
        PublicationThreadItem: {
            text: string;
            delaySec: number;
            media: components["schemas"]["MediaRef"][];
        };
        PublicationDetail: components["schemas"]["Publication"] & {
            /** @description texto do item 0 neste canal (override incluído) */
            text: string;
            /** @description settings de publicação do canal (inclui defaults do settingsSchema) */
            settings: {
                [key: string]: unknown;
            };
            /** @description réplicas encadeadas (posições ≥ 1; vazio = post simples) */
            thread: components["schemas"]["PublicationThreadItem"][];
        };
        PostGroupDetail: {
            id: string;
            /** @example SCHEDULED */
            state: string;
            /** Format: date-time */
            publishAt: string | null;
            /** @description texto base do grupo (sem overrides por canal) */
            text: string;
            publications: components["schemas"]["PublicationDetail"][];
        };
        ApprovalLink: {
            /** @description token opaco ≥256 bits — só aparece aqui */
            token: string;
            url: string;
            /** Format: date-time */
            expiresAt: string;
        };
        ApprovalLinkStatus: {
            /** @example PENDING */
            status: string;
            feedback: string | null;
            approverName: string | null;
            /** Format: date-time */
            expiresAt: string;
            /** Format: date-time */
            resolvedAt: string | null;
            /** Format: date-time */
            createdAt: string;
        } | null;
        FeedItem: {
            id: string;
            groupId: string;
            channelId: string;
            /** @example PUBLISHED */
            state: string;
            /** Format: date-time */
            publishAt: string | null;
            /**
             * Format: date-time
             * @description quando a entrega aconteceu
             */
            publishedAt: string | null;
            /**
             * Format: date-time
             * @description última mutação da linha — ordena atividade recente
             */
            updatedAt: string;
            text: string;
            mediaCount: number;
            externalId: string | null;
            releaseUrl: string | null;
            errorClass: string | null;
            errorMessage: string | null;
            attemptCount: number;
            group: {
                state: string;
                /** @example WEB */
                origin: string;
                awaitingApproval: boolean;
            };
            channel: {
                provider: string;
                name: string;
                username: string | null;
                avatarUrl: string | null;
            };
        };
        PublicationFeed: {
            items: components["schemas"]["FeedItem"][];
            /** @description cursor keyset da próxima página */
            nextCursor: string | null;
        };
        Media: {
            id: string;
            /** @description URL pública (as redes baixam por aqui) */
            url: string;
            /** @example image/png */
            mime: string;
            /** @description `ai` = gerada por IA; `upload` = enviada por alguém */
            source: string;
            byteSize: number;
            width: number | null;
            height: number | null;
            alt: string | null;
            /** Format: date-time */
            createdAt: string;
        };
        Webhook: {
            id: string;
            name: string;
            url: string;
            events: string[];
            channelIds: string[];
            /** Format: date-time */
            disabledAt: string | null;
            /** Format: date-time */
            createdAt: string;
        };
        WebhookCreated: {
            /** @description whsec_… — só aparece nesta resposta */
            secret: string;
            webhook: components["schemas"]["Webhook"];
        };
        Notification: {
            id: string;
            /** @example approval.resolved */
            kind: string;
            title: string;
            body: string | null;
            link: string | null;
            /** Format: date-time */
            readAt: string | null;
            /** Format: date-time */
            createdAt: string;
        };
        Capabilities: {
            billingEnabled: boolean;
            selfHosted: boolean;
            plan: {
                /** @enum {string} */
                tier: "FREE" | "PRO" | "PREMIUM";
                /** @enum {string|null} */
                status: "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED" | "INCOMPLETE" | null;
                /** @enum {string|null} */
                period: "MONTHLY" | "YEARLY" | null;
                currentPeriodEnd: string | null;
                cancelAt: string | null;
                features: string[];
                limits: {
                    /** @description -1 = ilimitado */
                    channels: number;
                    postsPerMonth: number;
                    webhooks: number;
                    apiKeys: number;
                };
                usage: {
                    channels: number;
                    postsThisMonth: number;
                    webhooks: number;
                    apiKeys: number;
                };
                enforced: boolean;
            };
            ai: {
                enabled: boolean;
                canDescribeImages: boolean;
                canGenerateImages: boolean;
                credits: {
                    granted: number;
                    used: number;
                    /** @description gerações em voo */
                    reserved: number;
                    remaining: number;
                    periodEnd: string;
                    /** @description false = self-hosted: contabiliza, mas nunca recusa */
                    enforced: boolean;
                } | null;
            };
            endpoints: {
                /** @example https://api.manypost.com.br/v1 */
                restBaseUrl: string;
                /** @example https://mcp.manypost.com.br */
                mcpUrl: string;
            };
        };
        ChannelNeedingAction: {
            channelId: string;
            provider: string;
            name: string | null;
            /** @description REFRESH_REQUIRED | PENDING_ACCOUNT_SELECTION | DISABLED */
            status: string;
        };
        InsightsSummary: {
            /** @description fuso em que as fronteiras de dia foram resolvidas — a resposta diz qual usou */
            timezone: string;
            attention: {
                failed: number;
                /** @description desfecho incerto: nunca retentado sozinho, espera decisão humana */
                needsReview: number;
                /** @description por GRUPO, não por publicação */
                awaitingApproval: number;
                /** @description saiu em algumas redes e não em outras */
                partial: number;
                channels: components["schemas"]["ChannelNeedingAction"][];
                /** @description 0 = a interface esconde o bloco inteiro */
                total: number;
            };
            today: {
                scheduled: number;
                published: number;
                failed: number;
            };
            week: {
                scheduled: number;
                /** @description 7 posições, índice 0 = hoje no fuso pedido */
                byDay: number[];
            };
            /**
             * @description organização sem o que operar. A interface troca os blocos operacionais por próximos passos em vez de mostrar uma grade de zeros. null = já está operando.
             * @enum {string|null}
             */
            firstRun: "no_channels" | "no_posts" | null;
        };
        SearchHit: {
            groupId: string;
            /** @example DRAFT */
            state: string;
            /** Format: date-time */
            publishAt: string | null;
            /** @description excerto de até 160 caracteres */
            text: string;
            channels: {
                provider: string;
                name: string;
            }[];
        };
        SearchResults: {
            items: components["schemas"]["SearchHit"][];
        };
        AiVariant: {
            channelId: string;
            text: string;
            maxLength: number;
            /** @description true = o texto passou do limite do canal e foi cortado */
            shortened: boolean;
        };
        AiRewriteResult: {
            /** @description null = reescrita sem canal */
            channelId: string | null;
            text: string;
            maxLength: number | null;
            /** @description true = passou do limite do canal, e nada foi removido por isso */
            overLimit: boolean;
        };
        AiPlannedSlot: {
            channelId: string;
            topic: string;
            text: string;
            /** Format: date-time */
            publishAt: string;
            maxLength: number;
            shortened: boolean;
        };
        AiGeneratedMedia: {
            id: string;
            url: string;
            mime: string;
            byteSize: number;
            width: number | null;
            height: number | null;
            alt: string | null;
            /** @description `ai` = gerada; `upload` = enviada por alguém */
            source: string;
        };
        AiBestTimes: {
            channelId: string;
            timezone: string;
            slots: {
                /** @description 0 = domingo … 6 = sábado */
                weekday: number;
                hour: number;
                score: number;
            }[];
            /** @enum {string} */
            confidence: "low" | "medium" | "high";
            /** @description publicações da própria organização que sustentam a resposta */
            sampleSize: number;
            /** @description true = veio da linha de base da rede, sem histórico próprio */
            fromBaseline: boolean;
            /**
             * @description o que sustenta a resposta. `own_posting_history` = os horários que a organização MAIS USA neste canal, não uma medição de desempenho — enquanto for esse o sinal, `confidence` não passa de `medium`. `own_engagement` depende da coleta de métricas, que ainda não existe.
             * @enum {string}
             */
            signal: "network_baseline" | "own_posting_history" | "own_engagement";
        };
        PlanCatalog: {
            currency: string;
            trialDays: number;
            plans: {
                /** @enum {string} */
                tier: "FREE" | "PRO" | "PREMIUM";
                name: string;
                limits: {
                    channels: number;
                    postsPerMonth: number;
                    webhooks: number;
                    apiKeys: number;
                };
                features: string[];
                prices: {
                    MONTHLY: number | null;
                    YEARLY: number | null;
                };
            }[];
        };
        BillingState: {
            plan: {
                /** @enum {string} */
                tier: "FREE" | "PRO" | "PREMIUM";
                /** @enum {string|null} */
                status: "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED" | "INCOMPLETE" | null;
                /** @enum {string|null} */
                period: "MONTHLY" | "YEARLY" | null;
                currentPeriodEnd: string | null;
                cancelAt: string | null;
                limits: {
                    channels: number;
                    postsPerMonth: number;
                    webhooks: number;
                    apiKeys: number;
                };
                features: string[];
                usage: {
                    channels: number;
                    postsThisMonth: number;
                    webhooks: number;
                    apiKeys: number;
                };
                enforced: boolean;
            };
            subscription: {
                /** @enum {string} */
                tier: "FREE" | "PRO" | "PREMIUM";
                /** @enum {string|null} */
                period: "MONTHLY" | "YEARLY" | null;
                /** @enum {string} */
                status: "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED" | "INCOMPLETE";
                currentPeriodEnd: string | null;
                cancelAt: string | null;
                identifier: string | null;
            } | null;
        };
        ApprovalPreview: {
            /** @example PENDING */
            status: string;
            feedback: string | null;
            approverName: string | null;
            /** Format: date-time */
            expiresAt: string;
            /** Format: date-time */
            resolvedAt: string | null;
            /** Format: date-time */
            publishAt: string | null;
            timezone: string;
            publications: {
                provider: string;
                channelName: string;
                channelUsername: string | null;
                channelAvatarUrl: string | null;
                items: {
                    text: string;
                    media: {
                        type: string;
                        url: string;
                        mime: string;
                        alt?: string;
                    }[];
                    delaySec: number;
                }[];
            }[];
        };
        ApprovalResolution: {
            /** @example APPROVED */
            status: string;
            /** Format: date-time */
            resolvedAt: string | null;
            alreadyResolved?: boolean;
        };
        PubMediaRef: {
            mediaId?: string;
            /** @example image */
            type: string;
            url: string;
            /** @example image/png */
            mime: string;
            alt?: string | null;
        };
        PubPublication: {
            id: string;
            channelId: string;
            /** @example SCHEDULED */
            state: string;
            media: components["schemas"]["PubMediaRef"][];
            itemCount: number;
            lastPublishedIndex: number | null;
            attemptCount: number;
            externalId: string | null;
            releaseUrl: string | null;
            errorClass: string | null;
            errorMessage: string | null;
        };
        PubPostGroup: {
            id: string;
            /** @example SCHEDULED */
            state: string;
            /** Format: date-time */
            publishAt: string | null;
            publications: components["schemas"]["PubPublication"][];
        };
        PubFeedItem: {
            id: string;
            groupId: string;
            channelId: string;
            /** @example PUBLISHED */
            state: string;
            /** Format: date-time */
            publishAt: string | null;
            text: string;
            mediaCount: number;
            externalId: string | null;
            releaseUrl: string | null;
            errorClass: string | null;
            errorMessage: string | null;
            attemptCount: number;
            group: {
                state: string;
                origin: string;
                awaitingApproval: boolean;
            };
            channel: {
                provider: string;
                name: string;
                username: string | null;
                avatarUrl: string | null;
            };
        };
        PubPublicationFeed: {
            items: components["schemas"]["PubFeedItem"][];
            nextCursor: string | null;
        };
        PubChannel: {
            id: string;
            /** @example mastodon */
            provider: string;
            externalId: string;
            name: string | null;
            username: string | null;
            avatarUrl: string | null;
            /** @example ACTIVE */
            status: string;
            scopes: string[] | null;
        };
        PubMedia: {
            id: string;
            url: string;
            /** @example image/png */
            mime: string;
            byteSize: number;
            width: number | null;
            height: number | null;
            alt: string | null;
            /** Format: date-time */
            createdAt: string;
        };
        PubWebhook: {
            id: string;
            name: string;
            url: string;
            events: string[];
            channelIds: string[];
            /** Format: date-time */
            disabledAt: string | null;
            /** Format: date-time */
            createdAt: string;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
};
export type $defs = Record<string, never>;
export type operations = Record<string, never>;
