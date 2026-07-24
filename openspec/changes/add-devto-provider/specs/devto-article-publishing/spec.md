## ADDED Requirements

### Requirement: Connection by personal API key

The provider SHALL connect through the credential-based connection path using a personal API key
supplied by the operator, and SHALL NOT require any server-side application credential. The provider
SHALL verify the key against the platform before a channel is created, and the key SHALL be stored
as the channel credential so that it is encrypted at rest.

#### Scenario: Valid key establishes the channel identity

- **WHEN** an operator submits an API key
- **THEN** the provider SHALL request the authenticated user's profile from the platform
- **AND** SHALL return the platform user id as the external identifier, together with the display
  name and the username
- **AND** the API key SHALL be returned as the access credential so the existing channel encryption
  applies to it

#### Scenario: Invalid key is refused before a channel exists

- **WHEN** the submitted key is rejected by the platform
- **THEN** the connection SHALL fail with a readable authorization error
- **AND** no channel SHALL be created

#### Scenario: Network is offered without configuration

- **WHEN** the connection catalogue is requested by any installation
- **THEN** the provider SHALL be listed as available
- **AND** SHALL declare that it connects by credential fields rather than by authorization redirect

#### Scenario: Reconnecting the same account does not duplicate the channel

- **WHEN** an operator connects a key belonging to an account that is already connected
- **THEN** the existing channel SHALL be updated with the new credential rather than duplicated,
  because the external identifier is unchanged

### Requirement: Article title is required at scheduling time

The provider SHALL require a title for every publication, expressed as a required field of its
settings schema. A publication whose settings omit the title SHALL be rejected when it is scheduled,
not when it is published.

#### Scenario: Missing title is rejected while still correctable

- **WHEN** a publication is scheduled for a Dev.to channel without a title in its channel settings
- **THEN** scheduling SHALL fail with the invalid-settings error naming the missing field
- **AND** no publication and no job SHALL be created for that channel

#### Scenario: Title present is accepted

- **WHEN** a publication is scheduled with a title of at least two characters
- **THEN** the settings SHALL validate and the publication SHALL be scheduled

#### Scenario: Editing a scheduled publication preserves the stored title

- **WHEN** an operator edits only the text or the scheduled time of an existing publication
- **THEN** the previously stored title SHALL be preserved and the settings SHALL still validate

### Requirement: Publication creates one published article

The provider SHALL publish a publication as a single article, sending the item text as the article
body in Markdown and marking the article as published. The provider SHALL return the identifier and
the canonical URL that the platform reports for the created article.

#### Scenario: Article is created with body and title

- **WHEN** a publication is published
- **THEN** the provider SHALL issue one create-article request carrying the title from settings, the
  item text as the Markdown body, and the published flag set
- **AND** SHALL return the article identifier and the article URL from the response

#### Scenario: Optional article fields are sent only when set

- **WHEN** the settings carry tags, a canonical URL or an organization
- **THEN** each SHALL be included in the create request
- **AND** a field that is unset SHALL be omitted from the request rather than sent empty

#### Scenario: Tag count is bounded

- **WHEN** more than four tags are supplied
- **THEN** the settings SHALL fail validation at scheduling time

#### Scenario: A rejected canonical URL is reported as permanent

- **WHEN** the platform rejects the request because the canonical URL is already taken
- **THEN** the failure SHALL be classified as permanent
- **AND** the reported message SHALL identify the canonical URL as the cause, so the operator is not
  told only that the request was invalid

#### Scenario: No request follows a successful creation

- **WHEN** the platform confirms the created article
- **THEN** the provider SHALL NOT issue any further request whose failure could raise an error,
  because the publication is already public and a raised error would cause a retry

### Requirement: Cover image comes from the attached media

The provider SHALL use the first image attached to the publication as the article cover, sending its
public URL. The provider SHALL accept at most one image and SHALL NOT accept video.

#### Scenario: Single attached image becomes the cover

- **WHEN** a publication carries one image
- **THEN** the create request SHALL carry that image's public URL as the article cover

#### Scenario: Text-only article is allowed

- **WHEN** a publication carries no media
- **THEN** the create request SHALL omit the cover
- **AND** the publication SHALL be accepted, because the network does not require media

#### Scenario: Extra media is rejected at scheduling time

- **WHEN** a publication carries more than one image, or carries any video
- **THEN** media validation SHALL fail when the publication is scheduled

### Requirement: Destination organization is selectable per publication

The provider SHALL offer the organizations the author publishes under as selectable destinations for
a connected channel, and the selection SHALL apply per publication. The selection SHALL be optional,
and its absence SHALL mean the author's personal profile.

#### Scenario: Organizations are offered as selectable accounts

- **WHEN** the selectable accounts are listed for a connected channel
- **THEN** the provider SHALL return the distinct organizations found for the author, each carrying
  its platform identifier and its display name

#### Scenario: An author with no organization publication sees an empty list

- **WHEN** the author has never published under an organization
- **THEN** the selectable accounts SHALL be empty, because the platform exposes no direct listing of
  the author's organizations
- **AND** publication SHALL still succeed, targeting the personal profile

#### Scenario: Selected organization is applied

- **WHEN** a publication selects an organization
- **THEN** the create request SHALL carry that organization's identifier

### Requirement: Credential failure requires reconnection

The provider SHALL NOT attempt credential renewal, because the platform issues non-expiring keys and
offers no renewal exchange. A rejected credential SHALL lead the channel to the state that prompts
the operator to reconnect.

#### Scenario: Rejected credential marks the channel for reconnection

- **WHEN** the platform rejects the credential during publication
- **THEN** the failure SHALL be classified as a credential failure
- **AND** renewal SHALL fail, so the channel SHALL be marked as requiring reconnection rather than
  retried indefinitely

#### Scenario: Rate limiting and platform outages are retried

- **WHEN** the platform reports that the request was rate limited, or reports a server-side failure
- **THEN** the failure SHALL be classified as transient so the existing backoff applies

#### Scenario: A rejected article is not retried

- **WHEN** the platform rejects the article content itself
- **THEN** the failure SHALL be classified as permanent

### Requirement: The network declares no thread support

The provider SHALL declare that it does not support threads, and scheduling a publication with
replies for this channel SHALL be refused.

#### Scenario: Thread scheduling is refused

- **WHEN** a publication with one or more replies is scheduled for a Dev.to channel
- **THEN** scheduling SHALL fail with the capability error naming the channel
