# Spike: MCP client registration (CIMD vs DCR)

Date: 2026-07-24  
Change: `add-mcp-oauth`  
Method: spec + vendor docs research (no live discovery stub yet; live check is
an implementation E2E task).

## Question

Which client registration mechanisms must manypost ship so Cursor, Claude, and
MCP Inspector can complete OAuth without pasting `mp_live_` keys?

## Sources

- MCP Authorization (2025-11-25): CIMD SHOULD; DCR MAY; PRM MUST; PKCE MUST.
- Cursor docs (`cursor.com/docs/mcp`): OAuth via DCR **or** static
  `mcp.json` `auth.CLIENT_ID` / optional `CLIENT_SECRET` / `scopes`.
- Cursor forum (2026-01 → 2026-05): CIMD not shipped; no public timeline;
  staff confirm DCR + static credentials only.
- Secondary writeups: Claude Desktop / VS Code already support CIMD; Cursor
  still DCR-centric.

## Findings

| Client | CIMD | DCR | Static CLIENT_ID |
|---|---|---|---|
| Cursor (current) | No | Yes | Yes (`mcp.json` auth) |
| Claude Desktop / VS Code | Yes | varies | possible |
| MCP Inspector | typically follows MCP client libs | often DCR | possible |

Implication: a **CIMD-only** AS would force every Cursor user to configure a
static client id (acceptable but not zero-config). Omitting both DCR and a
documented static client would block Cursor OAuth entirely.

API keys remain the universal escape hatch and are out of scope for this spike.

## Decision locked for design

1. Document and seed a **static public** platform client for Cursor redirect
   URIs.
2. Implement **CIMD** for clients that present HTTPS URL `client_id`.
3. Implement **minimal DCR** (`registration_endpoint`) for Cursor paste-URL
   UX.
4. Defer live Inspector/Cursor verification against a running stub to
   implementation (`scripts/e2e-mcp-oauth.ts` + manual Cursor connect).

## Non-secrets note

Do not commit real client secrets. Public clients use PKCE without a shared
secret. Cursor static config may omit `CLIENT_SECRET`.
