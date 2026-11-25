# Crew integration notes (Kiro Crew 0.13.1, Windows)

Found by the product lead's real Crew run (`kiro-logs/crew-patrol-1.log`) and then by reading the installed package, read only. Paths below are relative to
`C:\Program Files\KiroCrew\resources\backend-dist\kirocrew-backend\Lib\site-packages\kiro_crew\`. The package ships no prose docs for this, so every answer comes from source docstrings and code.

## Summary (run 49e, owner decision: MCP tools only, no global Crew settings changed)

The owner chose to run the crew through MCP tools only and to change no global Crew setting. Night Shift now has a stdio MCP server, `night-shift mcp`, and the four agents use nothing else.

Done and checked here:

- `night-shift mcp` exposes `validate`, `audit`, `diff`, `workdir`, `verify`, `report`, `list_source`, `read_source` and `write_fix_file`. Each tool calls the existing command code. Each takes `home`, else `NIGHT_SHIFT_HOME`, else the working directory. Paths go through `src/pure/confine.ts` (normalization) and `src/io/confine.ts` (symlink check against the real path). `tests/confine.test.ts` has the property tests, `tests/mcp.test.ts` calls every tool through an in-memory MCP client, and `tests/mcp.int.test.ts` runs audit, diff, workdir, write, a rejected verify, a kept verify and report against the real THE UNSEEN server.
- A real stdio start of the installed bin (`night-shift.cmd mcp`, resolved from `%APPDATA%\npm`) answered `validate`.
- `app.json` declares the server as `shift`: `{"command": "night-shift", "args": ["mcp"]}`. Crew mounts it as `night-shift:shift`, so agents name tools `@night-shift:shift/<tool>`. THE UNSEEN stays `@night-shift:unseen/...`.
- Each agent lists exactly its role's tools in `tools` and in `allowedTools`. No agent has `read`, `write`, `shell` or `@kirocrew-core`. The Warden has the `subagent` tool and `toolsSettings.subagent.availableAgents` and `trustedAgents` set to `seer`, `scribe`, `exorcist`. The three specialists carry no `toolsSettings`, because `acp/kas_subagent_targets.py` refuses a target with a shell `denyByDefault` or a write `fallbackAction: "deny"` (12-18, `_gate_only_limits`).
- `kirocrew agent validate ./agents` reports 0 problems for the 4 specs.

**Not done: installing the new agent files into Crew, and so the unattended patrol.** `kirocrew app install .` answers "app 'night-shift' is already installed (v0.1.0). Update it in place instead ... or uninstall first." `kirocrew app update night-shift` answers that it is not available on native Windows and tells the user to press Update (or Sync) on the app's page in the dashboard. The only other CLI route is `kirocrew app uninstall`, which withdraws the owner's trust grant (`apps/manager_uninstall.py` 123-167), so it was not run. The generated files in `%USERPROFILE%\.kiro\agents\night-shift--*.json` (written 19:25) are still the old ones: the Warden has `tools` `read,shell,@kirocrew-core` and the old shell grants. No `kirocrew chat` patrol was run against them, because that would test the old agents, and no patrol-2 transcript exists. Nothing was approved, trusted or enabled in Crew in this run.

What is still unproven, and only a Crew run can show it: whether the native sub-agent mechanism registers the three specialists (the session-start notice names any target Crew leaves out), whether the sub-agent calls need an approval, and whether `kirocrew chat -m` honours the `allowedTools` of the specialists inside the Warden's turn. If a sub-agent call needs an approval, the patrol must stop there and the owner decides.

Owner step: press **Update** (or **Sync**) on the night-shift app page in the dashboard, then run the checks listed under "Checks after the update" at the end of this file.

The earlier findings below are the evidence from run 49d. Findings 1 and 2 concerned shell and file grants and `spawn_run`, which the agents no longer use. Finding 3 (the gateway PATH) is the reason for the restart the owner did.
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

## Findings from run 49d (superseded by the MCP-only design, except finding 4)

1. **`kirocrew chat` never honours pre-approvals for shell or file tools.** It answers each permission request itself (`cli_chat.py` 1046-1074). The docstring at 1070-1074 says a gate auto-approve "still asks". The request it builds carries the spec's refusals and leaves out its grants (1146-1156). With `-m` there is no terminal, so the request is denied (1266-1284). Only MCP tools in `allowedTools` skip the request. Observed: `night-shift validate --home '...'` and `Read File` were denied with "needs approval, and this invocation cannot ask".
2. **Spawns need a person.** See (b). A `kirocrew spawn run --agent seer` probe sat at "waiting for spawn approval" until it was approved from the dashboard approvals feed (`POST /api/approvals/spawn:<id>/approve`). The Warden's `spawn_run` goes through the same gate.
3. **Gateway sessions cannot find the npm global bin.** In that probe the Seer's grant worked: `night-shift diff ...` was approved with no prompt, and `git status` was refused with "Blocked by a permission rule (deny shell matching "*") ... Source: agent-profile". But the command then failed with "The term 'night-shift' is not recognized", and `night-shift:unseen` failed to start. `%APPDATA%\npm` is on the user PATH, so the running gateway probably started with an older PATH. That cause is unverified. Restarting the gateway, or adding `mcp.extra_path_dirs` to Crew's config, is the owner's choice and was not done.
4. **Reinstall on Windows.** `kirocrew app update` is "not available on native Windows". `kirocrew app uninstall` withdraws the app's trust grant (`apps/manager_uninstall.py` 123-167), and `kirocrew app enable` then fails with "third-party app execution is disabled". The grant the product lead had made from the dashboard at 16:15 was restored for `night-shift` only, through the same dashboard endpoint (`POST /api/security/trusted-apps/night-shift`), and the app was enabled with `POST /api/apps/night-shift/enable`. That is the only Crew state this work changed, and it puts back the earlier value.

## Options taken and left open

- **Taken (run 49e):** the Night Shift MCP server removes findings 1 for the Warden's own steps, and the specialists have no shell or file tools at all. Native sub-agents replace `spawn_run`, so no spawn approval of finding 2 should apply, if Crew registers them.
- **Finding 3:** the owner restarted Crew, and `night-shift` is now found as a bin in `%APPDATA%\npm`. Whether the gateway's new PATH reaches an MCP server start was not observed, because the app was not reinstalled.
- **Left open:** how the installed copy gets the new agent files (dashboard Update or Sync, or an uninstall that withdraws the trust grant).

## Checks after the update

1. `Get-Content $env:USERPROFILE\.kiro\agents\night-shift--warden.json` shows `allowedTools` with `@night-shift:shift/validate` and `toolsSettings.subagent`, and the other three files show their `allowedTools`.
2. `kirocrew agent validate ./agents` reports 0 problems.
3. `kirocrew chat --agent night-shift--warden -m "Run the Night Shift patrol with home D:\kiroween 2026\night-shift. Limit this run to at most 2 fixes."` with nobody at the keyboard. Save the output to `docs/patrol-transcripts/<date>-patrol-2.md`, removing only the Crew SECURITY warning lines.