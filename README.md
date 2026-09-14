<p align="center">
  <a href="https://roots.io/bedrock/">
    <img alt="Bedrock" src="https://cdn.roots.io/app/uploads/logo-bedrock.svg" height="100">
  </a>
</p>

<p align="center">
  <a href="https://packagist.org/packages/roots/bedrock"><img alt="Packagist Installs" src="https://img.shields.io/packagist/dt/roots/bedrock?label=projects%20created&colorB=2b3072&colorA=525ddc&style=flat-square"></a>
  <a href="https://packagist.org/packages/roots/wordpress"><img alt="roots/wordpress Packagist Downloads" src="https://img.shields.io/packagist/dt/roots/wordpress?label=roots%2Fwordpress%20downloads&logo=roots&logoColor=white&colorB=2b3072&colorA=525ddc&style=flat-square"></a>
  <img src="https://img.shields.io/badge/dynamic/json.svg?url=https://raw.githubusercontent.com/roots/bedrock/master/composer.json&label=wordpress&logo=roots&logoColor=white&query=$.require[%22roots/wordpress%22]&colorB=2b3072&colorA=525ddc&style=flat-square">
  <a href="https://github.com/roots/bedrock/actions/workflows/ci.yml"><img alt="Build Status" src="https://img.shields.io/github/actions/workflow/status/roots/bedrock/ci.yml?branch=master&logo=github&label=CI&style=flat-square"></a>
  <a href="https://twitter.com/rootswp"><img alt="Follow Roots" src="https://img.shields.io/badge/follow%20@rootswp-1da1f2?logo=twitter&logoColor=ffffff&message=&style=flat-square"></a>
  <a href="https://github.com/sponsors/roots"><img src="https://img.shields.io/badge/sponsor%20roots-525ddc?logo=github&style=flat-square&logoColor=ffffff&message=" alt="Sponsor Roots"></a>
</p>

<p align="center">WordPress boilerplate with Composer, easier configuration, and an improved folder structure</p>

<p align="center">
  <a href="https://roots.io/bedrock/">Website</a> &nbsp;&nbsp; <a href="https://roots.io/bedrock/docs/installation/">Documentation</a> &nbsp;&nbsp; <a href="https://github.com/roots/bedrock/releases">Releases</a> &nbsp;&nbsp; <a href="https://discourse.roots.io/">Community</a>
</p>

Bedrock is a WordPress boilerplate for developers that want to manage their projects with Git and Composer. Much of the philosophy behind Bedrock is inspired by the [Twelve-Factor App](http://12factor.net/) methodology, including the [WordPress specific version](https://roots.io/twelve-factor-wordpress/).

- Better folder structure
- Dependency management with [Composer](https://getcomposer.org)
  - [`roots/wordpress`](https://wp-packages.org/wordpress-core) package for WordPress core
  - [WP Packages](https://wp-packages.org/) repository for WordPress plugins and themes
- Easy WordPress configuration with environment specific files
- Environment variables with [Dotenv](https://github.com/vlucas/phpdotenv)
- Autoloader for mu-plugins (use regular plugins as mu-plugins)

## Getting Started

See the [Bedrock installation documentation](https://roots.io/bedrock/docs/installation/).

## Local development

### Pre-requesites

- docker
- php
- composer
- ddev
- export NODE_EXTRA_CA_CERTS=<PATH_TO_YOUR_CERTIFICATE_FILE>

### Steps

Please follow the steps in ddev installation [guide](https://ddev.com/get-started/) and then 

1. Execute `ddev composer install`
3. Start your local Wordpress server (refer to this [section](#wordpress-dev-serveur))
4. Open the Wordpress website (refer to this [section](wordpress-dev-serveur)) and configure your user
5. Open the profile page, scroll to the bottom and create an application password
2. Set your credentials in .env file, follow .env.example. \
Use the password generated at previous step

### Install and activate a plugin

Add the plugin to `composer.json` and install it with Composer through DDEV. Replace `<plugin-slug>` and `<version>` with the plugin package and version you need:

```bash
ddev composer require wp-plugin/<plugin-slug>:<version>
```

Then activate the installed plugin in WordPress:

```bash
ddev wp plugin activate <plugin-slug>
```

The Composer command updates both `composer.json` and `composer.lock`, so commit both files with the change.


### Local self-signed certificate

For local HTTPS development, generate a self-signed certificate and private key
in the ignored `certs/` directory:

```bash
mkdir -p certs
openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 365 \
  -keyout certs/privkey.pem \
  -out certs/fullchain.pem \
  -subj '/CN=localhost' \
  -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1'
chmod 600 certs/privkey.pem
chmod 644 certs/fullchain.pem
```

Copy `.env.example` to `.env` and set the certificate paths:

```dotenv
TLS_CERTIFICATE_PATH=./certs/fullchain.pem
TLS_PRIVATE_KEY_PATH=./certs/privkey.pem
```

The certificate is trusted only by clients that explicitly trust it. A browser
will normally display a certificate warning for this self-signed certificate.
Do not use it for production; production deployments must provide a trusted
certificate and matching private key.

> An intermediate docker image is used to provision the self sign certificate used by the company. Without it ddev fails to pull the dependencies.

## Provision

### Missing shortcodes after migration

If an imported Elementor page displays a shortcode as plain text, for example `[resah_latest_news count="3"]`, WordPress has not loaded the PHP code that registers that shortcode. The page export only contains the shortcode usage; it does not export the custom handler registered with `add_shortcode()`.

In this project, Resah-specific shortcode handlers must be imported as custom code under `web/app/mu-plugins/`. A missing shortcode therefore usually means a missing MU plugin or another missing custom code file from the existing site.

After importing the missing file, validate that WordPress can see the shortcode:

```bash
ddev wp eval 'echo shortcode_exists("resah_latest_news") ? "exists" : "missing"; echo PHP_EOL;'
```

### Deploying migrated code and content

When deploying a migrated instance, deploy the Git-tracked Bedrock codebase, the database/content changes, and the uploaded media together. Imported pages can reference custom shortcodes, hooks, filters, and files under `wp-content/uploads`; in Bedrock those uploaded files live under `web/app/uploads/`.

For a selective local-to-public content release, use the planned idempotent resource publisher described in [specs/idempotent-resource-publisher.md](specs/idempotent-resource-publisher.md). It uses a named, reviewed migration manifest with explicit local and production resource IDs and a production revision guard; do not use a database import when the target must retain unrelated public changes.

The production release is strictly ordered: 
1. If needed install any new or updated dependencies 
2. If any, restart wordpress to enable plugin activation or update
2. deploy the committed Bedrock code first via scp/ftp/gitlab (less likely)
3. then deploy/update WordPress resources. 

The resource publisher does not deploy PHP, plugins, themes, or uploaded files. On the production host, fetch the reviewed commit and install the locked dependencies before applying resources:

```bash
git fetch origin
git checkout <reviewed-commit>
composer install --no-dev --prefer-dist --optimize-autoloader
```

Verify that the deployed code and required files are present, especially `web/app/mu-plugins/` and `web/app/uploads/`. Only after that code deployment succeeds, from the release environment run the manifest in dry-run mode and review it, then apply the resource changes:

```bash
node --env-file=.env --use-system-ca publish.resources.js migrations/<release>.json
node --env-file=.env --use-system-ca publish.resources.js --apply migrations/<release>.json
```

Do not run `--apply` before the reviewed code commit and its Composer dependencies are live on production. Record the deployed commit, dependency-install result, dry-run output, and apply output with the release.

Make sure every custom Resah MU plugin required by the migrated content is committed and deployed under `web/app/mu-plugins/`. For example, the homepage shortcodes `[resah_latest_news]` and `[resah_upcoming_events]` require their shortcode registration code to be deployed with the project, not only the Elementor page data.

Make sure the target instance also receives the relevant uploaded files from `wp-content/uploads` / `web/app/uploads`, otherwise migrated pages may render with broken images, PDFs, or other media links even when the database import succeeds.

Before considering a deployment complete, check the target instance:

```bash
ddev wp eval 'echo shortcode_exists("resah_latest_news") ? "exists" : "missing"; echo PHP_EOL;'
ddev wp eval 'echo shortcode_exists("resah_upcoming_events") ? "exists" : "missing"; echo PHP_EOL;'
```

If either command returns `missing`, deploy the corresponding custom code from `web/app/mu-plugins/` before importing or validating the affected pages.

## Old page provisioning

Those tools are intended to import pages, category from archive to the new Wordpress instance. 

### Status 

- [x] base implementation
- [x] test import into local instance
- [] validate imported pages are compatible with required plugins and configuration 

### Pages

Example 

``` bash
node --env-file=.env --use-system-ca provision.page.js backup/pages 2066
```

### Categories

Example 

``` bash
node --env-file=./.env --use-system-ca provision.page.js backup/category 2066
```

> The last parameter is optional, when it is set the tool will only migrate the corresponding page

## Useful commands

### Look for specific string inside a file and relace every occurence recursively

`find . -type f -exec sed -i 's|/wp-content|\/app|g' {} +`

## Tooling

### Start dev sever

#### Wordpress dev serveur

To start a wordpress dev server 
``` bash
ddev start
```
To open wordpress website in your browser use the following command :

``` bash
ddev launch
```

#### Local archive server

1. Using npm script

``` bash
npm run dev
```

2. Manual command

To start a local server serving the archive resources run the followin command :  

``` bash
node --env-file=./.env --use-system-ca server.js <PATH_LOCAL_WAYBACK_DIRECTORY>
```

The tool also accept the path to the `index.html` file :

``` bash
node --env-file=./.env --use-system-ca server.js <PATH_LOCAL_WAYBACK_DIRECTORY> <PATH_TO_INDEX_HTML>
```

> note :
> Parameters are optionals. Path are also read from environment variables.
> Cf .env.example
>
> Important path must be absolute