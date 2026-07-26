## ADDED Requirements

### Requirement: Connection through Google OAuth with a durable refresh token

The provider SHALL authenticate through Google's OAuth 2.0 authorization-code flow and SHALL request
offline access with a forced consent prompt, so that a refresh token is issued on every connection
rather than only on an account's first ever consent. The provider SHALL request the smallest scope
set that supports publishing, and SHALL NOT request a scope for a capability the installation has
not enabled.

#### Scenario: Authorization request forces a refresh token

- **WHEN** an operator starts a connection
- **THEN** the authorization URL SHALL carry `access_type=offline` and `prompt=consent`
- **AND** SHALL request `youtube.upload` and `youtube.readonly` together with the profile scopes
  needed to identify the account
- **AND** SHALL NOT request the analytics scope unless the installation enabled analytics

#### Scenario: Connection without a refresh token is refused

- **WHEN** the token exchange returns no refresh token
- **THEN** the connection SHALL fail with a readable error telling the operator to reconnect
- **AND** no channel SHALL be created, because a channel without a refresh token dies silently at
  the first token expiry

#### Scenario: Publishing scope withheld is refused at connection

- **WHEN** the granted scopes omit `youtube.upload`
- **THEN** the connection SHALL fail naming the missing permission
- **AND** no channel SHALL be created

#### Scenario: Expired access token is renewed without operator action

- **WHEN** a stored access token has expired and a refresh token is held
- **THEN** the provider SHALL obtain a new access token from the refresh token
- **AND** SHALL preserve the existing refresh token when the platform does not return a new one

#### Scenario: Revoked authorization is reported as needing reconnection

- **WHEN** the platform rejects the refresh token as revoked or invalid
- **THEN** the error SHALL be classified as requiring reconnection rather than retried

### Requirement: Channel identity is bound at connection, not chosen per publication

The platform binds an access token to a single channel, chosen by the person in the platform's own
account chooser during consent; an authenticated session reports exactly one channel. The provider
SHALL therefore resolve the channel at connection time and SHALL NOT offer a per-publication
destination field, which would be a control with one option that cannot change the outcome.

#### Scenario: Connection identifies the channel the token acts on

- **WHEN** a connection completes
- **THEN** the provider SHALL resolve the authenticated channel from the platform
- **AND** SHALL use the channel identifier as the external identifier of the connection
- **AND** SHALL use the channel title and avatar as the connection's display identity

#### Scenario: A second channel of the same account is a second connection

- **WHEN** an operator connects again and selects a different channel in the platform's chooser
- **THEN** a separate channel SHALL be created, because the external identifier differs
- **AND** reconnecting the same channel SHALL update the existing channel rather than duplicate it

#### Scenario: An account with no channel is refused

- **WHEN** the authenticated account has no YouTube channel
- **THEN** the connection SHALL fail with a readable error
- **AND** no channel SHALL be created

### Requirement: Video upload through the resumable protocol

The provider SHALL upload the video using the platform's resumable upload protocol. The provider
SHALL NOT buffer the entire file in memory, because a publication's video may be far larger than a
worker's memory budget.

#### Scenario: Upload session is initiated with the file's size and type

- **WHEN** a publication with a video is published
- **THEN** the provider SHALL open an upload session declaring the byte length and content type of
  the source
- **AND** SHALL send the video metadata as the body of that initiating request
- **AND** SHALL stream the source bytes into the session URL returned by the platform

#### Scenario: Source that cannot be read fails before the session opens

- **WHEN** the media URL cannot be fetched, or the response declares no length
- **THEN** the publication SHALL fail before an upload session is opened, with a message naming the
  unreachable media

#### Scenario: A publication carries exactly one video

- **WHEN** a publication for this provider carries no video, more than one video, or an image
- **THEN** validation SHALL reject it naming the rule
- **AND** the rejection SHALL happen at scheduling time

#### Scenario: Interrupted upload is retried without creating a second video

- **WHEN** the upload session fails after the platform has accepted the video
- **THEN** the provider SHALL NOT restart the upload as a new video
- **AND** the error SHALL be classified so the publication is not reposted

### Requirement: Shorts intent is enforced against the file, not assumed

The platform exposes no parameter that marks an upload as a Short; it classifies the video from its
geometry and duration. The provider SHALL therefore read the video's width, height and duration from
the container header and SHALL refuse a publication whose declared intent the file cannot satisfy,
before any upload begins.

#### Scenario: Intent "short" with a file that cannot become one is refused

- **WHEN** a publication declares the intent `short`
- **AND** the video is wider than it is tall, or its duration exceeds the platform's Shorts ceiling
- **THEN** the publication SHALL be refused before the upload session is opened
- **AND** the message SHALL state the measured geometry or duration and the rule it violates

#### Scenario: Intent "video" with a file that would become a Short is refused

- **WHEN** a publication declares the intent `video`
- **AND** the file is vertical and within the Shorts duration ceiling
- **THEN** the publication SHALL be refused before upload, because the platform would classify it as
  a Short against the operator's stated intent

#### Scenario: Intent "auto" accepts either outcome

- **WHEN** a publication declares the intent `auto`
- **THEN** the provider SHALL upload the file whatever its geometry
- **AND** SHALL record which product the file will become, so the operator can see it afterwards

#### Scenario: Unreadable container does not block an automatic publication

- **WHEN** the container header cannot be parsed
- **AND** the declared intent is `auto`
- **THEN** the upload SHALL proceed, because the platform's own classification is authoritative
- **AND** WHEN the declared intent is `short` or `video`, the publication SHALL be refused, because
  the stated intent cannot be verified

### Requirement: Publication metadata

The provider SHALL send the title, description, category, privacy status and the child-directed
declaration with every upload. The title SHALL be a required setting; the platform rejects an upload
without one, and a publication that fails at its scheduled time is worse than one refused when it is
scheduled.

#### Scenario: Required metadata is validated at scheduling time

- **WHEN** a publication for this provider omits the title
- **THEN** scheduling SHALL be rejected naming the field

#### Scenario: Post text becomes the video description

- **WHEN** a publication is uploaded
- **THEN** the item's text SHALL be sent as the video description
- **AND** the title SHALL come from the publication's settings, not from the text

#### Scenario: Combined tag length is capped before upload

- **WHEN** the combined length of the tags exceeds the platform's limit
- **THEN** validation SHALL reject the publication naming the limit
- **AND** the measurement SHALL account for the extra characters the platform charges for a tag
  containing whitespace

#### Scenario: Child-directed declaration is always sent

- **WHEN** a publication is uploaded
- **THEN** the child-directed declaration SHALL be present in the request, defaulting to "not made
  for kids", because the platform requires an explicit value

### Requirement: Steps after a successful upload never fail the publication

Once the platform has accepted the video it is on the channel and the publication has succeeded. Any
subsequent step SHALL be best-effort, because a thrown error would return the publication to the
state machine and cause a second upload.

#### Scenario: Thumbnail failure does not fail the publication

- **WHEN** a custom thumbnail is configured and the platform rejects it
- **THEN** the publication SHALL still be reported as successful with the video's identifier and URL
- **AND** the rejection SHALL be logged rather than thrown

#### Scenario: Unverified account cannot set a thumbnail

- **WHEN** the account is not eligible to set custom thumbnails
- **THEN** the publication SHALL succeed without the thumbnail

### Requirement: Private result of an unaudited project is a success

The platform forces videos uploaded by an API project that has not passed its compliance audit into
private visibility, whatever privacy status was requested. The provider SHALL treat this as a
successful publication.

#### Scenario: Requested public, returned private

- **WHEN** a publication requests public visibility
- **AND** the platform returns the video as private
- **THEN** the publication SHALL be reported as successful
- **AND** the provider SHALL NOT retry it

### Requirement: Error classification

The provider SHALL classify platform failures so that the publishing state machine retries only what
can succeed on retry, and never reposts.

#### Scenario: Authorization failures request reconnection

- **WHEN** the platform reports an invalid grant, an unauthenticated request or a revoked token
- **THEN** the error SHALL be classified as requiring reconnection

#### Scenario: Quota exhaustion is permanent for the day

- **WHEN** the platform reports the daily upload limit or the project quota as exhausted
- **THEN** the error SHALL be classified as permanent
- **AND** the message SHALL tell the operator the ceiling was reached rather than blaming the file

#### Scenario: Rate limiting and server failures are retried

- **WHEN** the platform reports a rate limit or a server error
- **THEN** the error SHALL be classified as transient

#### Scenario: Rejected metadata is permanent

- **WHEN** the platform rejects the title, description, tags or category as invalid
- **THEN** the error SHALL be classified as permanent, because a retry sends the same body
