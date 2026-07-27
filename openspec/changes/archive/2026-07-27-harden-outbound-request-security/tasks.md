## 1. Policy and client selection

- [x] 1.1 Add failing table-driven IPv4, IPv6, mapped-address and ambiguous-host tests
- [x] 1.2 Add failing DNS rebinding, mixed-answer, redirect, timeout and byte-ceiling tests
- [x] 1.3 Evaluate Bun/dispatcher connection pinning and record the selected adapter with TLS/SNI evidence
      — Node `http`/`https` request to the validated IP with `servername` + `Host` for the
      original hostname (works under Bun; avoids a second DNS lookup at connect time).
- [x] 1.4 Define the core outbound HTTP port and managed/self-hosted policy options
      — `assertPublicDestination` / `outboundRequest` + `allowPrivate` (self-host/dev).

## 2. Implementation

- [x] 2.1 Implement normalized forbidden-range classification and fail-closed DNS resolution
- [x] 2.2 Implement pinned connect, TLS hostname verification, bounded body streaming and manual redirects
- [x] 2.3 Move media ingestion to the shared adapter without changing accepted media behavior
- [x] 2.4 Move webhook delivery to the shared adapter without changing signing or retry behavior
- [x] 2.5 Add redacted structured telemetry and policy-rejection metrics
      — DomainError `detail` carries `reason` + `hostname` only (no URL/query/headers).

## 3. Verification and rollout

- [x] 3.1 Prove cross-organization behavior is unchanged and no secret URL/query/header enters logs
- [x] 3.2 Update environment, architecture, security and operator documentation plus `CHANGELOG.md`
- [x] 3.3 Run `bun install --frozen-lockfile`, `bun run check:ci` and focused network integration tests
- [x] 3.4 Run `bun run spec:validate` and stage enforcement outside production
- [ ] 3.5 **Owner step.** After merge and deploy, run `bun run spec:archive harden-outbound-request-security`
