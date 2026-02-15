# Lobster Workflow Reference

Lobster workflows are defined in YAML (recommended), JSON, or `.lobster` files. They allow you to orchestrate multiple Lobster commands or shell scripts into a stateful, resumable pipeline.

---

## Workflow File Schema

| Field | Type | Description |
| :--- | :--- | :--- |
| `name` | `string` | Optional name for the workflow. |
| `description` | `string` | Optional human-friendly description of what the workflow does. |
| `args` | `object` | Argument definitions. Each key is an argument name, and the value is an object with `default` and `description`. |
| `env` | `object` | Environment variables applied to all steps in the workflow. |
| `cwd` | `string` | The default working directory for all steps. |
| `steps` | `array` | **Required.** An array of Step objects executed in order. |

### Step Object Schema

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | **Required.** Unique ID for the step. Used to reference its output in later steps. |
| `command` | `string` | **Required.** The command to execute. Can be an internal Lobster command (e.g., `where`, `email.triage`) or a shell command. |
| `stdin` | `any` | Data passed to the command's standard input. Can be a literal string/object or a reference to a previous step (e.g., `$collect.json`). |
| `approval` | `boolean\|string` | If `true` or `"required"`, Lobster will halt and wait for human approval before continuing. |
| `condition` | `string` | A predicate that must be true for the step to run (e.g., `$check.approved`). |
| `when` | `string` | Alias for `condition`. |
| `env` | `object` | Environment variables specific to this step. |
| `cwd` | `string` | Working directory specific to this step. |

---

## Internal vs. Shell Commands

Lobster intelligently resolves the `command` string in each step:

1. **Internal Commands:** Lobster first checks its internal registry. Commands like `gog.gmail.search`, `email.triage`, `where`, and `pick` run directly within the Lobster process. This is faster and preserves rich JSON data structures between steps.
2. **Shell Commands:** If the command is not found in the registry, Lobster falls back to executing it via `/bin/sh`.

**Example (Internal Commands):**
```yaml
steps:
  - id: find_users
    command: "where 'active=true'"
    stdin: "${args.users}"
```

**Example (Shell Commands):**
```yaml
steps:
  - id: list_files
    command: "ls -la"
```

---

## Step References and Templates

You can reference workflow arguments and previous step outputs using specific syntax:

### Argument Templates
Use `${key}` to inject workflow arguments defined in the top-level `args` block.
```yaml
command: "echo ${my_arg}"
```

### Step Output References
Use `$id.stdout` or `$id.json` to pass data between steps.
- `$id.stdout`: The raw string output of the step.
- `$id.json`: The parsed JSON output. When using internal Lobster commands, this preserves objects/arrays without extra stringification.

### Condition Syntax
Steps can be skipped based on the outcome of previous steps using the `condition` or `when` fields:
- `$id.approved`: True if the human approved the previous step.
- `$id.skipped`: True if the previous step was skipped.

---

## Examples

### 1. Email Triage and Notify (Internal Tools)

```yaml
name: email-triage-and-notify
args:
  repo: { default: "openclaw/lobster", description: "Target repo" }

steps:
  - id: fetch
    command: "gog.gmail.search --query 'newer_than:1d' --max 5"
  
  - id: triage
    command: "email.triage"
    stdin: "$fetch.json"

  - id: review
    command: "approve --prompt 'Triage finished. Continue?'"
    stdin: "$triage.json"
    approval: required

  - id: notify
    command: "echo 'Triage complete!'"
    condition: "$review.approved"
```

### 2. Hybrid Workflow (Shell + Internal Tools)

This workflow uses shell utilities like `jq` alongside Lobster's internal `map` and `where` commands.

```yaml
name: mix-and-match-demo
description: Orchestrate shell commands and internal Lobster tools together
steps:
  - id: read_metadata
    # Shell command: use jq to extract specific fields from package.json
    command: "jq '{name: .name, version: .version}' package.json"

  - id: wrap
    # Internal Lobster command: wrap the single object into an array for processing
    command: "map --wrap item"
    stdin: "$read_metadata.json"

  - id: filter
    # Internal Lobster command: use native predicate logic
    command: "where 'item.version!=null'"
    stdin: "$wrap.json"

  - id: report
    # Shell command: use environment variables to consume internal tool output
    command: "echo \"Final processed metadata: $FINAL_DATA\""
    env:
      FINAL_DATA: "$filter.stdout"
```
