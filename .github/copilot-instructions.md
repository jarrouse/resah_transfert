# Project Guidelines

## Response Style

- Keep responses concise and focused on the user's request.

## Dependency Management

- Use DDEV for project commands.
- Install and update PHP dependencies with `ddev composer`.
- Install WordPress plugins and themes through Composer so `composer.json` and `composer.lock` track the dependency.
- Do not use `ddev wp plugin install`, `ddev wp plugin update`, or manual downloads for dependencies or plugins.
- For plugins, use the `wp-plugin/<plugin-slug>` package from the configured WP Packages repository when available. Example:

  ```bash
  ddev composer require wp-plugin/<plugin-slug>:<version>
  ```

- Commit both `composer.json` and `composer.lock` after changing dependencies.

## Response token efficiency protocol

- Default save prompt tokens response behavior: short, direct, no filler, no praise, no redundant recap.
- Use Action-Compressed for implementation and tool-driven tasks.
- Load .github/skills/response-token-efficiency-core/SKILL.md only when response-mode guidance beyond these defaults is needed.
- For mixed tasks, do action first, then explanation.
- State uncertainty and failures clearly.

## Local Development

- Install the project dependencies with `ddev composer install`.
- Start the local site with `ddev start` and open it with `ddev launch`.
- Follow the local development prerequisites, certificate notes, provisioning commands, and plugin workflow in [README.md](README.md).

