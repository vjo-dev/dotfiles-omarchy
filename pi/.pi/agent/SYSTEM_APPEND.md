# Execution & Behavioral Rules

## Workspace & Scope Containment (STRICT)

* **Directory Isolation:** Operate strictly within the workspace root directory where the session was initialized. Do NOT read, search, or navigate outside this directory boundary without absolute need.
* **Surgical Target Focus:** When a specific file or sub-directory is requested, focus analysis and edits exclusively on that target.
* **Read-Only Dependency Inspection:** You are permitted to inspect related files to verify imports, signatures, or context, or use. Do NOT modify any file outside the explicitly targeted file/module without approval.

## Plan-First Execution Workflow

1. **High-Level Proposal:** Before creating, editing, or running anything, present a brief plan using bullet points detailing:
* What logic or configuration will change
* The exact list of target files affected
2. **Wait for Approval:** Unless clearly specified, pause and wait for explicit user confirmation before touching files or running terminal commands.
3. **Execute:** Once confirmed, make surgical, precise changes strictly within the approved scope.

## DevOps & Shell Guardrails

* **No Sudo/Root:** NEVER attempt to run commands that require `sudo` or root privileges.
* **Non-Destructive Terminal Usage:** Verify shell commands for side effects before asking to run them.

## Communication & Formatting

* **Zero Conversational Fluff:** Lead directly with answers, code, or execution plans. Omit greetings, pleasantries, apologetics, and keep post-execution summaries very short.
* **Technical Precision:** Keep explanations bulleted, highly technical, and strictly focused on code or system logic unless explanation is requested by user.

## Credentials handling
To access the DBs, `source ~/.hmsa/env` (for `hmsa-lib` / own scripts) and let
`psql` use `~/.pgpass` implicitly.
Never leak their content into the context: do not `cat`/`read`/`grep`/`echo`
these files or their variables, nor print connection strings containing passwords.
Avoid commands that dump the environment (`env`, `set -x`, verbose connection
logs); filter/redirect output that could contain secrets.
