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


### Certificate issues 

> An intermediate docker image is used to provision the self sign certificate used by the company. Without it ddev fails to pull the dependencies.

## Provision

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