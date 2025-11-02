# Fraud Detection Analytics Dashboard

React + TypeScript dashboard for visualizing fraud detection analytics data.

## Tech Stack

- **React 18** + **TypeScript** + **Vite**
- **shadcn/ui** - Beautiful component library
- **Tailwind CSS v4** - Styling
- **Recharts** - Declarative charts
- **Lucide React** - Icons

## Development

### Prerequisites

1. Copy `.env.example` to `.env` and add your API key:
   ```bash
   cp .env.example .env
   # Edit .env and set VITE_API_KEY=your-api-key
   ```

### Running Locally

From the **root** directory:
```bash
npm run dashboard:dev
```

Or from the **dashboard** directory:
```bash
npm run dev
```

This starts the dev server at http://localhost:5173

### Building

From the **root** directory:
```bash
npm run dashboard:build
```

Output goes to `public/dashboard/`

## Deployment

The dashboard is automatically built and deployed:

```bash
# From root directory
npm run deploy              # Build + typecheck + deploy
npm run deploy:skip-checks  # Build + deploy (no typecheck)
```

## API Endpoint

- **Endpoint**: `/admin/analytics`
- **Method**: GET
- **Auth**: X-API-Key header
- **Params**: `query` (SQL), `hours` (time range)

## Features

✅ 5 Stat Cards (Validations, Allows, Warns, Blocks, Latency)
✅ 3 Charts (Decisions, Risk Distribution, Timeline)
✅ Time Range Selector (1h, 6h, 24h, 7d, 30d)
✅ Dark Mode
✅ Responsive Design

## License

Part of the Bogus Email Pattern Recognition project.
