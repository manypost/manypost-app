---
description: >
  This skill activates when the user mentions creating proposals, specs, changes, or plans for new features, breaking changes, or architectural updates in an OpenSpec project. It provides comprehensive guidance on the OpenSpec spec-driven development workflow, including the three-stage process (Create → Implement → Archive), CLI commands, spec format conventions, and decision trees for when to create proposals versus direct fixes.

  Trigger phrases include: "create a proposal", "write a spec", "plan a change", "add a feature", "breaking change", "architecture change", "openspec workflow", "spec-driven development".
---

# OpenSpec Workflow

Guide Claude Code through spec-driven development using OpenSpec's three-stage workflow. This skill ensures proposals are created before implementation, specs are properly formatted, and changes are archived after deployment.

## When to Use This Skill

Use OpenSpec workflow when:
- Adding new features or capabilities
- Making breaking changes (API, schema, behavior)
- Changing architecture or patterns
- Optimizing performance (changes behavior)
- Updating security patterns
- User mentions: proposal, spec, change, plan, feature, breaking, architecture

Skip OpenSpec workflow for:
- Bug fixes (restoring intended behavior)
- Typos, formatting, comments
- Dependency updates (non-breaking)
- Configuration changes
- Tests for existing behavior

## Three-Stage Workflow

### Stage 1: Creating Changes

**Before starting:**
1. Check existing work: `openspec list` and `openspec list --specs`
2. Review project conventions: Read `openspec/project.md`
3. Search for conflicts: `rg -n "Requirement:|Scenario:" openspec/specs`

**Create proposal:**
1. Choose unique `change-id` (kebab-case, verb-led: `add-`, `update-`, `remove-`, `refactor-`)
2. Scaffold directory structure:
   ```bash
   mkdir -p openspec/changes/<change-id>/specs/<capability>
   ```
3. Create required files:
   - `proposal.md` - Why, what changes, impact
   - `tasks.md` - Implementation checklist
   - `design.md` - Technical decisions (only if needed, see criteria below)
   - `specs/<capability>/spec.md` - Delta changes

**When to create design.md:**
Create `design.md` only if ANY of these apply:
- Cross-cutting change (multiple services/modules) or new architectural pattern
- New external dependency or significant data model changes
- Security, performance, or migration complexity
- Ambiguity that benefits from technical decisions before coding

Otherwise, omit `design.md` to keep proposals lean.

**Validate before sharing:**
```bash
openspec validate <change-id> --strict
```

Fix all errors before requesting approval. Common issues:
- Missing scenarios (every requirement needs ≥1 scenario)
- Wrong scenario format (must use `#### Scenario:` with 4 hashtags)
- Missing delta operations (need ADDED/MODIFIED/REMOVED headers)

### Stage 2: Implementing Changes

**Approval gate:** Do NOT start implementation until proposal is reviewed and approved.

**Implementation steps:**
1. Read `proposal.md` - Understand what's being built
2. Read `design.md` (if exists) - Review technical decisions
3. Read `tasks.md` - Get implementation checklist
4. Implement tasks sequentially - Complete in order
5. Confirm completion - Ensure every item finished
6. Update checklist - Set every task to `- [x]` after completion

**Track as TODOs:** Use TodoWrite to track each task and mark complete as you go.

### Stage 3: Archiving Changes

After deployment, archive the change:

```bash
openspec archive <change-id> --yes
```

This will:
- Move `changes/<name>/` → `changes/archive/YYYY-MM-DD-<name>/`
- Merge spec deltas into `specs/` (source of truth)
- Validate the archived change passes checks

For tooling-only changes (no spec updates):
```bash
openspec archive <change-id> --skip-specs --yes
```

## Spec Format Conventions

### Delta Operations

Use these headers in `changes/<id>/specs/<capability>/spec.md`:

- `## ADDED Requirements` - New capabilities
- `## MODIFIED Requirements` - Changed behavior (paste full updated requirement)
- `## REMOVED Requirements` - Deprecated features
- `## RENAMED Requirements` - Name changes only

**Critical: MODIFIED requirements**
When using MODIFIED:
1. Locate existing requirement in `openspec/specs/<capability>/spec.md`
2. Copy entire requirement block (header + scenarios)
3. Paste under `## MODIFIED Requirements` and edit
4. Include ALL previous content + your changes (archiver replaces entire requirement)

Common mistake: Using MODIFIED to add new concerns without including previous text. This causes data loss. If not changing existing requirement, use ADDED instead.

### Requirement Format

```markdown
### Requirement: Feature Name
The system SHALL/MUST provide [capability].

#### Scenario: Success case
- **WHEN** user performs action
- **THEN** expected result

#### Scenario: Error case
- **WHEN** invalid input provided
- **THEN** error message shown
```

**Critical rules:**
- Use `### Requirement:` (3 hashtags) for requirement headers
- Use `#### Scenario:` (4 hashtags) for scenario headers
- Every requirement MUST have ≥1 scenario
- Use SHALL/MUST for normative requirements
- Don't use bullets or bold for scenario headers

### Multi-Capability Changes

If change affects multiple capabilities, create multiple delta files:

```
openspec/changes/add-2fa-notify/
├── proposal.md
├── tasks.md
└── specs/
    ├── auth/
    │   └── spec.md   # ADDED: Two-Factor Authentication
    └── notifications/
        └── spec.md   # ADDED: OTP Email Notification
```

## CLI Command Reference

Essential commands:
```bash
openspec list                    # List active changes
openspec list --specs            # List specifications
openspec show <item>             # Display change or spec
openspec validate <item>         # Validate changes or specs
openspec archive <change-id> --yes  # Archive after deployment
```

Useful flags:
- `--json` - Machine-readable output
- `--strict` - Comprehensive validation
- `--yes` / `-y` - Skip confirmation prompts
- `--skip-specs` - Archive without spec updates

For detailed CLI reference, see `references/cli-reference.md`.

## Common Errors and Solutions

**"Change must have at least one delta"**
- Check `changes/<name>/specs/` exists with .md files
- Verify files have operation headers (## ADDED Requirements)

**"Requirement must have at least one scenario"**
- Check scenarios use `#### Scenario:` format (4 hashtags)
- Don't use bullet points or bold for scenario headers

**Silent scenario parsing failures**
- Exact format required: `#### Scenario: Name`
- Debug with: `openspec show <change> --json --deltas-only`

**Validation failures**
- Always use `--strict` flag for comprehensive checks
- Check JSON output: `openspec show <change> --json | jq '.deltas'`

For more troubleshooting, see `references/troubleshooting.md`.

## Decision Tree

```
New request?
├─ Bug fix restoring spec behavior? → Fix directly
├─ Typo/format/comment? → Fix directly
├─ New feature/capability? → Create proposal
├─ Breaking change? → Create proposal
├─ Architecture change? → Create proposal
└─ Unclear? → Create proposal (safer)
```

## Best Practices

### Simplicity First
- Default to <100 lines of new code
- Single-file implementations until proven insufficient
- Avoid frameworks without clear justification
- Choose boring, proven patterns

### Complexity Triggers
Only add complexity with:
- Performance data showing current solution too slow
- Concrete scale requirements (>1000 users, >100MB data)
- Multiple proven use cases requiring abstraction

### Clear References
- Use `file.ts:42` format for code locations
- Reference specs as `specs/auth/spec.md`
- Link related changes and PRs

### Capability Naming
- Use verb-noun: `user-auth`, `payment-capture`
- Single purpose per capability
- 10-minute understandability rule
- Split if description needs "AND"

### Change ID Naming
- Use kebab-case: `add-two-factor-auth`
- Prefer verb-led prefixes: `add-`, `update-`, `remove-`, `refactor-`
- Ensure uniqueness; if taken, append `-2`, `-3`, etc.

## Quick Reference

### Stage Indicators
- `changes/` - Proposed, not yet built
- `specs/` - Built and deployed (source of truth)
- `archive/` - Completed changes

### File Purposes
- `proposal.md` - Why and what
- `tasks.md` - Implementation steps
- `design.md` - Technical decisions (optional)
- `spec.md` - Requirements and behavior

### Happy Path Script
```bash
# 1) Explore current state
openspec list
openspec list --specs

# 2) Choose change id and scaffold
CHANGE=add-two-factor-auth
mkdir -p openspec/changes/$CHANGE/specs/auth
printf "## Why\n...\n\n## What Changes\n- ...\n\n## Impact\n- ...\n" > openspec/changes/$CHANGE/proposal.md
printf "## 1. Implementation\n- [ ] 1.1 ...\n" > openspec/changes/$CHANGE/tasks.md

# 3) Add deltas
cat > openspec/changes/$CHANGE/specs/auth/spec.md << 'EOF'
## ADDED Requirements
### Requirement: Two-Factor Authentication
Users MUST provide a second factor during login.

#### Scenario: OTP required
- **WHEN** valid credentials are provided
- **THEN** an OTP challenge is required
EOF

# 4) Validate
openspec validate $CHANGE --strict
```

## Additional Resources

- **CLI Reference**: See `references/cli-reference.md` for all commands and flags
- **Spec Format**: See `references/spec-format.md` for detailed format rules
- **Troubleshooting**: See `references/troubleshooting.md` for error solutions

Remember: Specs are truth. Changes are proposals. Keep them in sync.
