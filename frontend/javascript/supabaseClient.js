// Shared browser-side Supabase client for frontend pages.
// Load this after the Supabase CDN script and before page scripts such as
// signup.js or login.js.

const supabaseUrl = "https://lccxastuypekuugcxrgs.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjY3hhc3R1eXBla3V1Z2N4cmdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMDEyOTMsImV4cCI6MjA4OTg3NzI5M30.x-LA_z27k2wcLcL-ImLDNil9eOZiwp1St4lzJJvV9jo";

if (!window.supabase || typeof window.supabase.createClient !== "function") {
  throw new Error(
    "Supabase CDN library is missing. Load the Supabase browser script before supabaseClient.js.",
  );
}

if (supabaseAnonKey === "REPLACE_WITH_YOUR_SUPABASE_ANON_KEY") {
  console.warn(
    "Supabase anon key is still a placeholder in frontend/javascript/supabaseClient.js.",
  );
}

window.supabaseClient = window.supabase.createClient(
  supabaseUrl,
  supabaseAnonKey,
);
