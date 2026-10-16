# tightlog-sync-api

Cloudflare Worker that syncs local SQL to remote SQL for tightlog.com.

## Requirements

- [Bun](https://bun.sh)
- A [Turso](https://turso.tech) database
- Optional: [Clerk](https://clerk.com) for account link and lost-phone adopt
- Optional: RevenueCat secret key for purchase-based restore

## Getting started

```sh
bun install
cp .dev.vars.example .dev.vars
```

Fill in `.dev.vars`, then apply the schema:

```sh
TURSO_DATABASE_URL=libsql://<your-database>.turso.io TURSO_AUTH_TOKEN=<token> bun run migrate
```

Start the Worker locally:

```sh
bun run dev
```

## Checks

```sh
bun run test
bun run ts:check
bun run lint
```
