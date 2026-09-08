# Project Guidelines

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

## Plugin Activation

- After Composer installs a plugin, activate it with:

  ```bash
  ddev wp plugin activate <plugin-slug>
  ```

- DDEV WP-CLI may be used for activation and WordPress administration, but not for installing or updating Composer-managed plugins.

## Local Development

- Install the project dependencies with `ddev composer install`.
- Start the local site with `ddev start` and open it with `ddev launch`.
- Follow the local development prerequisites, certificate notes, provisioning commands, and plugin workflow in [README.md](README.md).

## Validation

- Run `ddev composer validate` after changing Composer files.
- Run the relevant project tests with `ddev composer test` when code changes require them.
