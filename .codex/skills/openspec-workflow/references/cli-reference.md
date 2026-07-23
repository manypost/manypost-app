# OpenSpec CLI Reference

Complete reference for all OpenSpec CLI commands, flags, and usage patterns.

## Core Commands

### `openspec list`
List active changes in the project.

```bash
openspec list                    # List all active changes
openspec list --specs            # List all specifications
openspec change list --json      # JSON output (deprecated but available)
```

**Output:**
- Change IDs
- Brief descriptions
- Status indicators

### `openspec show <item>`
Display detailed information about a change or spec.

```bash
openspec show <change-id>                    # Show change details
openspec show <spec-id> --type spec          # Show spec details
openspec show <change> --json                # JSON output
openspec show <change> --json --deltas-only  # Only delta information
openspec show                                # Interactive selection
```

**Flags:**
- `--json` - Machine-readable output
- `--type change|spec` - Disambiguate items
- `--deltas-only` - Show only delta operations
- `-r <number>` - Show specific requirement number

### `openspec validate <item>`
Validate changes or specs for correctness.

```bash
openspec validate <change-id>        # Validate specific change
openspec validate <change> --strict  # Comprehensive validation
openspec validate                    # Bulk validation mode
```

**Flags:**
- `--strict` - Enable comprehensive checks (recommended)
- `--json` - JSON output for scripting
- `--no-interactive` - Disable prompts

**What it checks:**
- Delta file existence
- Requirement format
- Scenario format (#### Scenario:)
- At least one scenario per requirement
- Valid operation headers (ADDED/MODIFIED/REMOVED)

### `openspec archive <change-id>`
Archive a completed change and merge deltas into specs.

```bash
openspec archive <change-id>                # Interactive archive
openspec archive <change-id> --yes          # Non-interactive (skip prompts)
openspec archive <change-id> -y             # Short form
openspec archive <change-id> --skip-specs   # Archive without spec updates
openspec archive <change-id> --skip-specs --yes  # Tooling-only, non-interactive
```

**Flags:**
- `--yes` / `-y` - Skip confirmation prompts (required for automation)
- `--skip-specs` - Archive without updating specs (for tooling-only changes)
- `--no-interactive` - Disable all prompts

**What it does:**
1. Validates the change
2. Moves `changes/<id>/` → `changes/archive/YYYY-MM-DD-<id>/`
3. Merges deltas into `specs/` (unless --skip-specs)
4. Validates archived change passes checks

**Important:** Always pass the change ID explicitly. The command requires it.

## Project Management

### `openspec init [path]`
Initialize OpenSpec in a project.

```bash
openspec init              # Initialize in current directory
openspec init /path/to/project  # Initialize in specific directory
```

**What it creates:**
- `openspec/` directory structure
- `openspec/project.md` template
- `CLAUDE.md` with OpenSpec instructions (managed block)
- Tool-specific command files (if selected)

### `openspec update [path]`
Update OpenSpec instruction files.

```bash
openspec update            # Update current project
openspec update /path/to/project  # Update specific project
```

**What it updates:**
- `CLAUDE.md` managed block (<!-- OPENSPEC:START --> ... <!-- OPENSPEC:END -->)
- Tool-specific command files
- Preserves custom content outside managed blocks

## Spec Management

### `openspec spec list`
List all specifications in the project.

```bash
openspec spec list              # List specs
openspec spec list --long       # Detailed output
openspec spec list --json       # JSON output
```

**Output:**
- Spec IDs (capability names)
- File paths
- Requirement counts

## Search and Discovery

### Finding Specs
```bash
openspec spec list --long                    # Enumerate all specs
openspec show <spec-id> --type spec          # View specific spec
openspec show <spec-id> --json -r 1          # View specific requirement
```

### Finding Changes
```bash
openspec list                                # List active changes
openspec show <change-id>                    # View change details
openspec show <change-id> --json --deltas-only  # View deltas only
```

### Full-Text Search
Use ripgrep for content search:
```bash
rg -n "Requirement:|Scenario:" openspec/specs     # Search specs
rg -n "^#|Requirement:" openspec/changes          # Search changes
```

## Debugging

### Validate with Details
```bash
openspec validate <change> --strict --json | jq '.'
```

### Inspect Delta Parsing
```bash
openspec show <change> --json | jq '.deltas'
```

### Check Specific Requirement
```bash
openspec show <spec> --json -r 1
```

## Common Workflows

### Creating a Change
```bash
# 1. Check existing work
openspec list
openspec list --specs

# 2. Create change directory
CHANGE=add-feature-name
mkdir -p openspec/changes/$CHANGE/specs/capability-name

# 3. Create files (proposal.md, tasks.md, specs/*/spec.md)
# ... (use your editor or AI assistant)

# 4. Validate
openspec validate $CHANGE --strict

# 5. Implement tasks
# ... (code implementation)

# 6. Archive when complete
openspec archive $CHANGE --yes
```

### Reviewing a Change
```bash
# View overview
openspec show <change-id>

# Validate format
openspec validate <change-id> --strict

# Inspect deltas
openspec show <change-id> --json --deltas-only | jq '.deltas'
```

### Checking Project Status
```bash
# List active work
openspec list

# List all capabilities
openspec list --specs

# View project conventions
cat openspec/project.md
```

## Exit Codes

- `0` - Success
- `1` - Validation errors or command failure
- `2` - Invalid arguments or usage

## Environment Variables

None currently used. All configuration is project-local.

## Configuration Files

- `openspec/project.md` - Project conventions and standards
- `CLAUDE.md` - AI assistant instructions (managed block)
- Tool-specific command files (`.claude/commands/`, `.cursor/prompts/`, etc.)

## Tips

1. **Always use --strict for validation** - Catches more issues
2. **Use --yes for automation** - Required for CI/CD pipelines
3. **Use --json for scripting** - Parse with jq or similar tools
4. **Validate before sharing** - Catch errors early
5. **Archive with change ID** - Don't rely on interactive selection in scripts
