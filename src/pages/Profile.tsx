import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useClerkSupabaseSync } from "@/hooks/useClerkSupabaseSync";
import { useSpotifyConnection } from "@/hooks/useSpotifyConnection";
import { getUserTopTracks, getUserTopArtists, getRecentlyPlayed, getSpotifyAuthUrl } from "@/lib/spotify";
import { Heart, Music, Users, Upload, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";

interface ProfileData {
  profile: any;
  posts: any[];
  artworks: any[];
  isOwnProfile: boolean;
  isFollowing: boolean;
}

const fetchProfile = async (userId: string, currentUserId?: string): Promise<ProfileData> => {
  const [
    { data: profile },
    { data: posts },
    { data: artworks },
    { data: following }
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", userId).single(),
    supabase.from("posts").select(`
      *,
      songs (*)
    `).eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("artworks").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    currentUserId ? supabase.from("followers").select("id").eq("follower_id", currentUserId).eq("following_id", userId).maybeSingle() : { data: null }
  ]);

  return {
    profile,
    posts: posts || [],
    artworks: artworks || [],
    isOwnProfile: currentUserId === userId,
    isFollowing: !!following
  };
};

export default function Profile() {
  useClerkSupabaseSync();
  const { id } = useParams<{ id: string }>();
  const { user } = useUser();
  const { isConnected: spotifyConnected } = useSpotifyConnection();
  const [spotifyData, setSpotifyData] = useState<any>({});

  const { data, isLoading } = useQuery({
    queryKey: ["profile", id],
    queryFn: () => fetchProfile(id!, user?.id),
    enabled: !!id
  });

  useEffect(() => {
    if (data?.profile) {
      document.title = `${data.profile.username || data.profile.name || "User"} | Looply`;
    }
  }, [data]);

  useEffect(() => {
    if (data?.isOwnProfile && spotifyConnected && user?.id) {
      Promise.all([
        getUserTopTracks(user.id, 10),
        getUserTopArtists(user.id, 10),
        getRecentlyPlayed(user.id, 10)
      ]).then(([topTracks, topArtists, recentlyPlayed]) => {
        setSpotifyData({ topTracks, topArtists, recentlyPlayed });
      });
    }
  }, [data?.isOwnProfile, spotifyConnected, user?.id]);

  const handleFollow = async () => {
    if (!user || !id) return;
    
    await supabase.rpc("toggle_follow", {
      _follower_id: user.id,
      _following_id: id
    });
    
    // Refetch profile data
    // queryClient.invalidateQueries({ queryKey: ["profile", id] });
  };

  const connectSpotify = () => {
    if (user?.id) {
      window.location.href = getSpotifyAuthUrl(user.id);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!data?.profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">Profile not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <div className="container mx-auto max-w-4xl px-4 py-6">
        {/* Profile Header */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center space-y-4 md:space-y-0 md:space-x-6">
              {data.profile.avatar_url && (
                <img
                  src={data.profile.avatar_url}
                  alt="Profile"
                  className="h-24 w-24 rounded-full"
                />
              )}
              
              <div className="flex-1">
                <h1 className="text-2xl font-bold">
                  {data.profile.username || data.profile.name || "User"}
                </h1>
                {data.profile.bio && (
                  <p className="text-muted-foreground mt-2">{data.profile.bio}</p>
                )}
                
                <div className="flex items-center space-x-6 mt-4">
                  <div className="text-center">
                    <p className="text-lg font-semibold">{data.profile.post_count || 0}</p>
                    <p className="text-sm text-muted-foreground">Posts</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold">{data.profile.follower_count || 0}</p>
                    <p className="text-sm text-muted-foreground">Followers</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold">{data.profile.following_count || 0}</p>
                    <p className="text-sm text-muted-foreground">Following</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col space-y-2">
                {!data.isOwnProfile && user && (
                  <Button
                    onClick={handleFollow}
                    variant={data.isFollowing ? "outline" : "default"}
                  >
                    {data.isFollowing ? "Unfollow" : "Follow"}
                  </Button>
                )}
                
                {data.isOwnProfile && !spotifyConnected && (
                  <Button onClick={connectSpotify} variant="outline">
                    <Music className="h-4 w-4 mr-2" />
                    Connect Spotify
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Content Tabs */}
        <Tabs defaultValue="posts" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="posts">Posts</TabsTrigger>
            <TabsTrigger value="artworks">Artworks</TabsTrigger>
            <TabsTrigger value="likes">Likes</TabsTrigger>
            {data.isOwnProfile && spotifyConnected && (
              <TabsTrigger value="spotify">Spotify</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="posts" className="space-y-4">
            {data.posts.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Music className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No posts yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {data.posts.map((post) => (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card className="cursor-pointer hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm text-muted-foreground">
                            {post.songs?.artist} — {post.songs?.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(post.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        {post.caption && (
                          <p className="mb-3">{post.caption}</p>
                        )}
                        <Button variant="outline" size="sm" asChild>
                          <a href={`/post/${post.id}`}>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            View Post
                          </a>
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="artworks" className="space-y-4">
            {data.artworks.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No artworks yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.artworks.map((artwork) => (
                  <motion.div
                    key={artwork.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <Card className="overflow-hidden">
                      <div className="aspect-square">
                        {artwork.file_type === "image" && (
                          <img
                            src={artwork.file_url}
                            alt={artwork.title || "Artwork"}
                            className="w-full h-full object-cover"
                          />
                        )}
                        {artwork.file_type === "video" && (
                          <video
                            src={artwork.file_url}
                            className="w-full h-full object-cover"
                            controls
                          />
                        )}
                        {artwork.file_type === "audio" && (
                          <div className="w-full h-full bg-muted flex items-center justify-center">
                            <Music className="h-12 w-12 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      {artwork.title && (
                        <CardContent className="p-3">
                          <p className="text-sm font-medium">{artwork.title}</p>
                        </CardContent>
                      )}
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="likes">
            <Card>
              <CardContent className="p-12 text-center">
                <Heart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Liked posts coming soon</p>
              </CardContent>
            </Card>
          </TabsContent>

          {data.isOwnProfile && spotifyConnected && (
            <TabsContent value="spotify" className="space-y-6">
              {/* Top Tracks */}
              {spotifyData.topTracks?.items && (
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Your Top Tracks</h3>
                    <div className="space-y-3">
                      {spotifyData.topTracks.items.slice(0, 5).map((track: any, i: number) => (
                        <div key={track.id} className="flex items-center space-x-3">
                          <span className="text-sm text-muted-foreground w-6">{i + 1}</span>
                          {track.album?.images?.[2] && (
                            <img
                              src={track.album.images[2].url}
                              alt="Album"
                              className="h-10 w-10 rounded"
                            />
                          )}
                          <div className="flex-1">
                            <p className="text-sm font-medium">{track.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {track.artists?.map((a: any) => a.name).join(", ")}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Top Artists */}
              {spotifyData.topArtists?.items && (
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4">Your Top Artists</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {spotifyData.topArtists.items.slice(0, 6).map((artist: any) => (
                        <div key={artist.id} className="text-center">
                          {artist.images?.[1] && (
                            <img
                              src={artist.images[1].url}
                              alt={artist.name}
                              className="h-20 w-20 rounded-full mx-auto mb-2"
                            />
                          )}
                          <p className="text-sm font-medium">{artist.name}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}