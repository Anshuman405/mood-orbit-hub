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
    const { user_id } = await req.json();
    
    if (!user_id) {
      return new Response("Missing user_id", { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get current tokens
    const { data: connection, error: fetchError } = await supabase
      .from("spotify_connections")
      .select("*")
      .eq("user_id", user_id)
      .single();

    if (fetchError || !connection) {
      return new Response("No Spotify connection found", { status: 404 });
    }

    // Check if token is still valid
    if (new Date(connection.expires_at).getTime() > Date.now()) {
      return new Response(JSON.stringify({ access_token: connection.access_token }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Refresh the token
    const refreshResponse = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": "Basic " + btoa(`${Deno.env.get("SPOTIFY_CLIENT_ID")}:${Deno.env.get("SPOTIFY_CLIENT_SECRET")}`)
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: connection.refresh_token,
      }),
    });

    if (!refreshResponse.ok) {
      const errorText = await refreshResponse.text();
      console.error("Token refresh failed:", errorText);
      return new Response("Token refresh failed", { status: 400 });
    }

    const tokens = await refreshResponse.json();
    const expiresAt = new Date(Date.now() + (tokens.expires_in - 60) * 1000).toISOString();

    // Update tokens in database
    const { error: updateError } = await supabase
      .from("spotify_connections")
      .update({
        access_token: tokens.access_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user_id);

    if (updateError) {
      console.error("Token update failed:", updateError);
      return new Response("Token update failed", { status: 500 });
    }

    return new Response(JSON.stringify({ access_token: tokens.access_token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Spotify refresh error:", error);
    return new Response("Internal server error", { status: 500, headers: corsHeaders });
  }
});