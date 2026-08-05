import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: './business_api.yml',
  output: {
    path: './src/generated',
  },
  plugins: [
    '@hey-api/schemas',
    {
      enums: 'javascript',
      name: '@hey-api/typescript',
    },
    {
      name: '@hey-api/sdk',
    },
  ],
});
