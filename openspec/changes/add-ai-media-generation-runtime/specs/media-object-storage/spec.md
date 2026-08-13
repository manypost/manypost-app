## MODIFIED Requirements

### Requirement: S3-compatible object operations

The S3-compatible durable-media driver SHALL preserve byte-oriented write, read
and idempotent delete operations and SHALL add bounded streaming read/write
operations for large generated media. It MUST NOT require an entire
maximum-sized video to be buffered in application memory.

Every write SHALL use the supplied inspected media content type and
organization-scoped final object key. Streaming operations SHALL enforce byte,
time and abort limits. A missing object SHALL resolve as absent, and deletion
of a missing object SHALL remain successful.

#### Scenario: Byte write carries the content type

- **WHEN** the driver stores bounded bytes for a known media type
- **THEN** the object is written to the configured bucket under the given key
- **AND** it carries the inspected content type

#### Scenario: Byte read returns stored bytes

- **WHEN** the driver reads a bounded key it previously stored through the byte API
- **THEN** the returned bytes equal the bytes that were written

#### Scenario: Video is written as a stream

- **WHEN** ingestion writes a generated video through the streaming API
- **THEN** bytes are transferred incrementally to the organization-scoped object
- **AND** application memory does not grow to the complete video size

#### Scenario: Stream exceeds its bound

- **WHEN** streamed media exceeds its configured byte or wall-clock limit
- **THEN** the transfer is aborted
- **AND** no completed durable media object is reported
- **AND** any incomplete multipart/staging upload is cleaned up idempotently

#### Scenario: Stream consumer aborts

- **WHEN** validation, cancellation or worker shutdown aborts an active stream
- **THEN** the storage adapter stops reading/writing promptly
- **AND** retry can reuse the same allocated object identity safely

#### Scenario: Read of a missing object

- **WHEN** the driver reads a well-formed key that holds no object
- **THEN** the result is absent
- **AND** no error is raised to the caller

#### Scenario: Delete of a missing object

- **WHEN** the driver deletes a well-formed key that holds no object
- **THEN** the operation completes without raising

## ADDED Requirements

### Requirement: Ephemeral provider outputs are ingested before success

The system SHALL copy the selected provider output into the active Manypost
durable-media storage before declaring a generation successful. Provider output
references SHALL be treated as ephemeral and untrusted, MUST NOT become
`media.path` or permanent media URLs and SHALL be cleared when ingestion or a
terminal no-output resolution makes them unnecessary.

Remote output retrieval SHALL occur only through the registered adapter or the
hardened outbound-media client. Every request and redirect SHALL enforce
scheme, DNS/IP, redirect-count, hostname-policy, timeout and byte limits.
Provider-declared MIME, filename, dimensions and duration MUST NOT replace
independent content inspection.

#### Scenario: Provider output URL expires after ingestion

- **WHEN** a successful generation has already ingested its primary output and the provider later deletes the temporary object
- **THEN** the Manypost media URL continues to resolve from the active durable-media driver

#### Scenario: Provider output redirects to a disallowed destination

- **WHEN** output retrieval resolves or redirects to a reserved/private address, disallowed host or unsupported scheme
- **THEN** ingestion is refused before durable media is committed
- **AND** the blocked URL is not exposed in client errors, logs or metrics

#### Scenario: Redirect chain exceeds its bound

- **WHEN** output retrieval exceeds the configured redirect count
- **THEN** fetching stops with a sanitized invalid-output classification
- **AND** provider inference is not resubmitted

#### Scenario: Provider metadata conflicts with content

- **WHEN** provider MIME, extension, dimensions or duration disagree with inspected content
- **THEN** independent inspection determines whether the output is usable
- **AND** untrusted provider metadata is not persisted as media fact

#### Scenario: Durable storage is temporarily unavailable

- **WHEN** the active storage driver cannot persist a validated generated output
- **THEN** the generation remains non-terminal and does not commit customer credits
- **AND** recovery retries ingestion without resubmitting the provider job

#### Scenario: Provider output expires before it can be ingested

- **WHEN** the ephemeral provider output can no longer be fetched and inspect/fetch recovery cannot restore it
- **THEN** the generation truthfully fails with no user-visible output
- **AND** customer credits are released
- **AND** incurred provider cost remains recorded

### Requirement: Primary output storage is deterministic and idempotent

Before writing final generated media, the system SHALL allocate one
organization-scoped media/object identity for the generation's unique
`primary` output. Storage retry SHALL reuse that identity. Final durable media
keys SHALL preserve the existing public form of one organization segment plus
one unguessable file segment; generated media MUST NOT require a nested public
path or weaken existing key validation.

Object persistence occurs outside the database transaction. After the object is
durable, one unit-of-work transaction SHALL create/finalize media and output
metadata, settle customer credits and transition the generation. A stored
object without committed metadata SHALL remain non-public/non-terminal and be
retryable.

#### Scenario: Database finalization fails after object write

- **WHEN** the deterministic primary object is stored but media/output finalization rolls back
- **THEN** the generation remains non-terminal
- **AND** retry uses the same media/object identity
- **AND** no provider submission is repeated

#### Scenario: Finalization is replayed

- **WHEN** duplicate ingestion jobs finalize the same durable primary object
- **THEN** conditional database settlement creates at most one media/output link
- **AND** customer credits commit at most once

#### Scenario: Object write fails partially

- **WHEN** streaming terminates before the storage adapter confirms the final object
- **THEN** no media/output metadata is committed
- **AND** cleanup removes any incomplete storage artifact idempotently

#### Scenario: Abandoned final object is scanned

- **WHEN** cleanup finds an allocated object without committed media/output metadata
- **THEN** it deletes the object only after proving no active generation or ingestion lease can finalize it

#### Scenario: Thumbnail is created

- **WHEN** image/video processing creates a canonical thumbnail or poster
- **THEN** it is associated as a derivative of the primary media
- **AND** it is not exposed or charged as a second generation output

### Requirement: Generated video is inspected and normalized with bounded tools

The system SHALL inspect generated video through bounded FFprobe and SHALL
normalize supported output through bounded FFmpeg only when the active recipe
requires it. Processing SHALL run behind an infrastructure port in a dedicated
worker concurrency class, outside core domain logic.

The launch canonical video profile SHALL be MP4 with H.264 and `yuv420p`, an
allowed 24/30 fps profile, a recipe-supported `9:16`, `1:1` or `16:9` shape,
bounded duration/bytes and AAC only when the recipe explicitly permits audio.
One poster thumbnail SHALL be produced.

Production video capability SHALL require S3-compatible durable-media storage
and successful FFprobe/FFmpeg readiness. Local storage SHALL remain compatible
with guided image generation but MUST NOT advertise production video.

#### Scenario: Provider video already matches the canonical profile

- **WHEN** bounded inspection proves the video satisfies its immutable recipe profile
- **THEN** original video content may be stored without a lossy transcode
- **AND** verified metadata and one poster thumbnail are persisted

#### Scenario: Provider video requires safe normalization

- **WHEN** a supported provider video does not match the required canonical profile
- **THEN** a bounded FFmpeg process creates the canonical primary object
- **AND** temporary input/output files are isolated and removed after success or failure

#### Scenario: Video is unsupported

- **WHEN** container, codec, dimensions, duration, frame rate, audio or bytes cannot satisfy the recipe safely
- **THEN** ingestion fails with a stable sanitized invalid-output classification
- **AND** no user-visible partial media is committed

#### Scenario: Media tool exceeds its limits

- **WHEN** probing or normalization exceeds wall-clock, CPU, memory, disk or output-byte limits
- **THEN** the child process is terminated
- **AND** temporary files are removed
- **AND** provider inference is not resubmitted

#### Scenario: S3 is not selected

- **WHEN** the installation uses local durable-media storage
- **THEN** production video operations are reported unavailable before generation creation
- **AND** existing upload and guided image behavior remain available

#### Scenario: Media tooling is not ready

- **WHEN** required FFprobe/FFmpeg binaries or supported versions fail readiness
- **THEN** video operations are reported unavailable
- **AND** image operations do not become unavailable solely for that reason

### Requirement: Runtime staging is private and separate from public media

Provider transport staging SHALL use a dedicated runtime-storage port and an
opaque namespace that is not served by the public upload route or stable
`MEDIA_PUBLIC_URL`. It MAY share physical S3 infrastructure only when bucket or
prefix policy proves staging objects are not publicly readable.

The runtime store SHALL support short-lived scoped read URLs when configured.
Such URLs SHALL be limited to one object and method, SHALL expire within the
recipe transport window and MUST NOT grant list/write/delete authority.
Readiness SHALL verify required signing/expiration behavior without logging a
signed URL.

Staging objects SHALL have explicit lifecycle cleanup and MUST NOT become media
library records.

#### Scenario: Public route requests a staging key

- **WHEN** a browser requests an opaque runtime-staging object through the public upload/media route
- **THEN** the route returns not found
- **AND** the runtime object is not read

#### Scenario: Same physical bucket is used

- **WHEN** durable media and runtime staging share an S3-compatible bucket
- **THEN** policy/readiness proves the staging namespace is excluded from stable public delivery
- **AND** a staging object is accessible only through scoped runtime authorization

#### Scenario: Signed read URL is created

- **WHEN** an active provider recipe requires URL-based input transport
- **THEN** the runtime store issues a short-lived read-only URL for one staged object
- **AND** the URL carries no bucket credential or broader object authority

#### Scenario: Signed URL expires

- **WHEN** the configured staging URL lifetime passes
- **THEN** the URL no longer reads the staged object
- **AND** it is never reused as a durable media URL

#### Scenario: Signing behavior is unavailable

- **WHEN** a recipe requires URL input but runtime storage cannot prove private scoped signing
- **THEN** that recipe/operation is reported unavailable before quote or generation creation

#### Scenario: Staging object reaches lifecycle deadline

- **WHEN** no active generation/attempt references a staged input and its transport deadline passes
- **THEN** cleanup deletes it idempotently

### Requirement: Provider media inputs preserve ownership and least privilege

The system SHALL resolve provider input media from stored organization-scoped
media IDs. It SHALL prove ownership and supported content before producing a
provider representation. Bounded bytes/streams SHALL be preferred; a private
signed staging URL MAY be used only when the active adapter recipe requires a
URL.

Provider adapters MUST NOT receive filesystem access, bucket credentials,
stable public-library authority or a caller-supplied arbitrary URL.

#### Scenario: Provider operation needs an owned source image

- **WHEN** a valid image-edit or image-to-video generation references organization media
- **THEN** the runtime proves organization ownership and content bounds
- **AND** creates only the input representation required by the immutable recipe

#### Scenario: Another organization substitutes media

- **WHEN** a caller or stale worker attempts to resolve input media from another organization
- **THEN** resolution returns not found before staging or provider submission

#### Scenario: Adapter supports direct upload

- **WHEN** the active adapter accepts bounded byte/stream upload
- **THEN** the runtime uses direct scoped transport
- **AND** it does not create a provider-readable URL unnecessarily

#### Scenario: Caller supplies arbitrary source URL

- **WHEN** a public generation request includes an arbitrary URL instead of an owned media ID
- **THEN** schema validation refuses it
- **AND** no network or storage operation occurs

#### Scenario: Adapter requests storage credentials

- **WHEN** an adapter attempts to obtain bucket credentials or list authority
- **THEN** the runtime port does not provide them
- **AND** recipe activation/security tests fail
