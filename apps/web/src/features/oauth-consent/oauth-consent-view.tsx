'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchWithClerk } from '@/lib/api/clerk-fetch';
import { useApiErrorMessage } from '@/lib/api/errors';

interface ConsentContext {
  clientId: string;
  scopes: string[];
  resource: string | null;
  redirectUri: string;
  redirectIsLoopback: boolean;
  organizations: Array<{ id: string; name: string; role: string }>;
}

/** Extrai hostname do redirect para o aviso de consent (testável). */
export function consentRedirectHostname(redirectUri: string): string | null {
  try {
    return new URL(redirectUri).hostname || null;
  } catch {
    return null;
  }
}

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { detail?: string } | null;
    throw Object.assign(new Error(body?.detail ?? res.statusText), { httpStatus: res.status });
  }
  return res.json() as Promise<T>;
}

/**
 * Consentimento OAuth MCP: Clerk já autenticou; o usuário escolhe org + escopos
 * e a API emite o authorization code (cookie pending).
 */
export function OAuthConsentView() {
  const t = useTranslations('oauthConsent');
  const errorMessage = useApiErrorMessage();
  const [orgId, setOrgId] = useState('');
  const [scopes, setScopes] = useState<string[]>(['mcp:read', 'mcp:write']);

  const ctx = useQuery({
    queryKey: ['oauth-consent-context'],
    queryFn: async () => {
      const res = await fetchWithClerk('/oauth/consent/context');
      return readJson<ConsentContext>(res);
    },
    retry: false,
  });

  useEffect(() => {
    if (!ctx.data) return;
    if (!orgId && ctx.data.organizations[0]) setOrgId(ctx.data.organizations[0].id);
    if (ctx.data.scopes.length) setScopes(ctx.data.scopes);
  }, [ctx.data, orgId]);

  const approve = useMutation({
    mutationFn: async () => {
      const res = await fetchWithClerk('/oauth/consent/approve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orgId, scopes }),
      });
      return readJson<{ redirectTo: string }>(res);
    },
    onSuccess: (data) => {
      window.location.href = data.redirectTo;
    },
  });

  const deny = useMutation({
    mutationFn: async () => {
      const res = await fetchWithClerk('/oauth/consent/deny', { method: 'POST' });
      return readJson<{ redirectTo: string }>(res);
    },
    onSuccess: (data) => {
      window.location.href = data.redirectTo;
    },
  });

  if (ctx.isLoading) {
    return (
      <div className="w-full max-w-md space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (ctx.isError || !ctx.data) {
    return (
      <div className="w-full max-w-md rounded-lg border border-line bg-surface p-6">
        <h1 className="font-display text-xl font-semibold text-ink">{t('expiredTitle')}</h1>
        <p className="mt-2 text-compact leading-relaxed text-graphite">{t('expiredBody')}</p>
      </div>
    );
  }

  const data = ctx.data;
  const noOrgs = data.organizations.length === 0;
  const busy = approve.isPending || deny.isPending;
  const redirectHost = consentRedirectHostname(data.redirectUri);

  return (
    <div className="w-full max-w-md rounded-lg border border-line bg-surface p-6">
      <h1 className="font-display text-xl font-semibold text-ink">{t('title')}</h1>
      <p className="mt-2 text-compact leading-relaxed text-graphite">
        {t('subtitle', { clientId: data.clientId })}
      </p>

      {redirectHost ? (
        <div className="mt-4 rounded-md border border-line bg-canvas px-3 py-2 text-compact text-graphite">
          <p>
            {t('redirectHost', { hostname: redirectHost })}
          </p>
          {data.redirectIsLoopback ? (
            <p className="mt-1 text-ink">{t('redirectLoopbackWarning')}</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 space-y-2">
        <p className="text-compact font-semibold text-ink">{t('scopesTitle')}</p>
        <ul className="list-inside list-disc text-compact text-graphite">
          {scopes.includes('mcp:read') ? <li>{t('scopeRead')}</li> : null}
          {scopes.includes('mcp:write') ? <li>{t('scopeWrite')}</li> : null}
        </ul>
        <div className="flex flex-wrap gap-3 pt-1">
          <label className="flex items-center gap-2 text-compact text-ink">
            <input
              type="checkbox"
              className="accent-accent"
              checked={scopes.includes('mcp:read')}
              onChange={(e) => {
                setScopes((prev) =>
                  e.target.checked
                    ? [...new Set([...prev, 'mcp:read'])]
                    : prev.filter((s) => s !== 'mcp:read'),
                );
              }}
            />
            mcp:read
          </label>
          <label className="flex items-center gap-2 text-compact text-ink">
            <input
              type="checkbox"
              className="accent-accent"
              checked={scopes.includes('mcp:write')}
              onChange={(e) => {
                setScopes((prev) =>
                  e.target.checked
                    ? [...new Set([...prev, 'mcp:write'])]
                    : prev.filter((s) => s !== 'mcp:write'),
                );
              }}
            />
            mcp:write
          </label>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <Label htmlFor="oauth-org">{t('orgTitle')}</Label>
        {noOrgs ? (
          <p className="text-compact text-danger">{t('noOrgs')}</p>
        ) : (
          <select
            id="oauth-org"
            className="inset-field w-full rounded-md border border-line bg-surface px-3 py-2 text-compact text-ink"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
          >
            {data.organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {(approve.isError || deny.isError) && (
        <p className="mt-3 text-compact text-danger">
          {errorMessage(approve.error ?? deny.error)}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Button
          type="button"
          disabled={busy || noOrgs || scopes.length === 0 || !orgId}
          onClick={() => approve.mutate()}
        >
          {t('approve')}
        </Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={() => deny.mutate()}>
          {t('deny')}
        </Button>
      </div>
    </div>
  );
}
