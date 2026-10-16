# tightlog-sync-api

Cloudflare Worker that syncs a local-first fishing logbook to [Turso](https://turso.tech) (libsql) for [tightlog.com](https://tightlog.com).

This repository is the public mirror of the sync Worker. Deploy hostnames, Cloudflare resource ids, and operator runbooks stay in the private monorepo.

## What it does

- Registers a device by key hash and syncs logbook rows (push / pull)
- Stores catch media in R2
- Optional [Clerk](https://clerk.com) link for lost-phone adopt
- Optional [RevenueCat](https://www.revenuecat.com) check for purchase-based restore
- [Apple App Attest](https://developer.apple.com/documentation/devicecheck/establishing_your_app_s_integrity) on the gated adopt routes when `APP_ATTEST_ENV=production`

## Requirements

- [Bun](https://bun.sh)
- A Turso database
- Optional: Clerk secret (and JWT key) for account link and adopt
- Optional: RevenueCat secret key for purchase-based restore
- Optional: Apple Team ID and App Attest bundle ids for production attest

## App Attest root CA

`vendor/app-attest` ships a **placeholder** PEM on purpose. Download Apple's App Attestation Root CA and replace `APPLE_APP_ATTEST_ROOT_CA_PEM` before you verify attestations:

https://www.apple.com/certificateauthority/Apple_App_Attestation_Root_CA.pem

Without that file, register and assertion checks cannot succeed against real devices.

## Getting started

```sh
bun install
cp .dev.vars.example .dev.vars
```

Fill in `.dev.vars`, then apply the schema:

```sh
TURSO_DATABASE_URL=libsql://<your-database>.turso.io TURSO_AUTH_TOKEN=<token> bun run migrate
```

Start the Worker locally (staging env in `wrangler.jsonc`):

```sh
bun run dev
```

`wrangler.jsonc` uses placeholders for rate-limit namespace ids and the R2 bucket name. Point those at your own Cloudflare resources before you deploy.

Staging sets `APP_ATTEST_ENV=development`, so local and simulator clients can call without assertions. Production requires attest on the gated routes.

## Checks

```sh
bun run test
bun run ts:check
bun run lint
```
