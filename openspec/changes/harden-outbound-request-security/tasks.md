## 1. Policy and client selection

- [x] 1.1 Add failing table-driven IPv4, IPv6, mapped-address and ambiguous-host tests
- [x] 1.2 Add failing DNS rebinding, mixed-answer, redirect, timeout and byte-ceiling tests
- [x] 1.3 Evaluate Bun/dispatcher connection pinning and record the selected adapter with TLS/SNI evidence
      — see "Spike evidence" below
- [x] 1.4 Define the core outbound HTTP port and managed/self-hosted policy options
      — delivered as `makePinnedFetch` returning a `fetch`-shaped function, so both call sites keep
      their existing `fetchFn` seam; policy comes from `MEDIA_ALLOW_PRIVATE_URLS` /
      `WEBHOOKS_ALLOW_PRIVATE`, unchanged names

## 2. Implementation

- [x] 2.1 Implement normalized forbidden-range classification and fail-closed DNS resolution
- [x] 2.2 Implement pinned connect, TLS hostname verification, bounded body streaming and manual redirects
- [x] 2.3 Move media ingestion to the shared adapter without changing accepted media behavior
- [x] 2.4 Move webhook delivery to the shared adapter without changing signing or retry behavior
- [x] 2.5 Add redacted structured telemetry and policy-rejection metrics

## 3. Verification and rollout

- [x] 3.1 Prove cross-organization behavior is unchanged and no secret URL/query/header enters logs
- [x] 3.2 Update environment, architecture, security and operator documentation plus `CHANGELOG.md`
- [x] 3.3 Run `bun install --frozen-lockfile`, `bun run check:ci` and focused network integration tests
- [x] 3.4 Run `bun run spec:validate` and stage enforcement outside production
      — staged on an isolated stack in managed mode (`WEBHOOKS_ALLOW_PRIVATE=false`,
      `MEDIA_ALLOW_PRIVATE_URLS=false`); evidence below
- [ ] 3.5 **Owner step.** Review rejection/latency telemetry, deploy to Railway and archive the change
      (`bun run spec:archive harden-outbound-request-security`) after opening the PR from
      `.github/pull_request_template.md`, filled in by hand

## Spike evidence (task 1.3, 2026-07-26)

Measured on Bun 1.3.14 against a local TLS server whose certificate covers only `pin-test.local`,
so a rejection can only come from certificate validation (the first attempt used a public CDN and
"passed" with `ECONNREFUSED`, which proves nothing — that run was discarded):

| Question | Result |
| --- | --- |
| `node:https` honours a custom `lookup` | **Yes**, but only in the `all: true` array form. The legacy `cb(null, address, family)` signature crashes Bun with `results.sort is not a function` |
| Connection really goes to the pinned address | **Yes** — a request to `pin-test.invalid` (a name in no DNS) reaches the server, so the socket can only have used our lookup |
| IP literal + `servername` validates the certificate | **Yes** — mismatched `servername` fails with `ERR_TLS_CERT_ALTNAME_INVALID` |
| IP literal **without** `servername` validates identity | **No** — Bun accepted a certificate that does not cover the address, where Node rejects. Recorded as a limitation below |
| `Bun.fetch` with `tls.serverName` | Works and validates, but requires manually restating `Host` |

**Adapter chosen: `node:https`/`node:http` with a pinned custom `lookup`.** The hostname is never
replaced by an address, so SNI, the `Host` header and certificate validation stay correct by
construction — which matters given the finding above that connecting *by address* silently loses
hostname validation on Bun. `agent: false` prevents a pooled socket opened before this validation
from being reused.

## Verification evidence (2026-07-26)

- `bun run check`: **701 unit tests, 0 failures** (76 new), dependency-cruiser clean.
- Live probe against an isolated stack in **managed mode**, both surfaces refusing with the
  classified reason: `169.254.169.254` → `link-local`; `[::ffff:127.0.0.1]` → `loopback`;
  `2130706433` → `loopback`; `10.0.0.5` → `private`; `user:senha@` → credentials.
- Regression check on the replaced regex: it **accepted** `::ffff:127.0.0.1`,
  `::ffff:169.254.169.254`, `100.64.0.1`, `224.0.0.1`, `255.255.255.255`, `198.18.0.1`,
  `192.0.0.1`, `64:ff9b::7f00:1` and `2002:7f00:1::1`.
- All five E2E suites green with the hardened path enabled (`e2e-publish` exercises both
  `POST /v1/media/from-url` and signed webhook delivery).
- Cross-organization behaviour: the outbound layer has no tenant concept and the media/webhook use
  cases keep their existing organization scoping — no call site changed its `orgId` handling.
- Redaction: `OutboundBlockedError` and the telemetry callback carry hostname and reason only;
  a test asserts path and query never appear in the message.

## Known limitation (carried, not fixed)

`https://<ip-literal>/` cannot get hostname validation on Bun (finding above). It is not rejected,
because a self-hoster pointing a webhook at a public IP is legitimate; the exposure is limited to
that URL shape and is recorded in `docs/principal/STATUS.md`.
