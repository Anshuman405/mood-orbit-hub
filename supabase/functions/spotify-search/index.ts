import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { q } = await req.json();
    if (!q || typeof q !== "string") {
      return new Response(JSON.stringify({ error: "Missing q" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const clientId = Deno.env.get("SPOTIFY_CLIENT_ID");
    const clientSecret = Deno.env.get("SPOTIFY_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({ error: "Spotify secrets not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const tokenResp = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${clientId}:${clientSecret}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!tokenResp.ok) {
      const txt = await tokenResp.text();
      throw new Error(`Failed to get token: ${txt}`);
    }

    const { access_token } = await tokenResp.json();

    const searchUrl = new URL("https://api.spotify.com/v1/search");
    searchUrl.searchParams.set("type", "track");
    searchUrl.searchParams.set("limit", "10");
    searchUrl.searchParams.set("q", q);

    const tracksResp = await fetch(searchUrl.toString(), {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!tracksResp.ok) {
      const txt = await tracksResp.text();
      throw new Error(`Search failed: ${txt}`);
    }

    const data = await tracksResp.json();
    const tracks = (data.tracks?.items || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      artists: t.artists?.map((a: any) => ({ name: a.name })) || [],
      album: { name: t.album?.name, images: t.album?.images?.map((i: any) => ({ url: i.url })) || [] },
    }));

    return new Response(JSON.stringify({ tracks }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("spotify-search error", error);
    return new Response(JSON.stringify({ error: "Unexpected error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
