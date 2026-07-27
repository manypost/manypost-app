## ADDED Requirements

### Requirement: Validation and connection use the same resolution
The outbound HTTP adapter MUST connect only to a public IP address from the DNS
result set that it validated for the request hostname.

#### Scenario: DNS rebinding between validation and connection
- **WHEN** an attacker changes DNS after the adapter validates the destination
- **THEN** the connection remains pinned to the validated public address or fails closed

#### Scenario: Mixed public and private answers
- **WHEN** a hostname resolves to both public and forbidden addresses
- **THEN** the request is rejected before any connection

### Requirement: Forbidden address forms are normalized
The adapter MUST normalize IPv4, IPv6 and IPv4-mapped IPv6 and reject
unspecified, loopback, private, carrier-grade NAT, link-local, multicast and
reserved destinations.

#### Scenario: Encoded private address variant
- **WHEN** a URL represents a forbidden address through a mapped or ambiguous form
- **THEN** normalization classifies and rejects it without sending a request

### Requirement: Redirects receive full validation
Every redirect target MUST pass the same scheme, credentials, port, DNS,
address and connection-pinning policy as the original request.

#### Scenario: Public URL redirects to internal service
- **WHEN** a public media URL redirects to a private or link-local address
- **THEN** the redirect is rejected before the internal address is contacted

#### Scenario: HTTPS downgrade
- **WHEN** an HTTPS destination redirects to HTTP
- **THEN** the request is rejected unless an explicit reviewed policy permits the downgrade

### Requirement: Outbound requests are resource bounded
Media and webhook requests MUST enforce configured connection/response
timeouts, redirect ceilings and response-byte limits appropriate to their use
case.

#### Scenario: Slow or unbounded response
- **WHEN** a destination stalls or exceeds the applicable byte ceiling
- **THEN** the request is aborted and returns a stable failure without buffering beyond the limit

### Requirement: Private-network exceptions are explicit
Managed production MUST fail closed for private destinations; an enabled
self-hosted development exception MUST be visible in configuration and logs.

#### Scenario: Managed Railway deployment
- **WHEN** an outbound destination resolves to a forbidden range
- **THEN** the request is rejected regardless of user input

### Requirement: Security failures do not leak request secrets
Rejections MUST emit a policy reason and correlation context without logging
credentials, authorization headers, signatures or sensitive query values.

#### Scenario: Signed webhook URL is rejected
- **WHEN** policy blocks a URL containing a sensitive query
- **THEN** telemetry identifies the hostname and reason but omits the query and request headers
