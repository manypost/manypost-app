## 1. Reproduce and correct the adapter request

- [x] 1.1 Run `bun install --frozen-lockfile`.
- [x] 1.2 Add a focused test that fails while the outbound image request contains the unsupported optional response-format field.
- [x] 1.3 Remove only that field and make the focused adapter test pass.

## 2. Documentation and specification

- [x] 2.1 Update `CHANGELOG.md` with the compatibility correction and its deployment impact.
- [x] 2.2 Run `bun run spec:validate` and keep proposal, design, delta and tasks coherent.

## 3. Validation and staging

- [x] 3.1 Run the focused adapter tests, `bun run check`, `bun run db:check`, `bun run build:web` and `git diff --check`.
- [ ] 3.2 Commit and push the correction to the branch of PR #54, then confirm its GitHub check.
- [ ] 3.3 Configure only the required Coolify staging variables, redeploy the exact commit and verify health, capability advertisement and a real image generation without exposing credentials.
