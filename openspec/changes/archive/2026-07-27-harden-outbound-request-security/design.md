## Context

`assertPublicUrl` resolves a hostname and rejects a regex-defined subset of
private addresses. Media fetching then performs a separate `fetch`; webhook
delivery also validates and separately connects. DNS may change between those
steps. The regex does not provide a complete normalized IPv4/IPv6 policy.

The security policy belongs behind a core port because media and webhook use
cases need the same semantics while DNS resolution and socket connection are
runtime infrastructure. API/worker composition roots supply the adapter.

## Goals / Non-Goals

**Goals:**

- validate all resolved IPv4 and IPv6 addresses using normalized ranges;
- connect only to an address from the validated result set;
- reapply the full policy after every redirect;
- enforce time, byte, scheme, port and redirect limits;
- retain explicit local-development behavior without weakening production.

**Non-Goals:**

- replacing Railway network controls;
- proxying social-provider SDK traffic in the first phase;
- supporting arbitrary protocols or private production endpoints by default.

## Decisions

### One outbound HTTP port owns resolve-and-connect

Create a port that returns a bounded response and accepts policy options. Its
adapter resolves all addresses, rejects the destination if any result is
forbidden, pins an accepted address through the connection, and preserves the
original hostname for TLS SNI and Host validation.

Alternative considered: improve only the regex. It still leaves the
time-of-check/time-of-use DNS gap.

### Use parsed address ranges, not textual prefixes

Normalize IPv4, IPv4-mapped IPv6 and canonical IPv6, then classify unspecified,
loopback, private, carrier-grade NAT, link-local, multicast, documentation and
reserved ranges. Reject ambiguous numeric host forms and zone identifiers.

Alternative considered: maintain regex prefixes. Textual variants and mapped
forms make that incomplete and difficult to test.

### Redirects are new requests

The adapter follows a small bounded number of redirects manually. Each target
repeats scheme, credentials, port, DNS and address checks; HTTPS downgrade and
URL userinfo are rejected.

### Exceptions are explicit and fail closed

The existing private-URL flags remain development/self-host controls but must be
false in the managed Railway environment. Resolution failure, mixed
public/private answers, timeout and connection mismatch all reject. Logs contain
hostname, policy reason and correlation id, never full signed URLs or headers.

### Generated artifacts

No generated file is expected. If public error contracts change, regenerate
`apps/web/openapi.json` and `apps/web/src/lib/api/schema.d.ts` through the
documented API generation flow; never edit the declaration manually.

## Risks / Trade-offs

- [Bun connector cannot pin DNS as required] → evaluate a narrowly scoped HTTP
  client/dispatcher before implementation; do not emulate pinning superficially.
- [CDN returns mixed ranges] → fail closed and provide an operator-visible
  reason; allowlisting requires a separate reviewed design.
- [IPv6 policy rejects a valid destination] → table-driven standards-based tests
  and staged telemetry before enforcement.
- [New client changes streaming behavior] → preserve byte ceilings and test
  backpressure with large responses.

## Migration Plan

1. Build table-driven address classifier and resolver tests.
2. Implement the adapter behind the core port with no production call sites.
3. Move media ingestion, then webhook delivery, preserving existing limits.
4. Deploy with decision-only telemetry if it can be done without making the
   request; otherwise stage in a non-production Railway environment.
5. Enable enforcement and monitor rejection reasons, latency and delivery rate.
6. Roll back with a bounded audited compatibility flag or previous successful
   Railway revision; no data migration is involved.

## Open Questions

- Which Bun API or maintained dispatcher provides verifiable address pinning and
  correct TLS SNI?
- Should production permit non-default public ports?
- What is the exact managed-versus-self-hosted policy for private destinations?
- Which network ranges should receive dedicated telemetry rather than a generic
  rejection reason?
