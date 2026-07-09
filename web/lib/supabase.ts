import { createClient } from "@supabase/supabase-js";

const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://mzfbppxjgwkqveviynvm.supabase.co";

// Chiave anon PUBBLICA: è sicura lato client perché la RLS su Supabase consente solo
// SELECT (nessuna scrittura). La service_role NON deve mai finire nel frontend.
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16ZmJwcHhqZ3drcXZldml5bnZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMzI0MDAsImV4cCI6MjA5NjYwODQwMH0.qiV6o7JI7vmooG3uFn5qk90Cd9ztczvDTDY9G2oP-SY";

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },
});
