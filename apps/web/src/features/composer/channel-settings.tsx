'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Settings2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { PROVIDER_ICONS } from '@/features/channels/provider-icon';
import { cn } from '@/lib/utils';

/** Subconjunto de JSON Schema que os settingsSchema dos providers produzem (objeto raso). */
interface FieldSchema {
  type?: string;
  enum?: string[];
  default?: unknown;
  description?: string;
  minimum?: number;
  maximum?: number;
  items?: { type?: string };
  format?: string;
}

interface SettingsJsonSchema {
  type?: string;
  properties?: Record<string, FieldSchema>;
  required?: string[];
}

/** SelectItem do Radix não aceita value vazio — sentinela p/ "padrão da rede". */
const UNSET = '__default__';

const parseList = (raw: string) =>
  raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

/** Texto cru em estado local: normalizar a cada tecla engoliria a vírgula recém-digitada. */
function ArrayField({
  id,
  field,
  value,
  onChange,
}: {
  id: string;
  field: FieldSchema;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const committed = Array.isArray(value)
    ? (value as string[])
    : Array.isArray(field.default)
      ? (field.default as string[])
      : [];
  const [raw, setRaw] = useState(committed.join(', '));
  return (
    <Input
      id={id}
      value={raw}
      onChange={(e) => {
        setRaw(e.target.value);
        const parsed = parseList(e.target.value);
        onChange(parsed.length > 0 ? parsed : undefined);
      }}
      onBlur={() => setRaw((prev) => parseList(prev).join(', '))}
      className="w-full sm:w-56"
    />
  );
}

function EnumField({
  id,
  field,
  value,
  optionLabel,
  unsetLabel,
  onChange,
}: {
  id: string;
  field: FieldSchema;
  value: unknown;
  optionLabel: (option: string) => string;
  unsetLabel: string;
  onChange: (value: unknown) => void;
}) {
  const hasDefault = field.default !== undefined;
  const current =
    typeof value === 'string' ? value : hasDefault ? (field.default as string) : UNSET;
  return (
    <Select
      value={current}
      onValueChange={(v) => onChange(v === UNSET || v === field.default ? undefined : v)}
    >
      <SelectTrigger id={id} className="w-full sm:w-56">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {!hasDefault ? <SelectItem value={UNSET}>{unsetLabel}</SelectItem> : null}
        {(field.enum ?? []).map((option) => (
          <SelectItem key={option} value={option}>
            {optionLabel(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Seletor de sub-conta (canal de texto do Discord, Página do Facebook…) alimentado por
 * `GET /v1/channels/:id/sub-accounts`. Genérico: os rótulos vêm do i18n por `providerId`, com um
 * fallback comum — nenhum texto de rede fica embutido aqui.
 */
function SubAccountsField({
  id,
  providerId,
  channelId,
  value,
  onChange,
}: {
  id: string;
  providerId: string;
  channelId?: string;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const t = useTranslations('composer.channelSettings.subAccount');
  const label = (key: string) =>
    t.has(`${providerId}.${key}`) ? t(`${providerId}.${key}`) : t(key);

  const { data: channels = [], isLoading } = useQuery({
    queryKey: ['sub-accounts', channelId],
    queryFn: async () => {
      if (!channelId) return [];
      const res = await fetch(`/v1/channels/${channelId}/sub-accounts`, { credentials: 'include' });
      if (!res.ok) return [];
      return (await res.json()) as Array<{ externalId: string; name: string }>;
    },
    enabled: Boolean(channelId),
    staleTime: 60_000,
  });

  const current = typeof value === 'string' && value !== '' ? value : UNSET;

  return (
    <Select value={current} onValueChange={(v) => onChange(v === UNSET ? undefined : v)}>
      <SelectTrigger id={id} className="w-full sm:w-64">
        <SelectValue placeholder={isLoading ? label('loading') : label('select')} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNSET}>{label('unset')}</SelectItem>
        {channels.map((c) => (
          <SelectItem key={c.externalId} value={c.externalId}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Campos renderizados como seletor de sub-conta (o valor vem de `/sub-accounts`, não digitado). */
const SUB_ACCOUNT_FIELDS: Record<string, string> = {
  discord: 'channelId',
  facebook: 'pageId',
  // no Instagram via Facebook Business o valor gravado também é o id da PÁGINA (a conta do
  // Instagram é resolvida por ela no publish) — o rótulo da opção é o @ da conta
  instagram: 'pageId',
};

/**
 * Configurações por canal do composer: acordeão que renderiza o formulário a
 * partir do `settingsSchema` (JSON Schema) do catálogo
 * `GET /v1/channels/providers` — nada aqui conhece providers específicos; os
 * valores alterados viram `settingsByChannel` no POST /v1/posts.
 */
export function ChannelSettingsCard({
  channelId,
  providerId,
  providerName,
  channelName,
  schema,
  values,
  onChange,
}: {
  channelId?: string;
  providerId: string;
  providerName: string;
  channelName: string;
  schema: Record<string, unknown>;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  const t = useTranslations('composer.channelSettings');
  const [open, setOpen] = useState(false);
  const baseId = useId();

  const properties = (schema as SettingsJsonSchema).properties ?? {};
  const required = new Set((schema as SettingsJsonSchema).required ?? []);
  const keys = Object.keys(properties);
  if (keys.length === 0) return null;

  const renderLabel = (key: string) => (
    <Label htmlFor={`${baseId}-${key}`}>
      {label(key)}
      {required.has(key) ? (
        <span aria-hidden className="ml-0.5 text-state-failed">
          *
        </span>
      ) : null}
    </Label>
  );

  const touched = Object.keys(values).length > 0;
  const label = (key: string) =>
    t.has(`fields.${providerId}.${key}`) ? t(`fields.${providerId}.${key}`) : key;
  const hint = (key: string, field: FieldSchema) =>
    t.has(`hints.${providerId}.${key}`) ? t(`hints.${providerId}.${key}`) : field.description;
  const optionLabel = (key: string) => (option: string) =>
    t.has(`options.${providerId}.${key}.${option}`)
      ? t(`options.${providerId}.${key}.${option}`)
      : option;
  // Campo opcional sem default: "Padrão da rede" não diz nada. Quando o comportamento de não
  // escolher tem nome (em X, não limitar resposta = qualquer pessoa), o i18n dá o nome dele.
  const unsetLabel = (key: string) =>
    t.has(`unset.${providerId}.${key}`) ? t(`unset.${providerId}.${key}`) : t('default');

  return (
    <div className="overflow-hidden rounded-md border border-line bg-surface">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'bevel-surface flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-accent outline-none transition-colors duration-200',
          'hover:text-accent-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
        )}
      >
        {PROVIDER_ICONS[providerId] ? (
          <img src={PROVIDER_ICONS[providerId]} alt="" aria-hidden className="size-4 rounded-sm" />
        ) : (
          <Settings2 className="size-4" aria-hidden />
        )}
        <span className="min-w-0 truncate">{t('title', { name: channelName || providerName })}</span>
        {touched ? <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-accent" /> : null}
        <ChevronDown
          aria-hidden
          className={cn('ml-auto size-4 shrink-0 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>

      {open ? (
        <div className="flex flex-col gap-4 border-t border-line p-3">
          {keys.map((key) => {
            const field = properties[key]!;
            const fieldId = `${baseId}-${key}`;
            const value = values[key];
            const description = hint(key, field);

            if (field.type === 'boolean') {
              const checked =
                typeof value === 'boolean' ? value : field.default === true;
              return (
                <div key={key} className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    {renderLabel(key)}
                    {description ? (
                      <span className="text-xs leading-relaxed text-graphite">{description}</span>
                    ) : null}
                  </div>
                  <Switch
                    id={fieldId}
                    checked={checked}
                    onCheckedChange={(v) =>
                      onChange(key, v === (field.default === true) ? undefined : v)
                    }
                  />
                </div>
              );
            }

            const inner = (() => {
              if (SUB_ACCOUNT_FIELDS[providerId] === key) {
                return (
                  <SubAccountsField
                    id={fieldId}
                    providerId={providerId}
                    channelId={channelId}
                    value={value}
                    onChange={(v) => onChange(key, v)}
                  />
                );
              }
              if (field.enum) {
                return (
                  <EnumField
                    id={fieldId}
                    field={field}
                    value={value}
                    optionLabel={optionLabel(key)}
                    unsetLabel={unsetLabel(key)}
                    onChange={(v) => onChange(key, v)}
                  />
                );
              }
              if (field.type === 'array') {
                return (
                  <ArrayField id={fieldId} field={field} value={value} onChange={(v) => onChange(key, v)} />
                );
              }
              if (field.type === 'integer' || field.type === 'number') {
                const current =
                  typeof value === 'number' ? value : typeof field.default === 'number' ? field.default : '';
                return (
                  <Input
                    id={fieldId}
                    type="number"
                    min={field.minimum}
                    max={field.maximum}
                    value={current}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') return onChange(key, undefined);
                      const n = Number(raw);
                      onChange(key, Number.isNaN(n) || n === field.default ? undefined : n);
                    }}
                    className="w-full sm:w-32"
                  />
                );
              }
              return (
                <Input
                  id={fieldId}
                  value={typeof value === 'string' ? value : ''}
                  onChange={(e) => onChange(key, e.target.value || undefined)}
                  className="w-full sm:w-56"
                />
              );
            })();

            return (
              <div key={key} className="flex flex-col gap-1.5">
                {renderLabel(key)}
                {inner}
                {description ? (
                  <span className="text-xs leading-relaxed text-graphite">{description}</span>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
