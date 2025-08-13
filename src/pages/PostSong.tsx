import React, { useEffect, useMemo, useState } from "react";
import { useUser, SignedIn, SignedOut } from "@clerk/clerk-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useClerkSupabaseSync } from "@/hooks/useClerkSupabaseSync";

interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { name: string; images?: { url: string }[] };
}

const PostSong: React.FC = () => {
  useClerkSupabaseSync();
  const { isSignedIn, user } = useUser();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SpotifyTrack[]>([]);
  const [selected, setSelected] = useState<SpotifyTrack | null>(null);
  const [caption, setCaption] = useState("");

  useEffect(() => {
    document.title = "Post a Song | Looply";
    const desc = "Search Spotify and post your song with a caption.";
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!meta) { meta = document.createElement("meta"); meta.name = "description"; document.head.appendChild(meta); }
    meta.content = desc;
    const link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null || document.createElement("link");
    link.rel = "canonical"; link.href = `${window.location.origin}/post`; if (!link.parentElement) document.head.appendChild(link);
  }, []);

  const canSubmit = useMemo(() => isSignedIn && !!selected && caption.trim().length >= 0, [isSignedIn, selected, caption]);

  const search = async () => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("spotify-search", { body: { q } });
      if (error) throw error;
      setResults((data?.tracks || []) as SpotifyTrack[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!user || !selected) return;
    const artwork = selected.album.images?.[0]?.url || null;

    const { error } = await supabase.rpc("create_post", {
      _user_id: user.id,
      _song_provider: "spotify",
      _provider_song_id: selected.id,
      _title: selected.name,
      _artist: selected.artists?.[0]?.name || "",
      _album: selected.album?.name || null,
      _artwork_url: artwork,
      _caption: caption || null,
      _visibility: "public",
    });
    if (error) {
      console.error("create_post error", error.message);
      return;
    }
    // Redirect to feed
    window.location.href = "/feed";
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto max-w-3xl px-4 py-6 space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Post a Song</h1>

        <div className="flex gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search songs or artists" />
          <Button onClick={search} disabled={loading}>{loading ? "Searching…" : "Search"}</Button>
        </div>

        <div className="grid gap-3">
          {results.map((t) => (
            <Card key={t.id} onClick={() => setSelected(t)} className={`cursor-pointer ${selected?.id === t.id ? "ring-2" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  {t.album?.images?.[0]?.url && (
                    <img src={t.album.images[0].url} alt={`${t.name} cover`} className="h-12 w-12 rounded" loading="lazy" />
                  )}
                  <div className="flex-1">
                    <div className="font-medium">{t.name}</div>
                    <div className="text-sm text-muted-foreground">{t.artists?.[0]?.name} • {t.album?.name}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {selected && (
          <div className="space-y-3">
            <h2 className="text-lg font-medium">Caption</h2>
            <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Share why this track inspires you…" />
            <SignedIn>
              <Button onClick={submit} disabled={!canSubmit}>Publish</Button>
            </SignedIn>
            <SignedOut>
              <p className="text-sm text-muted-foreground">Sign in to post.</p>
            </SignedOut>
          </div>
        )}
      </div>
    </main>
  );
};

export default PostSong;
