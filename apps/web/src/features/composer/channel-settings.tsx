'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchWithClerk } from '@/lib/api/clerk-fetch';
import { ChevronDown, Settings2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DateTimePicker } from '@/components/ui/date-time-picker';
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
import { useMediaList } from '@/features/media/hooks';
import { MediaThumb } from '@/features/media/media-thumb';
import { toLocalInput } from '@/lib/datetime';
import { cn } from '@/lib/utils';
import { MediaPicker } from './media-picker';

/** Subconjunto de JSON Schema que os settingsSchema dos providers produzem (objeto raso). */
interface FieldSchema {
  type?: string;
  enum?: string[];
  default?: unknown;
  description?: string;
  minimum?: number;
  maximum?: number;
  items?: { type?: string };
  maxItems?: number;
  format?: string;
}

interface SettingsJsonSchema {
  type?: string;
  properties?: Record<string, FieldSchema>;
  required?: string[];
}

/** SelectItem do Radix não aceita value vazio — sentinela p/ "padrão da rede". */
const UNSET = '__default__';

/**
 * Campos renderizados como seletor de sub-conta (o valor vem de `/sub-accounts`, não digitado).
 * `SUB_ACCOUNT_FIELDS`, `FIELD_WIDGETS` e `TAG_BUDGET` são o mesmo padrão de registro por provider:
 * carregam a especificidade que o JSON Schema não expressa, sem embutir texto de rede na UI.
 */
const SUB_ACCOUNT_FIELDS: Record<string, string> = {
  // organização do Dev.to; lista vazia = o autor nunca publicou por uma (a API não lista
  // organizações direto), e aí publicar pelo perfil pessoal é o padrão correto
  devto: 'organizationId',
  discord: 'channelId',
  facebook: 'pageId',
  // no Instagram via Facebook Business o valor gravado também é o id da PÁGINA (a conta do
  // Instagram é resolvida por ela no publish) — o rótulo da opção é o @ da conta
  instagram: 'pageId',
};

/** Campos cujo valor é um id de mídia da org: renderizam o seletor de mídia (a plataforma
 *  resolve o id → URL no publish, via `provider.mediaSettings`). */
const MEDIA_FIELDS: Record<string, string[]> = {
  youtube: ['thumbnail'],
};

/** Campos de lista com orçamento de caracteres (não expressável em JSON Schema): mostra o contador
 *  ao vivo. YouTube soma TODAS as tags em 500 (tag com espaço gasta 2 a mais). */
const TAG_BUDGET: Record<string, Record<string, number>> = {
  youtube: { tags: 500 },
};

/** mesmo cálculo do provider do YouTube: espaço vira aspas → +2 por tag com espaço */
const budgetUsed = (items: string[]) =>
  items.reduce((total, tag) => total + tag.length + (/\s/.test(tag) ? 2 : 0), 0);

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

/** Data/hora: o schema guarda um instante ISO; o picker fala o formato local. Converte nos dois
 *  sentidos e trava o passado (min = agora). Campo opcional ganha um "limpar". */
function DateTimeField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const t = useTranslations('composer.channelSettings.widget');
  const iso = typeof value === 'string' ? value : '';
  const parsed = iso ? new Date(iso) : undefined;
  const local = parsed && !Number.isNaN(parsed.getTime()) ? toLocalInput(parsed) : '';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <DateTimePicker
        id={id}
        value={local}
        min={toLocalInput(new Date())}
        onChange={(v) => onChange(v ? new Date(v).toISOString() : undefined)}
      />
      {iso ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(undefined)}>
          {t('clear')}
        </Button>
      ) : null}
    </div>
  );
}

const isHttpUrl = (v: string) => {
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

/** URL: campo com validação inline (assinala endereço inválido antes de agendar). */
function UrlField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const v = typeof value === 'string' ? value : '';
  const invalid = v.length > 0 && !isHttpUrl(v);
  return (
    <Input
      id={id}
      type="url"
      inputMode="url"
      value={v}
      aria-invalid={invalid}
      placeholder="https://"
      onChange={(e) => onChange(e.target.value || undefined)}
      className={cn('w-full sm:w-72', invalid && 'border-state-failed')}
    />
  );
}

/** Lista editável item a item (chips), substitui a caixa de texto com vírgulas. Respeita o máximo
 *  do schema (maxItems) e, quando o provider declara orçamento de caracteres, mostra o contador. */
function ChipField({
  id,
  field,
  value,
  budget,
  onChange,
}: {
  id: string;
  field: FieldSchema;
  value: unknown;
  budget?: number;
  onChange: (value: unknown) => void;
}) {
  const items = Array.isArray(value)
    ? (value as string[])
    : Array.isArray(field.default)
      ? (field.default as string[])
      : [];
  const [draft, setDraft] = useState('');
  const max = typeof field.maxItems === 'number' ? field.maxItems : undefined;
  const atMax = max !== undefined && items.length >= max;

  const commit = (next: string[]) => onChange(next.length > 0 ? next : undefined);
  const add = (raw: string) => {
    const parts = raw
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    const next = [...items];
    for (const p of parts) {
      if (!next.includes(p) && (max === undefined || next.length < max)) next.push(p);
    }
    commit(next);
    setDraft('');
  };
  const removeAt = (i: number) => commit(items.filter((_, idx) => idx !== i));

  const used = budget ? budgetUsed(items) : 0;
  const over = budget !== undefined && used > budget;

  return (
    <div className="flex w-full flex-col gap-1 sm:w-72">
      <div className="inset-field flex flex-wrap items-center gap-1.5 rounded-md border px-2 py-1.5 transition-colors duration-200 focus-within:border-accent">
        {items.map((tag, i) => (
          <span
            key={`${tag}-${i}`}
            className="bevel-chip inline-flex items-center gap-1 rounded-sm border border-line bg-surface py-0.5 pl-2 pr-1 text-xs font-medium text-ink"
          >
            {tag}
            <button
              type="button"
              aria-label={`remover ${tag}`}
              onClick={() => removeAt(i)}
              className="rounded-sm text-mist transition-colors duration-200 hover:text-ink"
            >
              <X className="size-3" aria-hidden />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          disabled={atMax}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add(draft);
            } else if (e.key === 'Backspace' && draft === '' && items.length > 0) {
              removeAt(items.length - 1);
            }
          }}
          onBlur={() => add(draft)}
          className="min-w-[6ch] flex-1 bg-transparent text-sm outline-none placeholder:text-mist disabled:cursor-not-allowed"
        />
      </div>
      {budget !== undefined ? (
        <span className={cn('self-end text-meta', over ? 'text-state-failed' : 'text-mist')}>
          {used}/{budget}
        </span>
      ) : max !== undefined ? (
        <span className="self-end text-meta text-mist">
          {items.length}/{max}
        </span>
      ) : null}
    </div>
  );
}

/** Miniatura/imagem: escolhida na biblioteca. Guarda o id da mídia; a plataforma resolve para URL
 *  no publish. Mostra a imagem escolhida com trocar/remover. */
function MediaField({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const t = useTranslations('composer.channelSettings.widget');
  const media = useMediaList();
  const selectedId = typeof value === 'string' && value !== '' ? value : undefined;
  const item = selectedId ? (media.data ?? []).find((m) => m.id === selectedId) : undefined;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {item ? (
        <MediaThumb
          url={item.url}
          mime={item.mime}
          alt={item.alt}
          className="size-14 rounded-md border border-line object-cover"
        />
      ) : null}
      <MediaPicker
        selectedIds={selectedId ? [selectedId] : []}
        onToggle={(id) => onChange(id === selectedId ? undefined : id)}
        triggerLabel={item ? t('changeMedia') : t('chooseMedia')}
      />
      {item ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(undefined)}>
          {t('removeMedia')}
        </Button>
      ) : null}
    </div>
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
      const res = await fetchWithClerk(`/v1/channels/${channelId}/sub-accounts`, {
        credentials: 'include',
      });
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

/**
 * Configurações por canal do composer: acordeão que renderiza o formulário a
 * partir do `settingsSchema` (JSON Schema) do catálogo
 * `GET /v1/channels/providers`. O controle é escolhido pelo que o campo SIGNIFICA
 * (data, mídia, lista, URL, lista nomeada), não só pelo tipo cru — caixa de texto
 * é o último recurso. Os valores alterados viram `settingsByChannel` no POST /v1/posts.
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

  const isMediaField = (key: string) => (MEDIA_FIELDS[providerId] ?? []).includes(key);

  return (
    <div className="bevel-surface overflow-hidden rounded-md border">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'bevel-primary flex w-full items-center gap-2 border px-3 py-2.5 text-left text-sm font-semibold text-paper outline-none transition-[filter] duration-200',
          'hover:brightness-95 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
        )}
      >
        {PROVIDER_ICONS[providerId] ? (
          <img src={PROVIDER_ICONS[providerId]} alt="" aria-hidden className="size-4 rounded-sm" />
        ) : (
          <Settings2 className="size-4" aria-hidden />
        )}
        <span className="min-w-0 truncate">{t('title', { name: channelName || providerName })}</span>
        {touched ? <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-paper" /> : null}
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
              const checked = typeof value === 'boolean' ? value : field.default === true;
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
              if (isMediaField(key)) {
                return <MediaField value={value} onChange={(v) => onChange(key, v)} />;
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
              if (field.format === 'date-time') {
                return <DateTimeField id={fieldId} value={value} onChange={(v) => onChange(key, v)} />;
              }
              if (field.type === 'array') {
                return (
                  <ChipField
                    id={fieldId}
                    field={field}
                    value={value}
                    budget={TAG_BUDGET[providerId]?.[key]}
                    onChange={(v) => onChange(key, v)}
                  />
                );
              }
              if (field.format === 'uri') {
                return <UrlField id={fieldId} value={value} onChange={(v) => onChange(key, v)} />;
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
