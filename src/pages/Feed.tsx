import React, { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useUser, SignedIn, SignedOut } from "@clerk/clerk-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useClerkSupabaseSync } from "@/hooks/useClerkSupabaseSync";

interface PostRow { id: string; user_id: string; song_id: string; caption: string | null; created_at: string }
interface SongRow { id: string; provider: string; provider_song_id: string; title: string; artist: string; album?: string | null; artwork_url?: string | null }
interface ProfileRow { user_id: string; username?: string | null; name?: string | null; avatar_url?: string | null }

const fetchPosts = async (limit = 20, offset = 0) => {
  const { data: posts, error } = await supabase
    .from("posts")
    .select("id,user_id,song_id,caption,created_at")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;

  const results = await Promise.all(
    (posts as PostRow[]).map(async (p) => {
      const [{ data: song }, { data: profile }] = await Promise.all([
        supabase.from("songs").select("id,provider,provider_song_id,title,artist,album,artwork_url").eq("id", p.song_id).maybeSingle(),
        supabase.from("profiles").select("user_id,username,name,avatar_url").eq("user_id", p.user_id).maybeSingle(),
      ]);
      return { post: p, song: song as SongRow | null, profile: profile as ProfileRow | null };
    })
  );

  return results;
};

const Feed: React.FC = () => {
  useClerkSupabaseSync();
  const { user } = useUser();
  const qc = useQueryClient();

  useEffect(() => {
    document.title = "Looply Feed | Looply";
    const desc = "Discover music posts and creative remixes on Looply.";
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!meta) { meta = document.createElement("meta"); meta.name = "description"; document.head.appendChild(meta); }
    meta.content = desc;
    const link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null || document.createElement("link");
    link.rel = "canonical"; link.href = `${window.location.origin}/feed`; if (!link.parentElement) document.head.appendChild(link);
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ["feed", { limit: 20, offset: 0 }],
    queryFn: () => fetchPosts(20, 0),
  });

  useEffect(() => {
    const channel = supabase
      .channel("posts-changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, () => {
        qc.invalidateQueries({ queryKey: ["feed", { limit: 20, offset: 0 }] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const items = data || [];

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto max-w-3xl px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold tracking-tight">Feed</h1>
          <div className="flex gap-2">
            <Button asChild size="sm"><Link to="/post">Post a song</Link></Button>
          </div>
        </div>

        {isLoading && <p className="text-muted-foreground">Loading…</p>}
        {error && <p className="text-destructive">Failed to load feed.</p>}

        <div className="grid gap-4">
          {items.map(({ post, song, profile }) => (
            <Card key={post.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  {profile?.avatar_url && (
                    <Link to={`/profile/${profile.user_id}`}><img src={profile.avatar_url} alt={`${profile.username || profile.name || "user"} avatar`} className="h-8 w-8 rounded-full" loading="lazy" /></Link>
                  )}
                  <div>
                    <div className="text-sm font-medium">
                      <Link to={`/profile/${profile.user_id}`}>{profile?.username || profile?.name || "@user"}</Link>
                    </div>
                    <div className="text-xs text-muted-foreground">{new Date(post.created_at).toLocaleString()}</div>
                  </div>
                </div>

                {song && (
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">{song.artist} — {song.title}</div>
                    <iframe
                      title={`Spotify player for ${song.title}`}
                      src={`https://open.spotify.com/embed/track/${song.provider_song_id}`}
                      width="100%"
                      height="152"
                      loading="lazy"
                      style={{ borderRadius: 12 }}
                      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    />
                  </div>
                )}

                {post.caption && <p className="text-sm">{post.caption}</p>}

                <SignedIn>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={async () => {
                        if (!user) return;
                        await supabase.rpc("toggle_like", { _user_id: user.id, _post_id: post.id });
                      }}
                    >
                      ❤ Like
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/post/${post.id}`}>Open</Link>
                    </Button>
                  </div>
                </SignedIn>

                <SignedOut>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/auth">Sign in to interact</Link>
                  </Button>
                </SignedOut>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
};

export default Feed;
