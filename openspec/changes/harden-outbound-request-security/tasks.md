## 1. Policy and client selection

- [ ] 1.1 Add failing table-driven IPv4, IPv6, mapped-address and ambiguous-host tests
- [ ] 1.2 Add failing DNS rebinding, mixed-answer, redirect, timeout and byte-ceiling tests
- [ ] 1.3 Evaluate Bun/dispatcher connection pinning and record the selected adapter with TLS/SNI evidence
- [ ] 1.4 Define the core outbound HTTP port and managed/self-hosted policy options

## 2. Implementation

- [ ] 2.1 Implement normalized forbidden-range classification and fail-closed DNS resolution
- [ ] 2.2 Implement pinned connect, TLS hostname verification, bounded body streaming and manual redirects
- [ ] 2.3 Move media ingestion to the shared adapter without changing accepted media behavior
- [ ] 2.4 Move webhook delivery to the shared adapter without changing signing or retry behavior
- [ ] 2.5 Add redacted structured telemetry and policy-rejection metrics

## 3. Verification and rollout

- [ ] 3.1 Prove cross-organization behavior is unchanged and no secret URL/query/header enters logs
- [ ] 3.2 Update environment, architecture, security and operator documentation plus `CHANGELOG.md`
- [ ] 3.3 Run `bun install --frozen-lockfile`, `bun run check:ci` and focused network integration tests
- [ ] 3.4 Run `bun run spec:validate` and stage enforcement outside production
- [ ] 3.5 Review rejection/latency telemetry, deploy to Railway and archive the change
