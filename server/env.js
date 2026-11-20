// Server configuration, read from environment variables (see .env.example).
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  supabaseAnon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  supabaseService: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  anthropicKey: process.env.ANTHROPIC_API_KEY || '',
  model: process.env.HT_CLAUDE_MODEL || 'claude-sonnet-5-5',
  openWearablesUrl: process.env.OPEN_WEARABLES_URL || '',
  openWearablesKey: process.env.OPEN_WEARABLES_API_KEY || '',
  junctionKey: process.env.JUNCTION_API_KEY || '',
  junctionEnv: process.env.JUNCTION_ENV || 'sandbox', // sandbox | production
  junctionRegion: process.env.JUNCTION_REGION || 'us',
};
export const hasSupabase = () => !!(env.supabaseUrl && env.supabaseAnon && env.supabaseService);
