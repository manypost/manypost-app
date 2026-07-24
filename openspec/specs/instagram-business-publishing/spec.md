# instagram-business-publishing Specification

## Purpose
TBD - created by archiving change add-instagram-facebook-business-provider. Update Purpose after archive.
## Requirements
### Requirement: Connection through Facebook Login with Instagram publishing consent

The provider SHALL connect through the Facebook Login authorization dialog using the Meta
application credentials already configured for Facebook Pages, and SHALL exchange the authorization
code for a long-lived user token. The provider SHALL refuse the connection when the platform reports
that publishing consent was not granted.

#### Scenario: Authorization URL requests Instagram publishing scopes

- **WHEN** an operator starts a connection for the provider
- **THEN** the authorization URL SHALL point at the Facebook Login dialog, carry the configured
  application id, carry an opaque state value, and request the Instagram publishing scopes including
  `instagram_content_publish` and `pages_show_list`

#### Scenario: Authorization code is exchanged for a long-lived token

- **WHEN** the platform returns an authorization code
- **THEN** the provider SHALL exchange it for a short-lived token, exchange that for a long-lived
  token, and store the long-lived token as both the access and renewal credential

#### Scenario: Publishing consent was declined

- **WHEN** the platform reports the granted permissions and `instagram_content_publish` is absent
- **THEN** the provider SHALL reject the connection with a permission error naming the missing
  consent
- **AND** no channel SHALL be created

#### Scenario: Credential renewal re-presents the long-lived token

- **WHEN** the stored credential is renewed
- **THEN** the provider SHALL re-present the long-lived token to the token exchange endpoint and
  return the refreshed credential
- **AND** a credential that already expired SHALL surface as a renewal failure so the channel is
  marked as requiring reconnection

### Requirement: Destination account selected per publication through a Facebook Page

The channel SHALL represent the connected user account, and the destination Instagram account SHALL
be selected per publication. The provider SHALL offer as selectable accounts only the Pages that
have a linked Instagram professional account, and the persisted selection SHALL be the Page
identifier.

#### Scenario: Only Pages with a linked Instagram account are selectable

- **WHEN** the selectable accounts are listed for a connected channel
- **THEN** the result SHALL include every administered Page that reports a linked Instagram
  professional account
- **AND** Pages without a linked Instagram account SHALL be excluded

#### Scenario: Selection is labelled by the Instagram account

- **WHEN** a selectable account is returned
- **THEN** its persisted value SHALL be the Page identifier
- **AND** its display label SHALL identify the Instagram account rather than the Page when the
  handle is available

#### Scenario: Business Manager lookup is unavailable

- **WHEN** the Business Manager listing fails or is not permitted for the connected user
- **THEN** the provider SHALL still return the Pages obtained from the direct account listing
- **AND** the listing SHALL NOT fail

#### Scenario: Publication without a selected account

- **WHEN** a publication is attempted and no destination account is selected in settings
- **THEN** the provider SHALL fail with a validation error naming the missing selection
- **AND** no external request SHALL be issued

### Requirement: Publishing credentials are derived per publication and never persisted

The Page access token grants publishing rights and SHALL NOT be written to channel settings,
publication settings, selectable-account payloads or logs, because those surfaces are stored without
encryption. The provider SHALL derive the Page access token and the Instagram account identifier
from the stored user credential at publication time.

#### Scenario: Derivation resolves credential and account together

- **WHEN** a publication begins for a selected Page
- **THEN** the provider SHALL request the Page access token and the linked Instagram account
  identifier from the platform
- **AND** SHALL use the derived Page access token to authorize every publishing request for that
  publication

#### Scenario: Selectable-account payload carries no credential

- **WHEN** selectable accounts are returned to the caller
- **THEN** the payload SHALL contain no access token of any kind

#### Scenario: Page is no longer administered

- **WHEN** the platform does not return a Page access token for the selected Page
- **THEN** the provider SHALL fail with an authorization error instructing the operator to confirm
  administration of the Page and reconnect

#### Scenario: Page has no linked Instagram account at publication time

- **WHEN** the selected Page reports no linked Instagram professional account
- **THEN** the provider SHALL fail with a validation error explaining that the Page has no linked
  account
- **AND** no publication container SHALL be created

### Requirement: Publication paths for feed and story

The provider SHALL publish through the platform's two-step sequence: create a media container, wait
for the container to finish processing, then publish it. The provider SHALL support a single photo,
a single video published as a reel, a carousel of 2 to 10 items mixing photos and videos, and a
story containing exactly one media item.

#### Scenario: Single photo in the feed

- **WHEN** a publication has one photo and the feed destination
- **THEN** the provider SHALL create one container carrying the media URL and the publication text
  as caption, and SHALL publish it

#### Scenario: Single video in the feed is a reel

- **WHEN** a publication has one video and the feed destination
- **THEN** the container SHALL declare the reel media type

#### Scenario: Carousel

- **WHEN** a publication has between 2 and 10 media items and the feed destination
- **THEN** the provider SHALL create one child container per item, marked as carousel items and
  without caption
- **AND** SHALL wait for every child to finish processing before creating the parent carousel
  container carrying the caption
- **AND** SHALL publish only the parent container

#### Scenario: Story

- **WHEN** a publication has one media item and the story destination
- **THEN** the container SHALL declare the story media type

#### Scenario: Text without media is rejected

- **WHEN** a publication has no media
- **THEN** scheduling SHALL reject it, because the network does not accept text-only publications

### Requirement: Publication attempts must not duplicate content when retried

Delivery SHALL remain safe under the retry behavior of the publication state machine: a failure
SHALL either happen before anything reaches the network, or SHALL not be raised at all once the
network has accepted the publication.

#### Scenario: Story with more than one media item

- **WHEN** a publication targets the story destination with more than one media item
- **THEN** the provider SHALL fail with a validation error before issuing any external request,
  because the platform creates one story per item and a partial failure would duplicate content on
  retry

#### Scenario: Container processing fails before publication

- **WHEN** the platform reports that a container failed or expired
- **THEN** the provider SHALL fail without publishing
- **AND** because nothing was published, a retry SHALL be safe

#### Scenario: Container processing exceeds the allowed budget

- **WHEN** containers do not finish processing within the shared polling budget for the publication
- **THEN** the provider SHALL fail with a transient error
- **AND** the budget SHALL be shared across the parent and all carousel children so a single
  publication cannot exceed the stalled-publication watchdog

#### Scenario: Permalink lookup fails after publication

- **WHEN** the publication has been accepted by the platform and the follow-up permalink lookup fails
- **THEN** the provider SHALL return the published identifier successfully
- **AND** SHALL NOT raise an error, because raising one would cause the state machine to retry and
  publish the content a second time

### Requirement: Thread replies are published as comments

The provider SHALL publish thread replies as comments on the root publication, and SHALL reject
media attached to replies before scheduling.

#### Scenario: Reply becomes a comment

- **WHEN** a thread reply is published for an accepted publication
- **THEN** the provider SHALL create a comment carrying the reply text, authorized by the derived
  Page access token
- **AND** SHALL return the comment identifier

#### Scenario: Reply carrying media

- **WHEN** a thread item after the first carries media
- **THEN** scheduling SHALL reject the publication, because comments accept text only

### Requirement: External failures are classified for the retry policy

The provider SHALL classify platform failures so the publication state machine can distinguish
credential problems, transient instability and definitive refusals.

#### Scenario: Credential or authorization failure

- **WHEN** the platform reports a revoked or invalid token, a session invalidation, an account that
  is not an Instagram professional account, or a lost Page publishing authorization
- **THEN** the provider SHALL classify the failure as requiring credential renewal

#### Scenario: Transient failure

- **WHEN** the platform reports rate limiting, a server-side failure, an unknown error or a media
  download hiccup
- **THEN** the provider SHALL classify the failure as transient

#### Scenario: Definitive refusal

- **WHEN** the platform reports a daily publication limit, spam detection, a restricted account, an
  unsupported media format or aspect ratio, or a caption that is too long
- **THEN** the provider SHALL classify the failure as permanent, because retrying cannot succeed

