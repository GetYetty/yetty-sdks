# @getyetty-sdk/zohobooks

TypeScript client for the ZohoBooks API, auto-generated from the OpenAPI spec with hand-written OAuth2 and token management utilities.

## Installation

```bash
npm install @getyetty-sdk/zohobooks
```

## Usage

```typescript
import { createClient, createConfig } from '@getyetty-sdk/zohobooks';

const client = createClient(
  createConfig({
    baseUrl: 'https://www.zohoapis.eu/books/v3',
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
    },
  }),
);
```

## Testing

```typescript
import {
  FakeOAuthClient,
  FakeTokenManager,
  buildOrganization,
} from '@getyetty-sdk/zohobooks/testing';
```
