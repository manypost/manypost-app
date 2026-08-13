## ADDED Requirements

### Requirement: Shared entities have one serialization source

The API MUST serialize post groups, publications, feed items and media records through a single
shared module consumed by the internal REST routes, the public v1 routes and the MCP tools. A
machine surface MUST NOT declare its own local copy of a shared entity's wire shape.

#### Scenario: The same post group is read over REST and MCP

- **WHEN** the same post group is fetched through `GET /v1/posts/{id}` and through the MCP
  `get_post` tool
- **THEN** both responses carry the same group fields, including each publication's `media` and
  `attemptCount`

#### Scenario: The publication feed is read internally and over the public API

- **WHEN** the same organization's publications are read through `GET /v1/publications` and
  through the public `GET /public/v1/publications`
- **THEN** both responses serialize items with the same shape, including `publishedAt`,
  `updatedAt` and `mediaPreview`

#### Scenario: Media is serialized internally and over the public API

- **WHEN** a media record is returned by the internal library routes and by the public v1 media
  endpoints
- **THEN** both responses expose the same fields, including the `source` provenance marker

### Requirement: Feed pagination cursors are shared and fail safe

The keyset cursor of the publication feed SHALL be encoded and decoded by one shared
implementation across the internal and public feed routes. A malformed cursor MUST select the
first page instead of failing or exposing parse details.

#### Scenario: A cursor pages consistently across surfaces

- **WHEN** a `nextCursor` returned by one feed surface is sent back to a feed surface of the same
  organization
- **THEN** it is decoded by the same implementation and pages by the same `(publishAt, id)` keyset

#### Scenario: A malformed cursor is provided

- **WHEN** a feed request carries a cursor that does not decode to a valid `(publishAt, id)` pair
- **THEN** the response is the first page
- **AND** no parse error detail is exposed
