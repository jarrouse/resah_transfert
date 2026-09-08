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


### Certificate issues 

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

When deploying a migrated instance, deploy the Git-tracked Bedrock codebase and the database/content changes together. Imported pages can reference custom shortcodes, hooks, or filters that only work when the matching PHP code is present on the target instance.

Make sure every custom Resah MU plugin required by the migrated content is committed and deployed under `web/app/mu-plugins/`. For example, the homepage shortcodes `[resah_latest_news]` and `[resah_upcoming_events]` require their shortcode registration code to be deployed with the project, not only the Elementor page data.

Before considering a deployment complete, check the target instance:

```bash
wp eval 'echo shortcode_exists("resah_latest_news") ? "exists" : "missing"; echo PHP_EOL;'
wp eval 'echo shortcode_exists("resah_upcoming_events") ? "exists" : "missing"; echo PHP_EOL;'
```

If either command returns `missing`, deploy the corresponding custom code from `web/app/mu-plugins/` before importing or validating the affected pages.

### Pages

Example 

``` bash
node --env-file=.env --use-system-ca provision.page.js migrations/pages/index.json
```

### Categories

Example 

``` bash
node --env-file=./.env --use-system-ca provision.page.js migrations/pages 2066
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

To start a local server serving the archive resources run the followin command :  

``` bash
node  node --env-file=./.env --use-system-ca server.js <PATH_LOCAL_WAYBACK_DIRECTORY>
```

The tool also accept the path to the `index.html` file :

``` bash
node  node --env-file=./.env --use-system-ca server.js <PATH_LOCAL_WAYBACK_DIRECTORY> <PATH_TO_INDEX_HTML>
```