## Why

Media import and webhook creation reject private IP literals and revalidate
redirect URLs, but the HTTP client does not pin the validated DNS result to the
connection. An attacker-controlled hostname can change resolution between
validation and connect, allowing DNS rebinding toward an internal service.

## What Changes

- Introduce one outbound-request policy shared by media imports and webhook
  delivery.
- Resolve every destination, reject all non-public address families and pin the
  accepted address set through the connection.
- Reapply scheme, port, DNS and byte/time limits at every redirect.
- Define explicit, separately gated development exceptions.
- Add IPv4/IPv6 normalization, DNS rebinding, redirect and timeout tests.

## Capabilities

### New Capabilities

- `outbound-request-security`: Resolution, connection pinning, redirect policy,
  address classification and resource limits for server-side HTTP.

### Modified Capabilities

None. No living OpenSpec capability currently defines this behavior.

## Goals

- Ensure the address that is connected is one of the public addresses that was
  validated.
- Apply one auditable policy to media and webhook egress.
- Fail closed with stable domain errors and useful non-secret telemetry.

## Non-goals

- No general-purpose proxy service or network firewall replacement.
- No provider API-client rewrite in the first implementation.
- No implementation in the maintenance-baseline delivery.

## Compatibility

Public URLs that consistently resolve to public addresses continue to work.
URLs using private, loopback, link-local, unspecified or ambiguous address
forms will be rejected unless the existing development-only exception is
explicitly enabled. No database or public API shape change is intended.

## Rollback

The implementation must retain an emergency, audited Railway flag that restores
the current resolver only for a bounded rollback window. Normal rollback is a
redeploy of the previous successful revision; no stored data needs reversal.

## Impact

- `packages/core/src/application/use-cases/media.ts`
- webhook URL validation and delivery code
- an outbound HTTP adapter/port shared by API and worker
- configuration names for resolver timeout and the existing private-network
  development exception
- security tests, logs, metrics and Railway egress behavior

Security impact is high because the change closes a server-side request pivot.
Product identity and Postiz attribution/history are unaffected.
