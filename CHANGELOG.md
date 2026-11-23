# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [0.2.0] - 2026-11-23

### Changed

- Runtime bundle from hoja-claude-plugin 0.7.0 (HOJA-757). Agents register work without being reminded: each user
  prompt carries one work-registration line (create a task, activate an open one, or root vs child when a new request
  arrives mid-task), and when a run ends after acting work with its task unreconciled or untracked, `stop()` returns a
  `continue_with` reminder once per turn (delivered by the existing follow-up path). Children of a filed task are
  filed in Hoja as sub-issues by default. Session-trace syncs no longer block a hook and are throttled.

## [0.1.0] - 2026-11-23

### Added

- `Hoja` capability: TaskManage and the Hoja tools, session instructions, the task gate on every tool call
  (`wrap_tool_execute`), runtime reminders delivered with `RunContext.enqueue`, and gate auto-continue as an `asap`
  follow-up that spends no output-retry budget.
- `/hoja:tasks`, `/hoja:hoja on|off|status`, `/hoja:trace`, `/hoja:setup` as prompts answered locally, and
  `Hoja.command()`.
- `HojaSession`, the host-agnostic runtime layer shared with the Code Puppy plugin: a loop-independent stdio MCP
  client, Claude Code-dialect hooks, tool-name translation and a Claude Code-format transcript for evidence and traces.
- Runtime bundle vendored from `hoja-work/hoja-claude-plugin@fea6d15` (0.5.3), hash-checked by
  `scripts/vendor_bundle.py --check`.
- Supports pydantic-ai-slim 2.64 (Code Puppy's pin) through 2.x, Python 3.11+.
