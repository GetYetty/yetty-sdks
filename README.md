# yetty-sdks

Monorepo for Yetty's third-party API client packages.

## Packages

| Package | Description | Type |
|---------|-------------|------|
| [`@getyetty-sdk/pennylane`](packages/pennylane) | Pennylane accounting API | Generated from OpenAPI spec |
| [`@getyetty-sdk/qonto`](packages/qonto) | Qonto banking API | Generated from OpenAPI spec |
| [`@getyetty-sdk/sellsy`](packages/sellsy) | Sellsy CRM API | Generated from OpenAPI spec |

## Installation

```bash
npm install @getyetty-sdk/pennylane
npm install @getyetty-sdk/qonto
npm install @getyetty-sdk/sellsy
```

## Development

Requires Node.js >= 26 (see `.nvmrc`).

```bash
npm install          # Install all workspace dependencies
npm run build        # Build all packages
npm test             # Run all tests
npm run typecheck    # Type-check all packages
npm run lint         # Lint with oxlint
npm run format       # Format with oxfmt
```

To work on a single package:

```bash
npm run build -w @getyetty-sdk/pennylane
npm test -w @getyetty-sdk/pennylane
```

### Regenerating a client

Generated packages use [`@hey-api/openapi-ts`](https://github.com/hey-api/openapi-ts) to produce TypeScript clients from OpenAPI specs.

```bash
npm run generate -w @getyetty-sdk/pennylane
```

## Versioning

All packages use [CalVer](https://calver.org/) with the format `YYYY.M.D` (e.g. `2026.8.5`). A `-N` suffix is appended when multiple versions are published on the same day.

## Publishing

### Generated SDKs (Pennylane, Qonto, Sellsy)

A daily cron job ([`update-and-publish-generated.yml`](.github/workflows/update-and-publish-generated.yml)) checks each upstream OpenAPI spec for changes. When a change is detected, it regenerates the client, runs checks, bumps the version, and publishes to npm.

Can also be triggered manually via `workflow_dispatch`.

### Hand-written SDKs (future: Odoo, ZohoBooks, RubyPayeur)

Merged changes to `src/` trigger [`publish-on-merge.yml`](.github/workflows/publish-on-merge.yml), which runs checks, bumps the version, and publishes.

### Authentication

Publishing uses npm [Trusted Publishers (OIDC)](https://docs.npmjs.com/generating-provenance-statements) — no npm tokens needed. Each package has a trusted publisher configured on npmjs.com pointing to this repository and its workflow file.

## License

MIT
