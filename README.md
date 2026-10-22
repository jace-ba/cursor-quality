# quality-guardrails

A local Cursor plugin. It adds evidence, scope, and verification rules to every project on this machine, and two hooks that flag private-context wording and secrets.

Node must be on `PATH`. The hooks run `node ./scripts/scan-edit.mjs` and `node ./scripts/scan-commit.mjs`. Those paths are relative to the plugin root, which is the directory Cursor uses when it runs a plugin hook.

## Install

From this repository:

```
node install.mjs
```

That copies the plugin to `%USERPROFILE%\.cursor\plugins\local\quality-guardrails`, replacing any previous copy. It does not copy `.git` or `install.mjs`.

Then run **Developer: Reload Window**. In Customize, the plugin should show one always-on rule, ten task-scoped rules, and two hooks.

## Update

Edit this repository, run `node install.mjs` again, and reload the window.

## What it checks

- After an edit, docs, UI copy, content, tests, and code comments are checked for private-context wording. Every edit is checked for secrets.
- Before `git commit`, the message and the staged diff get the same checks. A hit asks for review.

When a tool fails, the always-on rule already tells the agent to report the failure and not fill in a result. There is no hook for that.

Cloud agents do not load plugins from `~/.cursor/plugins/local`. On another machine, clone this repository and run `node install.mjs` once.
