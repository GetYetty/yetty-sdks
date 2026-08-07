# @getyetty-sdk/rubypayeur

TypeScript client for the [RubyPayeur](https://rubypayeur.com) scoring and debt recovery APIs.

## Install

```bash
npm install @getyetty-sdk/rubypayeur
```

## Usage

### Scoring

```ts
import { RubyPayeurScoringClient } from '@getyetty-sdk/rubypayeur';

const scoring = new RubyPayeurScoringClient({
  apiToken: process.env.RUBYPAYEUR_SCORING_TOKEN,
});

const result = await scoring.getCompanyScoring('123456789');
// { score: 75, letter: 'A', color: 'dark_green', risk: 'Very low - excellent credit rating' }
```

### Debt recovery (Recouvrement)

```ts
import { RubyPayeurRecouvrementClient } from '@getyetty-sdk/rubypayeur';

const client = new RubyPayeurRecouvrementClient({
  apiToken: process.env.RUBYPAYEUR_RECOUVREMENT_TOKEN,
  isProduction: true,
});

// Validate credentials
const valid = await client.validateCredentials();

// Create a debt recovery case
const debt = await client.createDebt({
  debtor: {
    name: 'Acme Corp',
    registrationNumber: '123456789',
    gender: 'male',
    firstName: 'Jean',
    lastName: 'Dupont',
    email: 'contact@acme.fr',
  },
  invoices: [
    {
      reference: 'FA-2024-001',
      amountDueCents: 150000,
      issuedOn: '2024-01-15',
      dueOn: '2024-02-15',
    },
  ],
  lateFee: true,
});

// Fetch a single debt by reference
const single = await client.getDebt('ABC123');

// Fetch all debts (paginated automatically)
const all = await client.getDebts([]);

// Fetch specific debts by reference
const filtered = await client.getDebts(['REF-1', 'REF-2']);

// Iterate page by page (memory-efficient for large datasets)
for await (const page of client.iterateDebts()) {
  console.log(`Got ${page.length} debts`);
  // break early if needed — remaining pages won't be fetched
}
```

### Custom logger

All clients accept an optional `logger` for structured logging:

```ts
const client = new RubyPayeurRecouvrementClient({
  apiToken: '...',
  isProduction: true,
  logger: {
    log: (msg) => console.log(msg),
    warn: (msg) => console.warn(msg),
    error: (msg) => console.error(msg),
  },
});
```

## Error handling

The SDK throws typed errors you can catch individually:

| Error                 | When                                                  |
| --------------------- | ----------------------------------------------------- |
| `AuthenticationError` | Invalid or expired API token                          |
| `NotFoundError`       | Resource not found (404 or empty result)              |
| `ValidationError`     | Validation failed (422), `.fieldErrors` has details   |
| `RateLimitedError`    | Rate limited (429), `.retryAfterSeconds` if available |
| `ServerError`         | 5xx after exhausting retries, `.statusCode` available |
| `ResponseShapeError`  | API response didn't match expected Zod schema         |

All errors extend `RubyPayeurError`.

## Features

- Automatic authentication with token caching and transparent re-auth on 401
- Retry with exponential backoff on 5xx and network errors (3 retries)
- Zod runtime validation at API response boundaries with `.passthrough()` for forward compatibility
- Test mode: set `isProduction: false` to use a sandbox SIREN

## License

MIT
