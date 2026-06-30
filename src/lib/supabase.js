import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder_key'

// Only create the client if we have real credentials, otherwise create a dummy client or just let it fail gracefully later
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
