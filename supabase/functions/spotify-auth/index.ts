import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state"); // Clerk user ID

    if (!code || !state) {
      return new Response("Missing code or state", { status: 400, headers: corsHeaders });
    }

    const clientId = Deno.env.get("SPOTIFY_CLIENT_ID");
    const clientSecret = Deno.env.get("SPOTIFY_CLIENT_SECRET");
    const redirectUri = Deno.env.get("SPOTIFY_REDIRECT_URI"); // Must match Spotify app
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const frontendUrl = Deno.env.get("FRONTEND_URL");

    if (!clientId || !clientSecret || !redirectUri || !supabaseUrl || !supabaseKey || !frontendUrl) {
      return new Response("Server configuration error", { status: 500, headers: corsHeaders });
    }

    // Encode client credentials for Spotify token request
    const credentials = btoa(`${clientId}:${clientSecret}`);

    // Exchange code for access & refresh tokens
    const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token exchange failed:", errorText);
      return new Response("Token exchange failed", { status: 400, headers: corsHeaders });
    }

    const tokens = await tokenResponse.json();
    const expiresAt = new Date(Date.now() + (tokens.expires_in - 60) * 1000).toISOString();

    // Save tokens to Supabase
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { error } = await supabase.from("spotify_connections").upsert({
      user_id: state,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      scope: tokens.scope,
      token_type: tokens.token_type,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Database error:", error);
      return new Response("Database error", { status: 500, headers: corsHeaders });
    }

    // Fetch Spotify profile (optional)
    const profileResponse = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = profileResponse.ok ? await profileResponse.json() : null;

    // Redirect back to frontend /profile route
    const redirectUrl = new URL(`${frontendUrl}/profile/${state}`);
    redirectUrl.searchParams.set("spotify", "connected");
    if (profile?.display_name) redirectUrl.searchParams.set("name", profile.display_name);

    return new Response(null, {
      status: 302,
      headers: { Location: redirectUrl.toString(), ...corsHeaders },
    });

  } catch (err) {
    console.error("Spotify auth error:", err);
    return new Response("Internal server error", { status: 500, headers: corsHeaders });
  }
});
