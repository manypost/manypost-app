## ADDED Requirements

### Requirement: SSE survives its keepalive interval
The API server SHALL configure an idle timeout longer than the 25-second SSE
keepalive interval.

#### Scenario: Authenticated realtime connection
- **WHEN** an authenticated client opens `GET /v1/events` and no domain event occurs
- **THEN** the server keeps the request alive long enough to send the next 25-second ping

### Requirement: Realtime requires a confirmed session
The web client MUST open EventSource only after the authenticated session check
succeeds, including the existing single refresh attempt.

#### Scenario: Valid or refreshable session
- **WHEN** `GET /v1/auth/me` returns a successful response
- **THEN** the client opens `/v1/events`

#### Scenario: Expired non-refreshable session
- **WHEN** `GET /v1/auth/me` remains unauthorized after refresh
- **THEN** the client removes the non-sensitive session marker, navigates to login and does not open or retry EventSource

### Requirement: OAuth popup messages are trusted
The web client MUST accept OAuth completion messages only when the message comes
from the opened popup, has the current application origin and has an allowed
Manypost OAuth event type.

#### Scenario: Expected completion message
- **WHEN** the opened popup posts `manypost:oauth:success` or `manypost:oauth:done` from the current origin
- **THEN** the connection flow resolves as completed

#### Scenario: Untrusted completion message
- **WHEN** another source, another origin or an unknown type posts a message
- **THEN** the connection flow ignores it

### Requirement: AES-GCM tag size is explicit
The crypto adapter MUST constrain AES-256-GCM decryption to the existing
16-byte authentication tag format and MUST reject malformed or tampered
ciphertexts.

#### Scenario: Valid stored ciphertext
- **WHEN** ciphertext was produced by the adapter with the matching key and AAD
- **THEN** decryption returns the original plaintext using a 16-byte tag

#### Scenario: Invalid ciphertext
- **WHEN** ciphertext is truncated, tampered or uses the wrong AAD
- **THEN** decryption rejects without returning plaintext

### Requirement: Production build failures are blocking
The Docker and Railpack build definitions MUST fail when frozen dependency
installation or the Next.js production build fails.

#### Scenario: Web compilation error
- **WHEN** `bun run --cwd apps/web build` exits non-zero during image creation
- **THEN** the image build exits non-zero and no deployment artifact is accepted

### Requirement: Direct vulnerable versions are minimally remediated
Direct dependencies reported in an affected range MUST move to the smallest
compatible fixed version when the complete validation matrix passes; transitive
findings MUST be documented when a safe direct remedy is unavailable.

#### Scenario: Compatible patched version
- **WHEN** the affected direct package has a patched compatible release
- **THEN** the lockfile records that release and all type, test, build, schema and OpenSpec checks pass

#### Scenario: Residual transitive advisory
- **WHEN** remediation requires a forced major transitive override or upstream release
- **THEN** the advisory chain, impact and follow-up are documented without a broad upgrade
