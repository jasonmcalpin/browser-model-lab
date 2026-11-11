# Install in Codex

This repository is a template/source for guidance, **not** an automatically activated plugin. Installing one part does not install the other.

## Repository-local guidance

Copy the root `AGENTS.md` into a target project's root and merge it with existing project-specific instructions. Keep domain contracts and project commands in that project's own instructions.

## Repository-local skills

Copy desired folders from `.agents/skills/` into the target repository's `.agents/skills/`. Each skill's `SKILL.md` provides its discoverable `name` and `description`.

## Personal installation

To reuse across local Codex projects, merge the general guidance into `~/.codex/AGENTS.md` and copy selected skill directories to `~/.agents/skills/`.

Example on macOS/Linux, **from this repository's root** (review target files before overwriting):

```sh
mkdir -p ~/.codex ~/.agents/skills
# First inspect/merge AGENTS.md with any existing ~/.codex/AGENTS.md.
cp -R .agents/skills/. ~/.agents/skills/
```

For Windows, use the corresponding paths beneath your home directory (for example `%USERPROFILE%\.codex\AGENTS.md` and `%USERPROFILE%\.agents\skills\`). Copying files does not require a service, but restart or begin a fresh Codex session if changes are not picked up.

**Important:** Do not overwrite existing global guidance without reviewing precedence and conflicts. Install project-specific rules at project scope when they differ from global defaults.

## Validate installation

1. Start a new Codex session in a sample repository.
2. Ask which repository guidance applies, and request an architecture review or regression fix using a corresponding skill.
3. Confirm the agent can find the skill and identifies acceptance criteria and verification evidence.
4. For `requirements-review`, run a representative substantial request with explicit skill invocation, then try the same request without naming the skill in a fresh session. Record whether it was discovered and selected; do not assume automatic invocation from the response alone.
5. Run the positive and negative controls in [requirements-review acceptance cases](REQUIREMENTS_REVIEW_CASES.md), withholding the expected findings until after the response. Record missing requirements, false positives, and whether required findings include observable acceptance criteria.
6. Inspect an actual code diff; instructions influence behavior but cannot guarantee compliance.

Consult [official Codex documentation](https://developers.openai.com/codex/) for evolving discovery and precedence rules.
