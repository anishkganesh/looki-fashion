# Looki — fashion intelligence dashboard

A brand-oriented fashion application for importing product catalogs, collecting trend signals, generating product recommendations and campaign drafts, and exploring the data through AI chat.

## Overview

Looki connects a Next.js dashboard to Supabase and external AI/search services. It includes account and brand context, catalog ingestion, trend-processing routes, recommendations, campaigns, generated images, and persisted chat sessions. The resulting outputs are research/merchandising aids rather than proven forecasts or automatic retailer transactions.

## Features

- Supabase signup/login and brand/profile settings.
- Catalog upload, field mapping, manual/website imports, and retailer-specific ingestion routes.
- Trend collection, filtering, enrichment, and brand-aware views.
- Product/trend matching and generated recommendation reasons.
- Campaign drafts that associate products and trends, with image-generation support.
- Contextual chat, web-search support, uploaded-file context, and saved conversations.
- Dashboard tables, metrics, and language-switching support.

## Architecture

1. The root page routes into the dashboard, which requires a signed-in session.
2. Supabase stores users, brands, products, trends, recommendations, campaigns, and chat-related records.
3. Catalog routes normalize/import product data and record import progress.
4. Trend scraping combines Firecrawl retrieval, category logic, fuzzy matching, and OpenAI enrichment.
5. Recommendation/campaign routes combine database records with rule-based category matching and AI-generated analysis/content.
6. Image routes call DALL-E 3; text-model settings are centralized in AI configuration helpers.

Some paths supply fallback content when generation fails. A generated campaign or recommendation is not evidence that a retailer executed an action or that a trend prediction was validated.

## Tech stack

| Layer | Implementation |
| --- | --- |
| Application | Next.js 15, React, TypeScript |
| Interface | Tailwind CSS, Radix/shadcn components, charts and data tables |
| Identity/data/storage | Supabase Auth, Postgres, Storage |
| Text and image generation | OpenAI |
| Search and scraping | Firecrawl and route-specific retrieval code |
| Localization | i18n resources and language-switching components |

## Project structure

- `app/dashboard/`, `app/profile/`, `app/catalog-integration/` — application views.
- `app/api/` — catalog, trend, recommendation, campaign, chat, and image routes.
- `components/` — data tables, chat, imports, profiles, and localization UI.
- `lib/` — AI configuration, clients, category matching, and application services.
- `scripts/migrations/` and `supabase/migrations/` — schema updates.
- `.env.example` — baseline environment template.
- Additional root guides — migration, deployment, translation, and recommendation notes.

## Run locally

```bash
git clone https://github.com/anishkganesh/Looki.git
cd Looki
npm ci
```

Copy `.env.example` to `.env.local` and fill in your own settings:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
OPENAI_API_KEY=your-openai-key
FIRECRAWL_API_KEY=your-firecrawl-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET=your-private-cron-secret
```

Provision the schema, storage policies, and authentication configuration before running:

```bash
npm run dev
```

Open `http://localhost:3000` and sign in. For production, use `npm run build` and `npm start`.

## Configuration and data

The dashboard and APIs need tables beyond only `usr` and `trends`: queries also use `brands`, `products`, `recommendations`, `campaigns`, `campaign_products`, trend sources, and catalog import-progress records. Review the SQL scripts and exact queries, including existing migration prerequisites. The committed patches are not a complete verified bootstrap for an empty database.

Set `NEXT_PUBLIC_APP_URL` to the deployed origin when server routes call other application routes. Keep privileged keys server-side. Configure storage buckets/policies to match the product/document import paths.

`/api/cron/catalog-sync` checks a bearer value against `CRON_SECRET`. A cron route is included, but a committed Vercel schedule is not; configure a scheduler explicitly instead of assuming it already runs. Review retailer access and provider limits before scheduling imports.

## Usage

Create/select a brand, import a catalog, collect trends, and inspect recommendations or campaign drafts. Use source/product context in chat and verify generated analysis. Catalog import, campaign generation, and scraping write data and can incur API costs.

## Validation

Available project checks are `npm run lint` and `npm run build`. Manually verify authentication, brand isolation, catalog import progress, trend persistence, matching/recommendation generation, campaign associations, image generation, and chat saving. This documentation review did not run the application, imports, or paid generation.

## Deployment

Deploy the Next.js app with the same provisioned Supabase resources and production environment. Configure Auth redirects and the application origin. Long-running imports/scrapes may need a durable worker rather than a single serverless request. Explicitly configure any scheduler and inspect its authorization.

## Limitations

- Missing database columns, policies, or import data can interrupt individual workflows.
- AI and scraping outputs can be inaccurate, incomplete, or unavailable.
- Some fallback content and dashboard values require careful interpretation.
- No benchmark establishes forecast accuracy or commercial outcomes.

## Attribution and license

Retailer/source content and dependencies retain their respective terms. No standalone license file is included; this README does not grant a new license.
