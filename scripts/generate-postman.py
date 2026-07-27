#!/usr/bin/env python3
"""Gera postman/manypost.collection.json a partir de apps/web/openapi.json + OAuth/MCP."""
from __future__ import annotations

import json
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
OPENAPI = ROOT / "apps/web/openapi.json"
OUT = ROOT / "postman"


def uid() -> str:
    return str(uuid4())


def example_from_schema(schema: dict, components: dict, depth: int = 0):
    if depth > 6 or not isinstance(schema, dict):
        return None
    if "$ref" in schema:
        ref = schema["$ref"].split("/")[-1]
        return example_from_schema(components.get("schemas", {}).get(ref, {}), components, depth + 1)
    if "example" in schema:
        return schema["example"]
    if "oneOf" in schema:
        return example_from_schema(schema["oneOf"][0], components, depth + 1)
    if "anyOf" in schema:
        return example_from_schema(schema["anyOf"][0], components, depth + 1)
    t = schema.get("type")
    if t == "object" or "properties" in schema:
        out = {}
        for k, v in schema.get("properties", {}).items():
            ex = example_from_schema(v, components, depth + 1)
            if ex is not None:
                out[k] = ex
        return out
    if t == "array":
        item = example_from_schema(schema.get("items", {}), components, depth + 1)
        return [item] if item is not None else []
    if t == "string":
        return schema.get("default", "string")
    if t in ("integer", "number"):
        return schema.get("default", 0)
    if t == "boolean":
        return schema.get("default", False)
    return None


TAG_ORDER = [
    "health",
    "auth",
    "api-keys",
    "channels",
    "posts",
    "publications",
    "media",
    "webhooks",
    "notifications",
    "events",
    "capabilities",
    "billing",
    "approvals",
    "public-posts",
    "public-publications",
    "public-channels",
    "public-media",
    "public-webhooks",
    "oauth-as",
    "mcp",
]


def make_request(method: str, path: str, op: dict, components: dict):
    name = op.get("summary") or op.get("operationId") or f"{method.upper()} {path}"
    postman_path = []
    path_vars = []
    segs = [] if path == "/" else path.strip("/").split("/")
    for seg in segs:
        if seg.startswith("{") and seg.endswith("}"):
            key = seg[1:-1]
            postman_path.append(f"{{{{{key}}}}}")
            path_vars.append({"key": key, "value": f"{{{{{key}}}}}"})
        else:
            postman_path.append(seg)
    url = {
        "raw": "{{baseUrl}}" + path.replace("{", "{{").replace("}", "}}"),
        "host": ["{{baseUrl}}"],
        "path": postman_path,
    }
    if path_vars:
        url["variable"] = path_vars
    query = []
    for p in op.get("parameters") or []:
        if p.get("in") == "query":
            query.append(
                {
                    "key": p["name"],
                    "value": str(p.get("example", p.get("schema", {}).get("example", ""))),
                    "description": p.get("description", ""),
                    "disabled": not p.get("required", False),
                }
            )
    if query:
        url["query"] = query

    headers = []
    body = None
    content = (op.get("requestBody") or {}).get("content") or {}
    if "application/json" in content:
        headers.append({"key": "Content-Type", "value": "application/json"})
        schema = content["application/json"].get("schema", {})
        ex = content["application/json"].get("example")
        if ex is None:
            ex = example_from_schema(schema, components)
        body = {
            "mode": "raw",
            "raw": json.dumps(ex if ex is not None else {}, ensure_ascii=False, indent=2),
            "options": {"raw": {"language": "json"}},
        }
    elif "multipart/form-data" in content:
        body = {
            "mode": "formdata",
            "formdata": [
                {"key": "file", "type": "file", "src": [], "description": "arquivo de mídia"},
                {"key": "alt", "type": "text", "value": "", "description": "texto alternativo opcional"},
            ],
        }

    tags = op.get("tags") or []
    if path.startswith("/public/v1"):
        auth = {"type": "bearer", "bearer": [{"key": "token", "value": "{{apiKey}}", "type": "string"}]}
    elif path.startswith("/public/approval") or path in ("/health",) or path.startswith("/.well-known") or path.startswith(
        "/oauth/register"
    ) or path.startswith("/oauth/token") or path.startswith("/oauth/authorize") or path.startswith("/v1/stripe"):
        auth = {"type": "noauth"}
    elif path.startswith("/mcp"):
        auth = {
            "type": "bearer",
            "bearer": [{"key": "token", "value": "{{oauthAccessToken}}", "type": "string"}],
        }
    elif "consent" in path:
        auth = {"type": "bearer", "bearer": [{"key": "token", "value": "{{clerkJwt}}", "type": "string"}]}
    else:
        auth = {"type": "bearer", "bearer": [{"key": "token", "value": "{{clerkJwt}}", "type": "string"}]}

    item = {
        "name": name,
        "request": {
            "method": method.upper(),
            "header": headers,
            "url": url,
            "description": op.get("description") or op.get("summary") or "",
            "auth": auth,
        },
        "response": [],
        "event": [
            {
                "listen": "test",
                "script": {
                    "type": "text/javascript",
                    "exec": [
                        "pm.test('status is not 5xx', function () {",
                        "  pm.expect(pm.response.code).to.be.below(500);",
                        "});",
                    ],
                },
            }
        ],
    }
    if body:
        item["request"]["body"] = body
    return item, tags


def main() -> None:
    openapi = json.loads(OPENAPI.read_text())
    components = openapi.get("components", {})
    folders = {t: [] for t in TAG_ORDER}
    folders["other"] = []

    for path, methods in sorted((openapi.get("paths") or {}).items()):
        for method, op in methods.items():
            if method not in ("get", "post", "put", "patch", "delete", "head", "options"):
                continue
            if not isinstance(op, dict):
                continue
            item, tags = make_request(method, path, op, components)
            placed = False
            for t in tags:
                if t in folders:
                    folders[t].append(item)
                    placed = True
                    break
            if not placed:
                folders["other"].append(item)

    if not folders["health"]:
        item, _ = make_request("get", "/health", {"summary": "Health check", "tags": ["health"]}, components)
        folders["health"].append(item)

    oauth_ops = [
        ("get", "/.well-known/oauth-authorization-server", "OAuth AS discovery (RFC 8414)"),
        ("get", "/.well-known/oauth-protected-resource", "Protected Resource Metadata"),
        ("get", "/.well-known/oauth-protected-resource/mcp", "PRM path-aware /mcp"),
        ("post", "/oauth/register", "DCR — dynamic client registration"),
        ("get", "/oauth/authorize", "Authorization endpoint (browser + PKCE)"),
        ("post", "/oauth/token", "Token endpoint (code + refresh)"),
        ("get", "/oauth/consent/context", "Consent context (Clerk session)"),
        ("post", "/oauth/consent/approve", "Approve consent (Clerk session)"),
        ("post", "/oauth/consent/deny", "Deny consent (Clerk session)"),
    ]
    for method, path, summary in oauth_ops:
        op: dict = {"summary": summary, "tags": ["oauth-as"]}
        if path == "/oauth/register":
            op["requestBody"] = {
                "content": {
                    "application/json": {
                        "example": {
                            "client_name": "Postman MCP",
                            "redirect_uris": ["http://127.0.0.1:54321/callback"],
                            "token_endpoint_auth_method": "none",
                            "grant_types": ["authorization_code", "refresh_token"],
                            "response_types": ["code"],
                        }
                    }
                }
            }
        if path == "/oauth/token":
            op["requestBody"] = {
                "content": {
                    "application/json": {
                        "example": {
                            "grant_type": "authorization_code",
                            "code": "{{authCode}}",
                            "redirect_uri": "{{redirectUri}}",
                            "client_id": "{{clientId}}",
                            "code_verifier": "{{codeVerifier}}",
                        }
                    }
                }
            }
        item, _ = make_request(method, path, op, components)
        folders["oauth-as"].append(item)

    mcp_item, _ = make_request(
        "post",
        "/mcp",
        {
            "summary": "MCP JSON-RPC (Bearer mp_live_ or mpo_)",
            "tags": ["mcp"],
            "requestBody": {
                "content": {
                    "application/json": {
                        "example": {
                            "jsonrpc": "2.0",
                            "id": 1,
                            "method": "initialize",
                            "params": {
                                "protocolVersion": "2024-11-05",
                                "capabilities": {},
                                "clientInfo": {"name": "postman", "version": "1.0.0"},
                            },
                        }
                    }
                }
            },
        },
        components,
    )
    folders["mcp"].append(mcp_item)

    for folder_name in ("posts", "public-posts"):
        for item in folders[folder_name]:
            if item["request"]["method"] == "POST" and item["request"]["url"]["raw"].rstrip("/").endswith("/posts"):
                item["request"]["body"] = {
                    "mode": "raw",
                    "raw": json.dumps(
                        {
                            "channelIds": ["{{channelId}}"],
                            "text": "Olá do manypost via Postman",
                            "publishAt": "2026-08-01T15:00:00.000Z",
                            "thread": [{"text": "Réplica 1", "delaySec": 0}],
                            "requireApproval": False,
                        },
                        ensure_ascii=False,
                        indent=2,
                    ),
                    "options": {"raw": {"language": "json"}},
                }

    collection = {
        "info": {
            "_postman_id": uid(),
            "name": "manypost API",
            "description": "Coleção completa da API manypost. Ver postman/README.md.",
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
        },
        "auth": {
            "type": "bearer",
            "bearer": [{"key": "token", "value": "{{clerkJwt}}", "type": "string"}],
        },
        "variable": [
            {"key": "baseUrl", "value": "http://localhost:3100"},
            {"key": "clerkJwt", "value": ""},
            {"key": "apiKey", "value": "mp_live_..."},
            {"key": "oauthAccessToken", "value": "mpo_..."},
            {"key": "channelId", "value": ""},
            {"key": "groupId", "value": ""},
            {"key": "mediaId", "value": ""},
            {"key": "webhookId", "value": ""},
            {"key": "approvalToken", "value": ""},
            {"key": "clientId", "value": "manypost-mcp"},
            {"key": "redirectUri", "value": "http://127.0.0.1:54321/callback"},
            {"key": "codeVerifier", "value": ""},
            {"key": "codeChallenge", "value": ""},
            {"key": "authCode", "value": ""},
        ],
        "item": [],
    }
    for tag in TAG_ORDER + ["other"]:
        items = folders.get(tag) or []
        if items:
            collection["item"].append({"name": tag, "item": items, "description": f"tag `{tag}`"})

    OUT.mkdir(exist_ok=True)
    (OUT / "manypost.collection.json").write_text(json.dumps(collection, ensure_ascii=False, indent=2) + "\n")

    def env(name: str, values: dict):
        return {
            "id": uid(),
            "name": name,
            "values": [
                {
                    "key": k,
                    "value": v,
                    "type": "secret" if k in ("clerkJwt", "apiKey", "oauthAccessToken") else "default",
                    "enabled": True,
                }
                for k, v in values.items()
            ],
            "_postman_variable_scope": "environment",
        }

    env_dir = OUT / "environments"
    env_dir.mkdir(exist_ok=True)
    base_vars = {
        "baseUrl": "http://localhost:3100",
        "publicUrl": "http://localhost:3000",
        "clerkJwt": "",
        "apiKey": "mp_live_replace_me",
        "oauthAccessToken": "",
        "channelId": "",
        "groupId": "",
        "mediaId": "",
        "webhookId": "",
        "approvalToken": "",
        "clientId": "manypost-mcp",
        "redirectUri": "http://127.0.0.1:54321/callback",
        "codeVerifier": "",
        "codeChallenge": "",
        "authCode": "",
    }
    (env_dir / "local.postman_environment.json").write_text(json.dumps(env("manypost local", base_vars), indent=2) + "\n")
    cloud = dict(base_vars)
    cloud["baseUrl"] = "https://api.example.com"
    cloud["publicUrl"] = "https://app.example.com"
    (env_dir / "cloud.postman_environment.json").write_text(json.dumps(env("manypost cloud", cloud), indent=2) + "\n")
    total = sum(len(v) for v in folders.values())
    print(f"wrote {total} requests in {len(collection['item'])} folders → {OUT}")


if __name__ == "__main__":
    main()
