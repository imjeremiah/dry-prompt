# Supabase Database Setup

To complete the Phase 2 implementation, you need to set up the database tables in your Supabase project.

## Option 1: Using Supabase Dashboard (Recommended)

1. **Open Supabase Dashboard:**
   - Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - Log into your account
   - Select your project: `***REMOVED***`

2. **Navigate to SQL Editor:**
   - Click on "SQL Editor" in the left sidebar
   - Click "New query"

3. **Execute the Database Schema:**
   - Copy the entire contents of `scripts/setup-supabase-tables.sql`
   - Paste it into the SQL editor
   - Click "RUN" to execute the script

## Option 2: Using Supabase CLI

If you prefer using the CLI, install PostgreSQL tools first:

```bash
# Install PostgreSQL client tools (macOS)
brew install postgresql

# Then run the setup script
PGPASSWORD="***REMOVED***" psql \
  -h ***REMOVED*** \
  -p 6543 \
  -U postgres.***REMOVED*** \
  -d postgres \
  -f scripts/setup-supabase-tables.sql
```

## What This Creates

The setup script creates:

1. **`suggestions` table**: Stores AI-generated suggestions and user feedback
   - `id`: Unique identifier
   - `trigger`: Keyboard shortcut trigger (e.g., `;explain`)
   - `replacement`: Full text replacement
   - `source_texts`: Array of original prompts that led to this suggestion
   - `confidence`: AI confidence score (0-1)
   - `status`: User feedback (`pending`, `accepted`, `rejected`)
   - `created_at`, `updated_at`: Timestamps

2. **`analysis_results` table**: Stores analysis performance metrics
   - `id`: Unique identifier
   - `total_prompts`: Number of prompts analyzed
   - `clusters_found`: Number of clusters discovered
   - `suggestions_generated`: Number of suggestions created
   - `analysis_timestamp`: When the analysis was run
   - `processing_time_ms`: How long the analysis took

3. **Indexes and Triggers**: For optimal performance and automatic timestamp updates

4. **Row Level Security**: Basic security policies for data protection

## Verification

After running the setup, verify the tables exist by running this query in the SQL editor:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('suggestions', 'analysis_results');
```

You should see both tables listed.

## Next Steps

Once the database is set up:

1. **Test the connection**: Run `npm run dev` and check the console for "Supabase service initialized successfully"
2. **Test the workflow**: Use "Add Sample Data" and then "Analyze Now" from the menu bar
3. **Verify data storage**: Check the Supabase dashboard to see if suggestions and analysis results are being stored

The application will continue to work even if Supabase is not available (it will log warnings and continue with local functionality only). 