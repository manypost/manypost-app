## Why

The AI surface shipped in `add-ai-content-assistance` can destroy a person's
work. In the composer's global tab, the rewrite action sends only
`channelIds[0]` and the use case then shortens the model's answer to *that*
channel's limit before the component replaces the whole editor. Selecting X
(280) and LinkedIn (3000), then asking to fix spelling on a 1200-character
draft, silently deletes about 920 characters. The response already reports
`shortened: true` and no part of the interface reads that field.

The same tab charges for work it throws away: the caption action sends every
selected channel, the use case bills one credit per channel and calls the model
once per channel, and the component applies `variants[0]` to the shared text.
Five channels cost five credits and four adapted captions are discarded before
anyone sees them — under a control named "adapt to the network", which is the
one promise the pricing page makes about this feature.

Two smaller honesty gaps travel with these. `posting-time-suggestions` scores
how often the organization *published* at each hour, and the interface labels
medium and high confidence "based on your history", which reads as a claim about
performance that no collected data supports. And the whole surface bypasses
`next-intl` — about forty literal strings, including the seven rewrite
instructions, which are not UI labels at all but Portuguese prompt text sent to
the model.

## What Changes

- **BREAKING (internal API shape, additive at the transport level):**
  `POST /v1/ai/rewrite` stops truncating. `channelId` becomes optional, and the
  response reports `maxLength: number | null` plus a new `overLimit: boolean`
  instead of a silently shortened text. Rewriting is the one operation whose
  input is the user's own words; deleting part of them to fit a limit the user
  never chose is never the right trade. The channel limit keeps being enforced
  where it always was — at schedule time, by validation the composer already
  runs and displays.
- Caption results are applied **per channel**, as text overrides, using the
  mechanism the multichannel draft already uses (`setOverride` + `bumpEditors`).
  Nothing generated is discarded, and the credits spent match the results kept.
- Thread items offer only the operations that make sense for a text shared by
  several networks: rewrite and hashtags, resolved against the tightest limit
  among the selected channels. "Adapt to the network" disappears there, because
  a single thread reply cannot be adapted to five networks at once.
- `shortened` is rendered. Caption and draft results that the system had to cut
  say so, inline, next to the text they affected.
- `GET /v1/ai/best-times` gains `signal: 'own_posting_history' | 'network_baseline'`,
  and `confidence` is capped at `medium` while no engagement data exists. The
  interface describes the signal it actually has: "your most used times on this
  channel", not "based on your history".
- The rewrite instructions move to `packages/core/src/application/prompts/` and
  are selected by id (`rewrite.shorten`, `rewrite.formal`, …). The client sends
  an id; the server owns the sentence. A free-text `instruction` remains
  accepted for API and MCP callers.
- Every string in the AI surface moves to `apps/web/src/messages/pt-BR.json`.
- Loading and error states use the design system rather than working around it:
  the trigger uses `Button isLoading` (which already sets `aria-busy` and
  preserves the label), results are announced through a polite live region,
  the disabled alt-text button explains itself through `Tooltip` instead of a
  native `title` no screen reader reliably reads, and continuous spinners
  respect `prefers-reduced-motion`.
- The alt-text button gains the upgrade path the other three AI controls have.

## Capabilities

**New Capabilities:** none.

**Modified Capabilities:**

- `ai-content-generation` — rewrite no longer shortens; caption results are
  addressed per channel; instruction selection by id; `shortened` must be
  reportable to the person.
- `posting-time-suggestions` — the response must name its signal, and confidence
  must not claim more than the data supports.

## Impact

- **Code:** `packages/core/src/application/use-cases/ai.ts`,
  `packages/core/src/application/use-cases/ai-best-times.ts`,
  `packages/core/src/application/prompts/index.ts`,
  `apps/api/src/http/routes/ai.routes.ts`, `apps/api/src/mcp/mcp-server.ts`,
  all of `apps/web/src/features/ai/`,
  `apps/web/src/features/composer/composer-view.tsx`,
  `apps/web/src/messages/pt-BR.json`.
- **API:** `/v1/ai/rewrite` request and response shapes change as described;
  `/v1/ai/best-times` gains a field. Both are regenerated into
  `apps/web/openapi.json` and `apps/web/src/lib/api/schema.d.ts`.
- **Data:** none. No migration, no schema change, no persisted value rewritten.
- **Security:** narrows an existing surface. With instructions selected by id,
  the free-text instruction path stops being the default route from the browser
  into a prompt.
- **Product identity:** none. No Postiz reference is renamed or removed.
- **Railway/deploy:** nothing required. No new environment variable, no new
  service, no new queue.

## Compatibility

`/v1/ai/rewrite` is the only breaking edge, and it is young: it shipped in the
same wave, it is reachable only from an authenticated browser session (the route
group mounts `requireAuth` with human authentication and is not part of the
public API-key surface), and no MCP tool calls it. A caller that keeps sending
`channelId` and reading `text` keeps working; only the truncation disappears,
which is the defect. `maxLength` changes from `number` to `number | null` for
that route alone — `/caption` and `/draft` keep the non-null `AiVariant`.

## Rollback

Revert the branch. Nothing persisted changes, so there is no data to migrate
back. Turning the AI surface off entirely remains `AI_PROVIDER=none`, with no
deploy.
