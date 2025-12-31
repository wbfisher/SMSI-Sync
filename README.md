# SMSI Sync

Data synchronization dashboard for SMSI systems. Connects Zoho Creator, Zoho CRM, Sage Intacct, ADP, and other platforms through a unified sync layer.

## Stack

- **Framework**: Next.js 14 (App Router)
- **UI**: Tailwind CSS + shadcn/ui components
- **Database**: Supabase (PostgreSQL)
- **Job Queue**: Inngest
- **Hosting**: Vercel

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd smsi-sync
npm install
```

### 2. Set up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Run the schema SQL from `../smsi_sync_schema.sql` in the SQL editor
3. Copy your project URL and keys

### 3. Set up Inngest

1. Create an account at [inngest.com](https://inngest.com)
2. Create a new app called "smsi-sync"
3. Copy your event key and signing key

### 4. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
INNGEST_EVENT_KEY=your-inngest-event-key
INNGEST_SIGNING_KEY=your-inngest-signing-key
```

### 5. Run locally

```bash
# Terminal 1: Start Next.js
npm run dev

# Terminal 2: Start Inngest dev server
npm run inngest-dev
```

Open [http://localhost:3000](http://localhost:3000) to see the dashboard.

## Deployment

### Vercel

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Inngest

After deploying to Vercel:

1. Go to Inngest dashboard
2. Add your production URL: `https://your-app.vercel.app/api/inngest`
3. Inngest will automatically discover your functions

## Project Structure

```
smsi-sync/
├── app/
│   ├── api/
│   │   ├── inngest/route.ts    # Inngest webhook endpoint
│   │   └── sync/route.ts       # Manual sync trigger API
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                # Main dashboard
├── components/
│   ├── sync-dashboard.tsx      # Jobs table + activity feed
│   └── sync-sidebar.tsx        # Navigation + status counts
├── lib/
│   ├── inngest.ts              # Inngest client + sync functions
│   ├── supabase.ts             # Supabase client + types
│   └── utils.ts                # Helpers
├── types/
│   └── supabase.ts             # Database types
└── ...
```

## Adding a New Sync Integration

1. Add the system to the `systems` table in Supabase
2. Add an entry to `sync_apps` table
3. Implement the sync handler in `lib/inngest.ts`:

```typescript
async function syncNewSystem(): Promise<SyncResult> {
  // 1. Fetch data from external API
  // 2. Transform to canonical schema
  // 3. Upsert to Supabase
  // 4. Update external_ids mappings
  // 5. Return results
}
```

4. Add the case to the switch statement in `syncApp` function

## Sync Handlers (TODO)

The following sync handlers need implementation in `lib/inngest.ts`:

- [ ] `syncCreator()` - Zoho Creator ↔ Supabase
- [ ] `syncCRM()` - Zoho CRM ↔ Supabase  
- [ ] `syncIntacct()` - Sage Intacct ↔ Supabase
- [ ] `syncADP()` - ADP → Supabase (import only)
- [ ] `syncAbsorb()` - Absorb LMS → Supabase (import only)
- [ ] `syncRamp()` - Ramp → Supabase (import only)

Each handler should:
1. Authenticate with the external API
2. Fetch changed records since last sync
3. Transform data to canonical Supabase schema
4. Use `upsert_external_id()` to maintain ID mappings
5. Update `sync_status` for each record
6. Return `{ processed, created, updated, failed, error? }`

## License

Private - SMSI Internal Use Only
