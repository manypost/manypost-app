# OpenSpec Troubleshooting Guide

Common errors, their causes, and solutions when working with OpenSpec.

## Validation Errors

### "Change must have at least one delta"

**Cause:**
- Missing `specs/` directory under change
- No .md files in `specs/<capability>/`
- Missing delta operation headers

**Solution:**
```bash
# Check directory structure
ls -la openspec/changes/<change-id>/specs/

# Should see:
# openspec/changes/<change-id>/specs/<capability>/spec.md

# Check file has operation headers
cat openspec/changes/<change-id>/specs/<capability>/spec.md
# Should contain: ## ADDED Requirements, ## MODIFIED Requirements, or ## REMOVED Requirements
```

**Fix:**
1. Create `specs/<capability>/` directory if missing
2. Create `spec.md` file with at least one operation header
3. Add at least one requirement under the operation

### "Requirement must have at least one scenario"

**Cause:**
- Requirement has no scenario blocks
- Scenarios not using correct format (`#### Scenario:`)
- Scenarios not properly nested under requirement

**Solution:**
```bash
# Debug scenario parsing
openspec show <change-id> --json --deltas-only | jq '.deltas[].requirements[].scenarios'

# Should return array of scenarios, not empty
```

**Fix:**
Ensure every requirement has at least one scenario:
```markdown
### Requirement: Feature Name
Description of requirement.

#### Scenario: Success case
- **WHEN** condition
- **THEN** outcome
```

### "Invalid scenario format"

**Cause:**
- Using wrong number of hashtags (not ####)
- Using bullet points before scenario header
- Using bold formatting on scenario header
- Missing "Scenario:" prefix

**Wrong formats:**
```markdown
- **Scenario: Login**        ❌ (bullet point)
**Scenario**: Login          ❌ (bold formatting)
### Scenario: Login          ❌ (3 hashtags instead of 4)
#### Login                   ❌ (missing "Scenario:" prefix)
```

**Correct format:**
```markdown
#### Scenario: Login         ✅
```

**Fix:**
1. Use exactly 4 hashtags: `####`
2. Include "Scenario:" prefix
3. No bullets or bold on header
4. Capitalize first letter after "Scenario:"

### "Silent scenario parsing failures"

**Cause:**
Scenarios exist but aren't being parsed due to format issues.

**Debug:**
```bash
# Check parsed scenarios
openspec show <change-id> --json --deltas-only | jq '.deltas[].requirements[] | {name: .name, scenarios: .scenarios | length}'

# If scenarios count is 0 but you have scenarios, format is wrong
```

**Fix:**
1. Check exact format: `#### Scenario: Name`
2. Ensure proper nesting under requirement
3. Validate with `openspec validate <change-id> --strict`

### "Header text does not match"

**Cause:**
When using MODIFIED or RENAMED, the requirement name doesn't match existing spec.

**Solution:**
```bash
# Find exact requirement name in current spec
openspec show <spec-id> --type spec | grep "### Requirement:"

# Use exact name (whitespace-insensitive)
```

**Fix:**
1. Copy exact requirement name from current spec
2. Paste into delta file
3. Whitespace differences are OK, but text must match

## CLI Errors

### "Command not found: openspec"

**Cause:**
OpenSpec CLI not installed or not in PATH.

**Solution:**
```bash
# Install globally
npm install -g @fission-ai/openspec@latest

# Verify installation
openspec --version

# If still not found, check PATH
echo $PATH | grep npm
```

### "Cannot find module"

**Cause:**
Corrupted installation or version mismatch.

**Solution:**
```bash
# Reinstall
npm uninstall -g @fission-ai/openspec
npm install -g @fission-ai/openspec@latest

# Clear npm cache if needed
npm cache clean --force
```

### "ENOENT: no such file or directory"

**Cause:**
Running command outside OpenSpec project or missing required files.

**Solution:**
```bash
# Check if in OpenSpec project
ls openspec/project.md

# If missing, initialize
openspec init

# If exists, check specific file mentioned in error
```

## Workflow Issues

### "Cannot archive: change not found"

**Cause:**
- Change ID misspelled
- Change already archived
- Running from wrong directory

**Solution:**
```bash
# List active changes
openspec list

# Check if already archived
ls openspec/changes/archive/ | grep <change-id>

# Verify current directory
pwd
# Should be project root with openspec/ directory
```

### "Spec merge conflicts"

**Cause:**
Multiple changes modifying same requirement.

**Solution:**
1. Archive changes sequentially, not in parallel
2. Review merged specs after each archive
3. Resolve conflicts manually if needed
4. Re-validate after manual edits

### "Tasks not marked complete"

**Cause:**
Forgetting to update `tasks.md` after implementation.

**Solution:**
Before archiving:
```bash
# Review tasks
cat openspec/changes/<change-id>/tasks.md

# Ensure all tasks marked with [x]
# - [x] 1.1 Task completed
# - [x] 1.2 Another task completed
```

**Fix:**
1. Open `tasks.md`
2. Change `- [ ]` to `- [x]` for completed tasks
3. Commit changes
4. Archive

## Format Issues

### "Requirement text too vague"

**Cause:**
Using ambiguous terms like "fast", "easy", "good".

**Solution:**
Make requirements specific and testable:
- ❌ "The system should be fast"
- ✅ "The system SHALL respond within 200ms"

- ❌ "Error handling should be good"
- ✅ "The system SHALL return HTTP 400 for invalid input"

### "Scenarios not covering edge cases"

**Cause:**
Only testing happy path, missing error cases.

**Solution:**
For each requirement, add scenarios for:
1. Success case (happy path)
2. Invalid input
3. Boundary conditions
4. Error conditions
5. Edge cases

Example:
```markdown
### Requirement: User Login

#### Scenario: Valid credentials
- **WHEN** user provides correct username and password
- **THEN** user is logged in

#### Scenario: Invalid password
- **WHEN** user provides incorrect password
- **THEN** error message displayed

#### Scenario: Account locked
- **WHEN** user has 3 failed login attempts
- **THEN** account is locked for 15 minutes

#### Scenario: Empty credentials
- **WHEN** user submits empty username or password
- **THEN** validation error displayed
```

### "MODIFIED requirement missing previous content"

**Cause:**
Only including new changes, not full updated requirement.

**Solution:**
1. Find existing requirement in `openspec/specs/<capability>/spec.md`
2. Copy ENTIRE requirement (header + all scenarios)
3. Paste into delta file under `## MODIFIED Requirements`
4. Edit to include your changes
5. Result should be complete, updated requirement

**Wrong:**
```markdown
## MODIFIED Requirements
### Requirement: User Authentication
Now requires two-factor authentication.
```

**Correct:**
```markdown
## MODIFIED Requirements
### Requirement: User Authentication
The system SHALL issue a JWT token on successful login AND require two-factor authentication.

#### Scenario: Valid credentials
- **WHEN** user submits valid credentials
- **THEN** an OTP challenge is initiated

#### Scenario: Complete authentication
- **WHEN** user completes OTP verification
- **THEN** a JWT token is returned
```

## Git Issues

### "Merge conflicts in specs/"

**Cause:**
Multiple people archiving changes simultaneously.

**Solution:**
1. Coordinate archiving with team
2. Archive changes sequentially
3. Pull latest before archiving
4. Resolve conflicts manually if needed

### "Accidentally committed to wrong branch"

**Cause:**
Creating change on main instead of feature branch.

**Solution:**
```bash
# Create feature branch
git checkout -b feature/<change-id>

# Move changes to feature branch
git add openspec/changes/<change-id>/
git commit -m "Add <change-id> proposal"

# Push feature branch
git push -u origin feature/<change-id>
```

## Performance Issues

### "Validation taking too long"

**Cause:**
Large number of specs or changes.

**Solution:**
```bash
# Validate specific change instead of all
openspec validate <change-id> --strict

# Use --no-interactive for faster validation
openspec validate <change-id> --strict --no-interactive
```

### "Archive taking too long"

**Cause:**
Large specs or complex merges.

**Solution:**
This is normal for large changes. Be patient or:
1. Break large changes into smaller ones
2. Archive incrementally
3. Use `--skip-specs` if no spec updates needed

## Integration Issues

### "AI assistant not following OpenSpec workflow"

**Cause:**
- CLAUDE.md not updated
- AI not reading instructions
- Instructions unclear

**Solution:**
```bash
# Update instructions
openspec update

# Verify CLAUDE.md has OpenSpec block
cat CLAUDE.md | grep -A 5 "OPENSPEC:START"

# Remind AI explicitly
# "Please follow the OpenSpec workflow from CLAUDE.md"
```

### "Slash commands not working"

**Cause:**
- Tool not configured during init
- Tool needs restart
- Commands not installed

**Solution:**
```bash
# Re-run init and select your tool
openspec init

# Restart your AI tool (Claude Code, Cursor, etc.)

# Check command files exist
ls .claude/commands/openspec/  # For Claude Code
ls .cursor/prompts/            # For Cursor
```

## Getting Help

### Debug Commands
```bash
# Show detailed validation output
openspec validate <change-id> --strict --json | jq '.'

# Show parsed deltas
openspec show <change-id> --json --deltas-only | jq '.deltas'

# Show specific requirement
openspec show <spec-id> --json -r 1

# Check OpenSpec version
openspec --version

# Check Node version (must be >= 20.19.0)
node --version
```

### Common Debug Workflow
```bash
# 1. Validate with strict mode
openspec validate <change-id> --strict

# 2. Check JSON output for details
openspec show <change-id> --json --deltas-only

# 3. Verify file structure
ls -R openspec/changes/<change-id>/

# 4. Check specific files
cat openspec/changes/<change-id>/specs/<capability>/spec.md

# 5. Re-validate after fixes
openspec validate <change-id> --strict
```

### Still Stuck?

1. Check OpenSpec documentation: https://github.com/Fission-AI/OpenSpec
2. Search existing issues: https://github.com/Fission-AI/OpenSpec/issues
3. Ask in Discord: https://discord.gg/YctCnvvshC
4. Create new issue with:
   - OpenSpec version (`openspec --version`)
   - Node version (`node --version`)
   - Error message
   - Minimal reproduction steps
