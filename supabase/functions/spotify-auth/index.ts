import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const clientId = Deno.env.get("SPOTIFY_CLIENT_ID")!;
const clientSecret = Deno.env.get("SPOTIFY_CLIENT_SECRET")!;
const redirectUri = "https://kfvovretlqyxvlmlyonv.supabase.co/functions/v1/spotify-auth";

const PROD_FRONTEND_URL = "https://looply-weld.vercel.app";
const DEV_FRONTEND_URL = "http://localhost:8080";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state"); // user ID
    const error = url.searchParams.get("error");

    if (error) return new Response(`Spotify auth failed: ${error}`, { status: 400 });
    if (!code || !state) return new Response("Missing code or state", { status: 400 });

    // Exchange code for access token
    const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": "Basic " + btoa(`${clientId}:${clientSecret}`)
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri
      })
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error("Spotify token exchange failed:", errText);
      return new Response("Failed to exchange token", { status: 400 });
    }

    const tokens = await tokenResponse.json();

    // Save tokens in Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase.from("spotify_connections").upsert({
      user_id: state,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      scope: tokens.scope,
      token_type: tokens.token_type,
      expires_at: new Date(Date.now() + (tokens.expires_in - 60) * 1000).toISOString(),
      updated_at: new Date().toISOString()
    });

    // Redirect to dev or prod frontend
    const redirectBase = state.includes("localhost") ? DEV_FRONTEND_URL : PROD_FRONTEND_URL;
    const redirectUrl = `${redirectBase}/profile/${encodeURIComponent(state)}?spotify=connected`;

    return Response.redirect(redirectUrl, 302);

  } catch (err) {
    console.error("Spotify auth function error:", err);
    return new Response("Internal server error", { status: 500 });
  }
});
