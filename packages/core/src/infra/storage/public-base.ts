/**
 * URL pública da mídia = base + chave. A base é a URL sob a qual as chaves são servidas
 * DIRETAMENTE (bucket público/CDN, ou a rota `/uploads` da própria API no self-host) —
 * as redes da família Meta e o Dev.to buscam a mídia por essa URL, sem credencial.
 */
export const joinPublicBase = (base: string, key: string) => `${base.replace(/\/+$/, '')}/${key}`;
