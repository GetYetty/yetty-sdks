# @getyetty-sdk/zohobooks

TypeScript client for the ZohoBooks API -- authenticated HTTP, OAuth2, and rate limiting.

## Installation

```bash
npm install @getyetty-sdk/zohobooks
```

## Usage

```typescript
import { ZohoBooksTokenManager, ZohoBooksApiClient } from '@getyetty-sdk/zohobooks';

const tokenManager = new ZohoBooksTokenManager({
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  refreshToken: 'your-refresh-token',
  region: 'eu',
});

const client = new ZohoBooksApiClient({
  tokenManager,
  organizationId: 'your-org-id',
  region: 'eu',
});

const invoices = await client.get('/invoices');
```

## Testing

```typescript
import { FakeApiClient, buildInvoice } from '@getyetty-sdk/zohobooks/testing';

const fake = new FakeApiClient()
  .seedResponse('/invoices', { invoices: [buildInvoice()] });
```
