# ListWise AI — Shopify App

AI-powered product listing & SEO generator for Shopify stores. Generates SEO-optimized titles, descriptions, meta descriptions, and tags for one product or a whole catalog, with a before/after review step and one-click publish back to the store. Monetized via Shopify's Billing API (recurring monthly subscriptions).

Built on Shopify's official [React Router app template](https://github.com/Shopify/shopify-app-template-react-router).

See [`../docs/SETUP_GUIDE.md`](../docs/SETUP_GUIDE.md) for the one-time account setup steps (Shopify Partner account, OpenAI API key, hosting) and [`../docs/DEPLOY.md`](../docs/DEPLOY.md) for deployment instructions.

## Project structure

- `app/routes/app._index.tsx` — main screen: product picker, AI generation, before/after review, apply-to-store.
- `app/routes/app.settings.tsx` — brand voice (tone) preference.
- `app/routes/app.billing.tsx` — plan selection and Shopify subscription billing.
- `app/lib/openai.server.ts` — OpenAI integration that generates the listing content.
- `app/lib/usage.server.ts` — per-shop usage tracking and free-tier/plan limits.
- `app/lib/plans.ts` — shared plan/pricing definitions (Free trial, Starter $9.99, Growth $29.99).
- `prisma/schema.prisma` — local dev database (SQLite).
- `prisma/schema.production.prisma` — production database (PostgreSQL), selected automatically by `scripts/prepare-db.mjs` when `DATABASE_URL` is a Postgres URL.

## Local development

### Prerequisites

- Node.js >= 20.19 (Node 22/24 also work)
- A free [Shopify Partner account](https://partners.shopify.com/signup) and a development store
- An [OpenAI API key](https://platform.openai.com/api-keys)

### Setup

```shell
npm install
cp .env.example .env   # then fill in SHOPIFY_API_KEY, SHOPIFY_API_SECRET, OPENAI_API_KEY
npx prisma migrate dev
```

### Run

```shell
npm run dev
```

This uses the Shopify CLI to log in, connect to your app/dev store, tunnel your local server, and give you a URL to install the app on your development store. Press `p` in the CLI to open it.

### Useful scripts

| Script | What it does |
|---|---|
| `npm run dev` | Local development via Shopify CLI (tunnel + hot reload) |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript check |
| `npm run setup` | Prepares the database for the current environment (SQLite locally, Postgres in production) and generates the Prisma client |
| `npm run deploy` | Deploys app configuration (scopes, webhooks) to Shopify |

## How billing works

Plans are defined in [`app/lib/plans.ts`](app/lib/plans.ts) and registered with Shopify's Billing API in [`app/shopify.server.ts`](app/shopify.server.ts). The free tier (20 generations, no card) is enforced in-app via [`app/lib/usage.server.ts`](app/lib/usage.server.ts); paid plans are billed and tracked by Shopify itself, so no separate payment processor account is needed.

## How AI generation works

`app/lib/openai.server.ts` sends the product's current title/description/type/vendor plus a brand-voice tone to OpenAI (`gpt-4o-mini` by default) and asks for a structured JSON response (title, description, meta description, tags). The result is shown next to the original for review before the merchant applies it, which calls the Shopify Admin GraphQL `productUpdate` mutation.

## Original template reference

For details on the underlying Shopify React Router app template (authentication, webhooks, GraphQL codegen, extensions), see [Shopify's app template docs](https://shopify.dev/docs/api/shopify-app-react-router).
