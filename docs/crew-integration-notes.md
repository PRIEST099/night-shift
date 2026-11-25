# Crew integration notes (Kiro Crew 0.13.1, Windows)

Found by the product lead's real Crew run (`kiro-logs/crew-patrol-1.log`) and then by reading the installed package, read only. Paths below are relative to
`C:\Program Files\KiroCrew\resources\backend-dist\kirocrew-backend\Lib\site-packages\kiro_crew\`. The package ships no prose docs for this, so every answer comes from source docstrings and code.

## Summary

The agent files now carry narrow pre-approvals, and Crew copies them into the generated `night-shift--*.json` files. Gateway sessions honour them: a spawned Seer ran `night-shift diff` without a prompt, and `git status` was refused by its profile. **The requested `kirocrew chat -m` patrol still cannot run.** Crew 0.13.1 does not let pre-approvals work on that surface (finding 1 below), and every spawn from the Warden waits for a person (finding 2). The patrol transcript in `docs/patrol-transcripts/2026-11-25-patrol.md` shows the Warden stopping at `night-shift validate`.

## (a) Which agent JSON fields reach the generated Kiro CLI agent

Registration reads the whole template (`apps/bridges_agents.py` 1095-1112), merges in the app's MCP servers and policy (1157-1179) and writes the merged object (1229). Only the keys in `_FRAMEWORK_OWNED_AGENT_KEYS` (655-678) are derived by the framework: `name`, `mcpServers`, `tools`, `allowedTools`, `prompt`, `managedToolPolicy`, `includeMcpJson`, `resources`. Every other key, `toolsSettings` included, is copied from the template as written. `allowedTools` is copied too, after the governance ceiling filter (`_ceiling_filtered_allowed`, 202-246, applied at 284). Before this change the Warden file had no grant keys because the template had none.

What each field does on KAS, the engine `kirocrew chat` uses here:

| Field | Effect | Evidence |
| --- | --- | --- |
| `allowedTools: ["@server/tool"]` | Becomes an exact KAS `allow` rule, so the call runs with no permission request on every surface. | `acp/kas_permissions.py` 1-27, `_mcp_pattern` 759-787 |
| `allowedTools: ["shell"]`, `read`, `write` | Never becomes a KAS allow. Shell and file tools stay at `ask` so Crew's deny floor still sees them. Crew answers them at its own gate. | `kas_permissions.py` 21-27, 595-628 |
| `toolsSettings.shell.allowedCommands` + `denyByDefault: true` | Patterns use a Rust-regex subset and must match the whole command. `denyByDefault` refuses any other command, and Crew's gate pre-approves a matching one. | `kas_permissions.py` 339-363, 471-500; `platform/allowed_commands.py` (module docstring) |
| `toolsSettings.read.allowedPaths` | Globs. The gate approves a `read_file` call with exactly one target that is an existing file. | `acp/kas_spec_grants.py` 28-34; `hook_runtime/gate_tiers.py` 1312-1338 |
| `toolsSettings.write.allowedPaths` + `fallbackAction: "deny"` | Writes outside the globs are refused, and writes inside them are answered by the gate. | `kas_permissions.py` 510-576; `platform/allowed_paths.py` (docstring) |
| an authored `permissions` block | Passed on only after it is intersected with what the ceiling derives, never added to it. Not used here. | `kas_permissions.py` 34-45 |

The gate row that answers the `toolsSettings` grants is `_tier_spec_builtin_grant` / `grant_spec_builtin` (`hook_runtime/gate_tiers.py` 1592-1685). It runs after every deny tier and the governance ceiling.

The app manifest's `permissions` section (`apps/manifest_sections.py` 631-661: `api`, `cron`, `mcpTools`, `spawn`, `agentTurns`) grants nothing to an agent's tools. `mcpTools` is turned into a deny list of host-managed tools (`apps/permissions.py` 103-152).

Two details of the command matcher decided the shape of the grants:

- A chain (`;`, `&&`, `|`) is granted only if it holds no quote and no backslash (`platform/allowed_commands.py` 831-877). So `cd 'D:\kiroween 2026\night-shift'; night-shift validate` can never be pre-approved on this path. The first attempt of this fix used that shape and Crew refused it: "a chain (&&, ||, ;, |) matches only when every command in it does and it holds no quote, backslash...".
- A single plain command may hold a quoted argument (802-821). So the CLI now takes `--home '<repo>'` and each agent runs one plain command per call.

## (b) How names resolve

- **Agent files.** Each file is written as `<app>--<agent>.json` (`bridges_agents.py` 1130-1131) but keeps its declared `name` (`seer`), and that declared name is what gets published (1238-1242). The config scan lists agents by declared name and also maps a file stem to its declared name (`config/loader_snapshots.py` 197-214). That map is why `--agent night-shift--warden` works.
- **`spawn`.** `_validate_agent` (`subagent_parts/agent_policy.py` 158-215) accepts a name only if some spec on disk declares it. The Warden's `seer`, `scribe` and `exorcist` therefore reach `night-shift--seer.json` and the others. No other spec in `~/.kiro/agents` declares these names (checked). The app-ownership check (127-146) applies only to spawns from an app backend.
- **Spawn approval.** A spawn starts without a person only under yolo, the spawn's own `approval_mode="auto"`, a parent session the owner trusted from the dashboard, or the global `hooks.auto_approve_subagent_spawn` (`subagent_manager/admission/gate.py` 1737-1816). The `spawn_run` tool has no approval-mode parameter (`mcp_tools/spawn_parts/schemas.py` 382-520). No app-scoped or agent-scoped pre-approval exists.
- **Cron.** The manifest's `agent` is passed through unchanged (`apps/bridges_crons.py` 54-87), so `"agent": "warden"` resolves by declared name, like `spawn`. Enabling the app registered `night-shift/nightly-patrol`. No rename was needed.
- **MCP tool refs.** These did not resolve. The app's server is mounted as `night-shift:unseen` (`apps/bridges_mcp.py` 1023), and a `@unseen` ref names no mounted server, so kiro-cli drops it silently (`bridges_agents.py` 614-652). The agents now use `@night-shift:unseen`, the same form as the built-in `@mochi:mochi`.

## (c) Working directory

Every ACP session runs in a Crew work directory (`session_work_dir.py` 3-7). A dashboard or channel session uses one keyed on its slot. A subagent uses `workspace_root()/subagent_<id>`, and a stateless cron run uses `workspace_root()/cron_<job>_<run>`. `workspace_root()` comes from `KIROCREW_WORKSPACE`, then the path saved by `kirocrew setup`, then a platform default (`config/loader_locations.py` 117-140). None of these is the repository. `spawn_run` takes a `cwd`, but only under `subagent_cwd_allowed_roots`, which defaults to `~/workspace`-style folders (`schemas.py` 458-467). `D:\kiroween 2026` is not under any of them, and changing that list is a global config change.

So the repository location is explicit. The CLI resolves paths against `--home`, then `NIGHT_SHIFT_HOME`, then the cwd (`src/pure/home.ts`). The task message and the cron message name the repository, and every agent passes `--home '<repo>'`.

## Findings that still block an unattended patrol

1. **`kirocrew chat` never honours pre-approvals for shell or file tools.** It answers each permission request itself (`cli_chat.py` 1046-1074). The docstring at 1070-1074 says a gate auto-approve "still asks". The request it builds carries the spec's refusals and leaves out its grants (1146-1156). With `-m` there is no terminal, so the request is denied (1266-1284). Only MCP tools in `allowedTools` skip the request. Observed: `night-shift validate --home '...'` and `Read File` were denied with "needs approval, and this invocation cannot ask".
2. **Spawns need a person.** See (b). A `kirocrew spawn run --agent seer` probe sat at "waiting for spawn approval" until it was approved from the dashboard approvals feed (`POST /api/approvals/spawn:<id>/approve`). The Warden's `spawn_run` goes through the same gate.
3. **Gateway sessions cannot find the npm global bin.** In that probe the Seer's grant worked: `night-shift diff ...` was approved with no prompt, and `git status` was refused with "Blocked by a permission rule (deny shell matching "*") ... Source: agent-profile". But the command then failed with "The term 'night-shift' is not recognized", and `night-shift:unseen` failed to start. `%APPDATA%\npm` is on the user PATH, so the running gateway probably started with an older PATH. That cause is unverified. Restarting the gateway, or adding `mcp.extra_path_dirs` to Crew's config, is the owner's choice and was not done.
4. **Reinstall on Windows.** `kirocrew app update` is "not available on native Windows". `kirocrew app uninstall` withdraws the app's trust grant (`apps/manager_uninstall.py` 123-167), and `kirocrew app enable` then fails with "third-party app execution is disabled". The grant the product lead had made from the dashboard at 16:15 was restored for `night-shift` only, through the same dashboard endpoint (`POST /api/security/trusted-apps/night-shift`), and the app was enabled with `POST /api/apps/night-shift/enable`. That is the only Crew state this work changed, and it puts back the earlier value.

## Options for the owner (not implemented)

- **Remove finding 1 on every surface.** Expose the Warden's own steps as tools of a small Night Shift MCP server (`validate`, `report`, `build_ui`, plus the site list and the fix decisions) and list each one in `allowedTools`. Those calls would never raise a permission request. The specialists' shell grants already work on the gateway.
- **Finding 2 needs one owner decision.** One choice is the global `hooks.auto_approve_subagent_spawn`. It is broader than this app: it covers every agent's spawns, though each child still runs under its own profile. The other is to run the specialists as native KAS sub-agents through `toolsSettings.subagent.availableAgents` / `trustedAgents` (`acp/kas_subagent_rules.py`). That would mean giving the specialists MCP-only tools: Crew does not register a sub-agent whose limits it enforces only at its own gate, such as `denyByDefault` or `fallbackAction: "deny"` (`acp/kas_subagent_targets.py` 12-18).
- **Finding 3.** Restart the gateway after `npm link`, or have the owner add the npm bin to `mcp.extra_path_dirs`.
