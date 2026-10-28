# quality-guardrails

A local Cursor plugin. It adds evidence, scope, and verification rules to every project on this machine. Hooks flag private-context wording and secrets, block a Cursor attribution trailer, and in a collaborative repository block a push to the default branch.

Node must be on `PATH`. Hook commands are relative to the plugin root, which is the directory Cursor uses when it runs a plugin hook.

## Install

From this repository:

```
node install.mjs
```

That copies the plugin to `%USERPROFILE%\.cursor\plugins\local\quality-guardrails`, replacing any previous copy. It does not copy `.git` or `install.mjs`.

Then run **Developer: Reload Window**. In Customize, the plugin should show one always-on rule, eleven task-scoped rules, and four hooks.

## Update

Edit this repository, run `node install.mjs` again, and reload the window.

## What it checks

- After an edit, docs, UI copy, content, tests, and code comments are checked for private-context wording. Every edit is checked for secrets.
- Before `git commit`, the message and the staged diff get the same checks. A hit asks for review.
- Before `git commit`, a Cursor co-author or Made-with trailer is denied unless this clone sets `quality.allowAgentTrailer` to `true`.
- At session start, each workspace root is checked. When a repository is collaborative, the session is told why, how to opt out, and to read the collaboration rule.

When a tool fails, the always-on rule already tells the agent to report the failure and not fill in a result. There is no hook for that.

## Collaborative repositories

`quality.collaborative` set to `true` or `false` always wins. When it is unset, a repository is collaborative if any of these is true:

- Someone other than `git config user.email` has committed to the cached `origin` default branch in the last 60 days. This reads the local copy and does not fetch.
- A `CODEOWNERS` file exists at the repository root, in `.github/`, or in `docs/`.
- The default branch is protected on GitHub. This uses `gh api` with a short timeout, and it is skipped when `gh` is missing, not signed in, or the remote is not GitHub.

The default branch is `refs/remotes/origin/HEAD`, then `main`, then `master`.

In a collaborative repository the collaboration rule applies, and a push whose destination is the default branch is denied. Push a feature branch and open a pull request. The check reads the command text, so Cursor's Commit and Push button is not covered.

These local git settings change that behavior:

- `git config quality.collaborative false` turns detection off for this clone. `true` forces it on.
- `git config quality.allowDefaultBranchPush true` allows a push to the default branch.
- `git config quality.allowAgentTrailer true` allows a Cursor co-author or Made-with trailer.

## Attribution

Turn off Cursor's own attribution as well. In Settings, open Git & Pull Requests, then turn off Commit Attribution and PR Attribution. The commit hook only sees a trailer when it is already in the command.

Cloud agents do not load plugins from `~/.cursor/plugins/local`, and they have no switch for this trailer. On another machine, clone this repository and run `node install.mjs` once.
