## Context

The Meta family already proved the two shapes this provider needs. `threads` and
`instagram-standalone` established the asynchronous container flow (create container, poll status,
publish, resolve permalink best-effort). `facebook` established destination selection per
publication: the channel holds the user credential, the Page is chosen in the composer through
`listSubAccounts`, and the Page access token is derived at publish time instead of being stored.

Instagram through Facebook Business is the intersection of the two. It authenticates like
`facebook`, addresses a destination like `facebook`, and publishes like `instagram-standalone`. The
notable difference is that publishing needs **two** derived values rather than one: the Page access
token and the Instagram account identifier that owns the media endpoints.

Constraints that shaped the design:

- Channel and publication settings are stored as unencrypted JSON, so no credential may be persisted
  there.
- One channel holds exactly one credential; there is no mechanism to swap the channel credential for
  a selected sub-account.
- The composer maps one provider to one sub-account field, so a destination that needs several
  identifiers must still be expressible as one stored value.
- Publication retries are driven by a state machine that re-invokes `publish`, so any error raised
  after the network accepted a post would republish it.
- Providers receive an injected context and never read the environment or use a global fetch.

## Goals / Non-Goals

**Goals:**

- Publish to an Instagram account reached through a Page, selectable per publication.
- Keep the publishing credential out of every persisted surface.
- Preserve the family's delivery-safety properties under retry.
- Introduce no new environment variable and no new architectural pattern.

**Non-Goals:**

- Analytics, proactive credential renewal, collaborators, audio and trial reels.
- Replacing or deprecating `instagram-standalone`.
- Media storage work; public media URLs remain an external prerequisite.

## Decisions

**Store the Page identifier as the destination, and derive the Instagram account from it.**
The alternative was storing the Instagram account identifier, or both identifiers, in settings.
Storing both would require the composer's sub-account field to write two keys, widening the
sub-account contract for one provider. Storing only the Instagram identifier would still leave the
Page token underivable. Storing only the Page identifier keeps the composer contract at one field
per provider and makes the Page the single source for both derived values. The trade-off is that the
Instagram account is resolved indirectly, so a Page whose Instagram link is removed after selection
fails at publish time rather than at scheduling; the failure is explicit and names the cause.

**Derive the Page token and the Instagram account in a single request.**
`GET /{pageId}?fields=access_token,instagram_business_account{id,username}` returns both. The
alternative — two requests, or caching the derived token — was rejected because caching a publishing
credential reintroduces the storage problem this design exists to avoid, and one extra request per
publication is negligible against the container polling that follows. Deriving per publication also
guarantees a fresh token.

**Label the selection by the Instagram handle while storing the Page identifier.**
Operators recognize the Instagram account, not the Page id. `listSubAccounts` therefore fetches the
Instagram profile for each linked Page and uses the handle as the display name, falling back to the
Page name when the profile lookup fails. The lookup is best-effort so one unreadable profile cannot
empty the list.

**Ship as a separate provider rather than a mode of `instagram-standalone`.**
Postiz makes the same split, and this repository already has the precedent of `discord` and
`discord-webhook`. The two variants differ in authentication, required scopes, destination
addressing and credential lifecycle; folding them into one provider would put a mode switch in front
of nearly every method. Separate providers also let the catalogue describe each one honestly.

**Reuse the Facebook application credentials.**
Both providers are the same Meta product ("Facebook Login"). Mapping both provider ids to the same
environment pair means an installation that already enabled Facebook gains this network without
operational work. The trade-off is that the two networks cannot be enabled independently, which is
acceptable because they share the App Review anyway.

**Reject a multi-item story before any external call.**
The platform creates one story per media item. Publishing them in sequence, as the reference
implementation does, means a failure midway leaves the earlier stories published and the retry
duplicates them. Rejecting the publication up front trades a capability for a guarantee. Because the
media validation hook does not receive settings, the destination-dependent check lives in `publish`
rather than at scheduling; it still runs before any request is issued.

**Extract the shared Meta Graph helpers.**
The request wrapper and the Page discovery routine (direct listing plus Business Manager, paginated
and deduplicated) were identical to `facebook`. A third copy was the alternative. The shared module
takes the field list as a parameter, which is the only thing that differed. `facebook` keeps its
golden tests as the regression guard for the extraction.

## Risks / Trade-offs

- **A future change persists the derived Page token for convenience** → The requirement forbidding it
  is explicit, and a test asserts the serialized sub-account payload contains no token.
- **The Instagram link is removed between selection and publication** → Publication fails with a
  message naming the missing link rather than a generic platform error.
- **A carousel of large videos exhausts the polling budget** → The budget is shared across parent and
  children and sized under the stalled-publication watchdog; exceeding it is transient and nothing
  has been published, so the retry is safe.
- **The shared helper extraction changes `facebook` behavior** → The extraction is a move with the
  field list parameterized; `facebook`'s existing golden tests cover the request URLs and ordering.
- **Media publishing fails in development** → Meta fetches media from a public URL, so `localhost`
  cannot work. This is a known family-wide prerequisite, not specific to this change; it is called
  out in the setup guide.

## Migration Plan

No data migration. Deployment is a redeploy of the application; the network appears in the catalogue
for installations that already configured the Facebook application credentials, and the redirect URI
for the new provider callback must be registered in the Meta application before operators can
connect. Rollback is a redeploy of the previous revision plus removal from the registry; nothing
persisted needs reversal, though channels connected in the meantime would require reconnection to a
different network.

## Open Questions

- Proactive credential renewal for the whole Meta family remains undecided. Renewal is reactive, so a
  credential that expires without being used leaves the channel requiring reconnection. This affects
  all four Meta providers equally and should be resolved as one decision rather than per provider.
- Whether analytics for the Meta family arrives as a shared capability or per provider is still open;
  the insight scope is requested at connection time so it does not require reconsent later.
