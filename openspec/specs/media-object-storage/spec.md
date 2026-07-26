# media-object-storage Specification

## Purpose
TBD - created by archiving change add-s3-media-storage. Update Purpose after archive.
## Requirements
### Requirement: Storage driver selection is single-sourced

The system SHALL resolve which media storage driver to use from one environment
mapping, and every composition root (API, `MODE=all`, dedicated worker) SHALL use
that mapping rather than constructing a driver of its own choosing.

#### Scenario: Local driver by default

- **WHEN** the environment does not set `STORAGE_PROVIDER`
- **THEN** the resolved configuration selects the local driver
- **AND** media is written under the configured upload directory

#### Scenario: S3-compatible driver selected

- **WHEN** `STORAGE_PROVIDER` is `s3` and the bucket, credentials and public
  media base are configured
- **THEN** the resolved configuration selects the S3-compatible driver
- **AND** the API and the dedicated worker resolve the same bucket, endpoint,
  region and public media base from the same environment

#### Scenario: Worker publishes a URL the API can also serve

- **WHEN** the dedicated worker resolves a media reference while publishing
- **THEN** the URL it hands to a provider is byte-identical to the URL the API
  returns for the same stored object

### Requirement: Storage configuration fails closed at boot

The system SHALL refuse to start when the selected driver lacks a required
setting, and the refusal MUST name the missing environment variable. The system
MUST NOT print, log or embed a credential value in that message or anywhere else.

#### Scenario: S3 selected without a bucket

- **WHEN** `STORAGE_PROVIDER` is `s3` and the bucket variable is absent
- **THEN** startup fails with a message naming the missing bucket variable

#### Scenario: S3 selected without credentials

- **WHEN** `STORAGE_PROVIDER` is `s3` and either the access key id or the secret
  access key is absent
- **THEN** startup fails with a message naming the missing variable
- **AND** the message contains no part of any configured credential value

#### Scenario: S3 selected without a public media base

- **WHEN** `STORAGE_PROVIDER` is `s3` and `MEDIA_PUBLIC_URL` is absent
- **THEN** startup fails naming `MEDIA_PUBLIC_URL`, because a bucket object has
  no address derivable from the app origin

#### Scenario: Local driver needs no bucket settings

- **WHEN** `STORAGE_PROVIDER` is `local` and no `S3_*` variable is set
- **THEN** startup succeeds

### Requirement: Published media URL is independent of the app origin

The system SHALL derive the public media URL from `MEDIA_PUBLIC_URL` when it is
configured, appending the object key directly to that base, for every driver.
When it is absent, the local driver SHALL keep deriving the URL from the app
origin followed by the `uploads` path segment.

#### Scenario: Public base configured

- **WHEN** `MEDIA_PUBLIC_URL` is configured and an object key is stored
- **THEN** the published URL is the configured base, a single separator and the
  object key, with no duplicated separator when the base carries a trailing one

#### Scenario: Public base absent under the local driver

- **WHEN** `MEDIA_PUBLIC_URL` is absent and the local driver is selected
- **THEN** the published URL is the app origin followed by the `uploads` segment
  and the object key, preserving the address shape used before this change

#### Scenario: Media URL survives a change of app origin

- **WHEN** `MEDIA_PUBLIC_URL` is configured and the app origin changes
- **THEN** the published media URL does not change

### Requirement: Object keys stay inside their organization prefix

Every driver SHALL reject an object key that does not consist of an organization
identifier segment followed by a single file segment, and MUST reject any key
containing a path traversal segment, an absolute path or a backslash. Rejection
MUST happen before any filesystem or network call.

#### Scenario: Traversal key refused

- **WHEN** a key containing a parent-directory segment is passed to read, write
  or delete
- **THEN** the driver refuses the operation
- **AND** no request is issued to the bucket and no file is touched on disk

#### Scenario: Key with too many segments refused

- **WHEN** a key nests further segments beyond the organization and file segments
- **THEN** the driver refuses the operation

#### Scenario: Well-formed key accepted

- **WHEN** the key is an organization identifier followed by a single
  unguessable file segment with a media extension
- **THEN** the operation proceeds

### Requirement: S3-compatible object operations

The S3-compatible driver SHALL write an object with the media content type it was
given, read an object back as bytes, and delete an object. A read of an object
that does not exist SHALL resolve to an absent result rather than raising.

#### Scenario: Write carries the content type

- **WHEN** the driver stores bytes for a known media type
- **THEN** the object is written to the configured bucket under the given key
  with that content type

#### Scenario: Read returns the stored bytes

- **WHEN** the driver reads a key it previously stored
- **THEN** the returned bytes equal the bytes that were written

#### Scenario: Read of a missing object

- **WHEN** the driver reads a well-formed key that holds no object
- **THEN** the result is absent
- **AND** no error is raised to the caller

#### Scenario: Delete of a missing object

- **WHEN** the driver deletes a well-formed key that holds no object
- **THEN** the operation completes without raising

### Requirement: Storage write failure is a stable domain error

When the backend cannot complete a media write, the system SHALL surface the
stable domain error code `media.store_failed`, mapped to HTTP `502`. The error
detail MUST NOT contain a credential, a signed URL or a bucket secret.

#### Scenario: Bucket rejects the write

- **WHEN** the bucket refuses or fails the write during a media upload
- **THEN** the request fails with `media.store_failed` and HTTP status `502`
- **AND** no media record is created for the failed object

#### Scenario: Failure detail carries no secret

- **WHEN** a storage failure is surfaced to a client or written to a log
- **THEN** the message contains neither the access key id, the secret access key
  nor any signed URL query

### Requirement: Already published media URLs keep resolving

The public upload route SHALL continue to serve an object through the configured
storage driver, so that URLs already materialized inside stored publication
content keep resolving after the driver changes. A request for an object the
driver cannot find SHALL answer `404`, never a server error.

#### Scenario: Object served through the active driver

- **WHEN** the public upload route is requested for a well-formed organization
  and file segment that the active driver holds
- **THEN** the response carries the bytes and the content type derived from the
  file extension

#### Scenario: Unknown object

- **WHEN** the public upload route is requested for a well-formed key the active
  driver does not hold
- **THEN** the response status is `404`

#### Scenario: Malformed request refused before storage

- **WHEN** the public upload route is requested with an organization or file
  segment outside the expected shape
- **THEN** the response status is `404`
- **AND** the storage driver is not consulted

