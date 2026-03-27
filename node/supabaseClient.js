const browserClientPath = "../frontend/javascript/supabaseClient.js";

console.error(
  [
    "supabaseClient.js in /node is not a runnable Node script.",
    "It is a browser-side client and depends on window + the Supabase CDN script.",
    `Load ${browserClientPath} from your HTML page instead, or create a separate server-side Supabase client for Node.`,
  ].join(" "),
);

process.exitCode = 1;
