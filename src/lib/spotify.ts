import { supabase } from "@/integrations/supabase/client";

export async function getSpotifyAccessToken(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke("spotify-refresh", {
      body: { user_id: userId }
    });
    
    if (error) throw error;
    return data?.access_token || null;
  } catch (error) {
    console.error("Error getting Spotify token:", error);
    return null;
  }
}

export async function getUserTopTracks(userId: string, limit = 20) {
  try {
    const token = await getSpotifyAccessToken(userId);
    if (!token) return null;

    const response = await fetch(`https://api.spotify.com/v1/me/top/tracks?limit=${limit}&time_range=medium_term`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) throw new Error("Failed to fetch top tracks");
    return await response.json();
  } catch (error) {
    console.error("Error fetching top tracks:", error);
    return null;
  }
}

export async function getUserTopArtists(userId: string, limit = 20) {
  try {
    const token = await getSpotifyAccessToken(userId);
    if (!token) return null;

    const response = await fetch(`https://api.spotify.com/v1/me/top/artists?limit=${limit}&time_range=medium_term`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) throw new Error("Failed to fetch top artists");
    return await response.json();
  } catch (error) {
    console.error("Error fetching top artists:", error);
    return null;
  }
}

export async function getRecentlyPlayed(userId: string, limit = 20) {
  try {
    const token = await getSpotifyAccessToken(userId);
    if (!token) return null;

    const response = await fetch(`https://api.spotify.com/v1/me/player/recently-played?limit=${limit}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) throw new Error("Failed to fetch recently played");
    return await response.json();
  } catch (error) {
    console.error("Error fetching recently played:", error);
    return null;
  }
}

export function getSpotifyAuthUrl(userId: string): string {
  const scopes = [
    "user-read-email",
    "user-read-private", 
    "user-top-read",
    "user-read-recently-played",
    "playlist-read-private",
    "user-library-read"
  ].join(" ");

  const params = new URLSearchParams({
    client_id: "5b744144e87d4b1bbbe3e0b6281f8570",
    response_type: "code",
    redirect_uri: `https://kfvovretlqyxvlmlyonv.supabase.co/functions/v1/spotify-auth`,
    scope: scopes,
    state: userId,
  });

  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function checkSpotifyConnection(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("spotify_connections")
      .select("user_id")
      .eq("user_id", userId)
      .single();
    
    return !error && !!data;
  } catch (error) {
    return false;
  }
}