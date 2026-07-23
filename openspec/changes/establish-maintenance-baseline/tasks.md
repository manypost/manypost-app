## 1. Baseline and OpenSpec

- [x] 1.1 Complete read-only repository, Railway, identity, test and security diagnosis
- [x] 1.2 Record the initial diagnosis and implementation plan
- [x] 1.3 Install exact local OpenSpec 1.6.0 and initialize the Codex core profile
- [x] 1.4 Add project context, artifact rules, proposal, design, specs and usage guide
- [x] 1.5 Validate the complete change with strict non-interactive OpenSpec validation

## 2. Repository guidance and architecture

- [x] 2.1 Add root, database and provider `AGENTS.md` rules and extend the PR template
- [x] 2.2 Create the canonical architecture overview and repository map
- [x] 2.3 Document authentication, connection, publishing, media, webhook, API/MCP, approval and billing flows
- [x] 2.4 Document data, migrations, cache, queues, storage, environment, Railway, observability and CI
- [x] 2.5 Document clean install, development, testing, debugging and common change recipes

## 3. Product identity and change record

- [x] 3.1 Classify all initial Postiz occurrences into the six decision categories
- [x] 3.2 Replace only safe current wording and run the residual tracked-file search
- [x] 3.3 Document preserved references, residual count and future identity decisions
- [ ] 3.4 Create the Keep a Changelog entry for user, developer and operator impact

## 4. Deterministic delivery

- [x] 4.1 Pin Bun 1.3.14 and add the aggregate CI validation script
- [x] 4.2 Use frozen install and the complete validation matrix in GitHub Actions
- [x] 4.3 Stop Docker and Railpack from masking install or web-build failures
- [ ] 4.4 Build the production Docker image successfully

## 5. Tested fixes

- [x] 5.1 Add a failing SSE server-option regression and configure an idle timeout above 25 seconds
- [x] 5.2 Add failing OAuth trust regressions and require same origin plus popup source
- [x] 5.3 Add failing GCM regressions and make the 16-byte authentication tag explicit
- [ ] 5.4 Add failing session-result regressions and prevent SSE retry after session expiry
- [ ] 5.5 Apply minimal affected direct dependency updates and rerun the full matrix

## 6. Backlog, validation and delivery

- [ ] 6.1 Create validated future OpenSpec changes for publication idempotency and outbound-request security
- [ ] 6.2 Publish the prioritized technical backlog with evidence and recommendations
- [ ] 6.3 Run clean install, typechecks, tests, boundaries, brand, DB, build, OpenSpec, audit, Semgrep, identity and secret checks
- [ ] 6.4 Archive this completed change and revalidate living specs
- [ ] 6.5 Review commit authorship/diff, push, open the PR and wait for all required checks
- [ ] 6.6 Merge without bypassing protection and verify the resulting `main` commit and Railway deployment
