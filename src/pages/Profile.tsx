import React, { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useClerkSupabaseSync } from "@/hooks/useClerkSupabaseSync";
import { MusicPersonaCard } from "@/components/persona/MusicPersonaCard";
import { MusicCompatibility } from "@/components/compatibility/MusicCompatibility";
import { FollowButton } from "@/components/social/FollowButton";
import {
  getUserTopTracks,
  getUserTopArtists,
  getRecentlyPlayed,
  getSpotifyAuthUrl
} from "@/lib/spotify";
import { Heart, Music, Users, Upload, ExternalLink, Check, Sparkles, Play, Crown, Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/hooks/use-toast";

interface ProfileData {
  profile: any;
  posts: any[];
  artworks: any[];
  isOwnProfile: boolean;
  isFollowing: boolean;
}

const fetchProfile = async (userId: string, currentUserId?: string): Promise<ProfileData> => {
  const [{ data: profile }, { data: posts }, { data: artworks }, { data: following }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).single(),
      supabase.from("posts").select(`*, songs (*)`).eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("artworks").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      currentUserId
        ? supabase.from("followers").select("id").eq("follower_id", currentUserId).eq("following_id", userId).maybeSingle()
        : { data: null }
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
  const navigate = useNavigate();
  const location = useLocation();

  const [spotifyData, setSpotifyData] = useState<any>({});
  const [otherUserSpotifyData, setOtherUserSpotifyData] = useState<any>({});
  const [isSpotifyConnected, setIsSpotifyConnected] = useState(false);
  const [otherUserSpotifyConnected, setOtherUserSpotifyConnected] = useState(false);
  const [isButtonAnimating, setIsButtonAnimating] = useState(false);

  // Use id from route if present, otherwise fallback to logged-in user
  const profileId = id || user?.id;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["profile", profileId],
    queryFn: () => fetchProfile(profileId!, user?.id),
    enabled: !!profileId
  });

  // Check Spotify connection
  const checkSpotifyConnection = async (profileIdToCheck: string) => {
    const { data: connection } = await supabase
      .from("spotify_connections")
      .select("user_id")
      .eq("user_id", profileIdToCheck)
      .maybeSingle();
    
    if (profileIdToCheck === user?.id || (data?.isOwnProfile && profileIdToCheck === profileId)) {
      setIsSpotifyConnected(!!connection);
    } else {
      setOtherUserSpotifyConnected(!!connection);
    }
  };

  useEffect(() => {
    if (profileId) {
      checkSpotifyConnection(profileId);
    }
    if (user?.id && profileId !== user.id) {
      checkSpotifyConnection(user.id);
    }
  }, [profileId, user?.id]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("spotify") === "connected") {
      const name = params.get("name") || "your account";
      toast({
        title: "Spotify Connected! 🎵",
        description: `Connected as ${name} - Your music persona is ready!`
      });
      setIsSpotifyConnected(true);
      setIsButtonAnimating(true);
      setTimeout(() => setIsButtonAnimating(false), 2000);
      navigate(location.pathname, { replace: true });
      refetch();
    }
  }, [location.search, navigate, refetch]);

  useEffect(() => {
    if (data?.profile) {
      const username = data.profile.username || data.profile.name || "User";
      document.title = `${username} | Looply`;
    }
  }, [data]);

  // Fetch Spotify data for profile owner
  useEffect(() => {
    if (profileId && (data?.isOwnProfile ? isSpotifyConnected : otherUserSpotifyConnected)) {
      Promise.all([
        getUserTopTracks(profileId, 20),
        getUserTopArtists(profileId, 20),
        getRecentlyPlayed(profileId, 20)
      ]).then(([topTracks, topArtists, recentlyPlayed]) => {
        if (data?.isOwnProfile) {
          setSpotifyData({ topTracks, topArtists, recentlyPlayed });
        } else {
          setOtherUserSpotifyData({ topTracks, topArtists, recentlyPlayed });
        }
      }).catch(console.error);
    }
  }, [data?.isOwnProfile, isSpotifyConnected, otherUserSpotifyConnected, profileId]);

  // Fetch current user's Spotify data when viewing other profiles (for compatibility)
  useEffect(() => {
    if (!data?.isOwnProfile && isSpotifyConnected && user?.id) {
      Promise.all([
        getUserTopTracks(user.id, 20),
        getUserTopArtists(user.id, 20),
        getRecentlyPlayed(user.id, 20)
      ]).then(([topTracks, topArtists, recentlyPlayed]) => {
        setSpotifyData({ topTracks, topArtists, recentlyPlayed });
      }).catch(console.error);
    }
  }, [data?.isOwnProfile, isSpotifyConnected, user?.id]);

  const connectSpotify = () => {
    if (!user?.id) return;
    window.location.href = getSpotifyAuthUrl(user.id);
  };

  const getPersonaData = (spotifyData: any, profile: any) => {
    const topArtist = spotifyData?.topArtists?.items?.[0]?.name;
    const topGenres = spotifyData?.topArtists?.items?.flatMap((artist: any) => artist.genres || []);
    const topGenre = topGenres?.[0];
    const favoriteSong = spotifyData?.topTracks?.items?.[0]?.name;
    
    return {
      topArtist,
      topGenre,
      favoriteSong,
      username: profile?.username || profile?.name || "User",
      playlistCount: 0, // Could fetch from Spotify API
      totalMinutes: 0 // Could calculate from listening history
    };
  };

  const handleFollowChange = (isFollowing: boolean) => {
    refetch(); // Refresh profile data to update follower counts
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Users className="h-12 w-12 text-[hsl(var(--viral-purple))]" />
        </motion.div>
      </div>
    );
  }

  if (!data?.profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive text-xl">Profile not found</p>
        </div>
      </div>
    );
  }

  const relevantSpotifyData = data.isOwnProfile ? spotifyData : otherUserSpotifyData;
  const relevantSpotifyConnection = data.isOwnProfile ? isSpotifyConnected : otherUserSpotifyConnected;
  const personaData = getPersonaData(relevantSpotifyData, data.profile);

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <div className="container mx-auto max-w-6xl px-4 py-6">
        
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid gap-6 md:grid-cols-3 mb-8"
        >
          {/* Profile Info */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="md:col-span-2"
          >
            <Card className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--viral-purple))]/10 to-[hsl(var(--viral-pink))]/10" />
              <CardContent className="relative p-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                  <motion.div 
                    className="relative"
                    whileHover={{ scale: 1.05 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    {data.profile.avatar_url ? (
                      <img
                        src={data.profile.avatar_url}
                        alt="Profile"
                        className="h-24 w-24 rounded-full border-4 border-[hsl(var(--viral-purple))]/20 shadow-lg"
                      />
                    ) : (
                      <div className="h-24 w-24 rounded-full bg-gradient-to-r from-[hsl(var(--viral-purple))] to-[hsl(var(--viral-pink))] flex items-center justify-center">
                        <Music className="h-12 w-12 text-white" />
                      </div>
                    )}
                    {relevantSpotifyConnection && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.5, type: "spring" }}
                        className="absolute -bottom-1 -right-1 bg-[hsl(var(--spotify-green))] rounded-full p-2 shadow-lg"
                      >
                        <Music className="h-4 w-4 text-white" />
                      </motion.div>
                    )}
                  </motion.div>

                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h1 className="text-3xl font-bold bg-gradient-to-r from-[hsl(var(--viral-purple))] to-[hsl(var(--viral-pink))] bg-clip-text text-transparent">
                        {data.profile.username || data.profile.name || "User"}
                      </h1>
                      {relevantSpotifyConnection && (
                        <Badge className="bg-gradient-to-r from-[hsl(var(--spotify-green))] to-[hsl(var(--viral-blue))] text-white">
                          <Sparkles className="h-3 w-3 mr-1" />
                          Connected
                        </Badge>
                      )}
                    </div>

                    {data.profile.bio && (
                      <p className="text-muted-foreground mb-4">{data.profile.bio}</p>
                    )}

                    {/* Stats Row */}
                    <div className="flex items-center gap-8">
                      <motion.div 
                        className="text-center"
                        whileHover={{ scale: 1.05 }}
                      >
                        <p className="text-2xl font-bold text-[hsl(var(--viral-purple))]">{data.profile.post_count || 0}</p>
                        <p className="text-sm text-muted-foreground">Posts</p>
                      </motion.div>
                      <motion.div 
                        className="text-center"
                        whileHover={{ scale: 1.05 }}
                      >
                        <p className="text-2xl font-bold text-[hsl(var(--viral-pink))]">{data.profile.follower_count || 0}</p>
                        <p className="text-sm text-muted-foreground">Followers</p>
                      </motion.div>
                      <motion.div 
                        className="text-center"
                        whileHover={{ scale: 1.05 }}
                      >
                        <p className="text-2xl font-bold text-[hsl(var(--viral-blue))]">{data.profile.following_count || 0}</p>
                        <p className="text-sm text-muted-foreground">Following</p>
                      </motion.div>
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="mt-6 flex gap-4">
                  {data.isOwnProfile ? (
                    <motion.div
                      animate={{ scale: isButtonAnimating ? [1, 1.1, 1] : 1 }}
                      transition={{ duration: 0.6 }}
                      className="flex-1"
                    >
                      {isSpotifyConnected ? (
                        <Button disabled className="w-full btn-spotify">
                          <Check className="h-5 w-5 mr-2" />
                          Spotify Connected
                        </Button>
                      ) : (
                        <Button onClick={connectSpotify} className="w-full btn-spotify">
                          <Music className="h-5 w-5 mr-2" />
                          Connect Spotify
                        </Button>
                      )}
                    </motion.div>
                  ) : user && (
                    <div className="flex-1">
                      <FollowButton
                        targetUserId={profileId!}
                        isFollowing={data.isFollowing}
                        onFollowChange={handleFollowChange}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Music Persona Card or Compatibility */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            {data.isOwnProfile ? (
              relevantSpotifyConnection ? (
                <MusicPersonaCard 
                  data={personaData} 
                  userId={profileId!}
                  isOwn={true}
                />
              ) : (
                <Card className="h-full">
                  <CardContent className="p-8 text-center h-full flex flex-col justify-center">
                    <Crown className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                    <h3 className="text-xl font-semibold mb-2">Create Your Music Persona</h3>
                    <p className="text-muted-foreground mb-4">Connect Spotify to generate your unique music identity card</p>
                    <Button onClick={connectSpotify} className="btn-viral">
                      <Music className="h-4 w-4 mr-2" />
                      Get Started
                    </Button>
                  </CardContent>
                </Card>
              )
            ) : (
              // Show compatibility when viewing other user's profile
              relevantSpotifyConnection && isSpotifyConnected ? (
                <MusicCompatibility
                  userSpotifyData={spotifyData}
                  otherUserSpotifyData={otherUserSpotifyData}
                  otherUsername={data.profile.username || data.profile.name}
                />
              ) : (
                <Card className="h-full">
                  <CardContent className="p-8 text-center h-full flex flex-col justify-center">
                    <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                    <h3 className="text-xl font-semibold mb-2">Music Compatibility</h3>
                    <p className="text-muted-foreground text-sm">
                      {!isSpotifyConnected ? "Connect your Spotify" : "User hasn't connected Spotify"} to see your music compatibility
                    </p>
                  </CardContent>
                </Card>
              )
            )}
          </motion.div>
        </div>

        {/* Content Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Tabs defaultValue="posts" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 bg-gradient-to-r from-[hsl(var(--viral-purple))]/10 to-[hsl(var(--viral-pink))]/10 p-1 rounded-2xl">
              <TabsTrigger value="posts" className="rounded-xl">Posts</TabsTrigger>
              <TabsTrigger value="artworks" className="rounded-xl">Artworks</TabsTrigger>
              <TabsTrigger value="likes" className="rounded-xl">Likes</TabsTrigger>
              {(data.isOwnProfile ? isSpotifyConnected : otherUserSpotifyConnected) && (
                <TabsTrigger value="spotify" className="rounded-xl">Spotify</TabsTrigger>
              )}
            </TabsList>

            {/* Posts Tab */}
            <TabsContent value="posts" className="space-y-4">
              {data.posts.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <Card>
                    <CardContent className="p-12 text-center">
                      <Music className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                      <h3 className="text-xl font-semibold mb-2">No posts yet</h3>
                      <p className="text-muted-foreground">
                        {data.isOwnProfile ? "Share your first song to get started!" : "This user hasn't posted anything yet"}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              ) : (
                <div className="grid gap-4">
                  <AnimatePresence>
                    {data.posts.map((post, index) => (
                      <motion.div
                        key={post.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        whileHover={{ y: -2 }}
                        className="group"
                      >
                        <Card className="overflow-hidden border-2 border-transparent group-hover:border-[hsl(var(--viral-purple))]/20 transition-all duration-300 glow-on-hover">
                          <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2">
                                <Play className="h-4 w-4 text-[hsl(var(--viral-purple))]" />
                                <p className="font-medium">
                                  {post.songs?.artist} — {post.songs?.title}
                                </p>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {new Date(post.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            {post.caption && (
                              <p className="mb-4 text-muted-foreground">{post.caption}</p>
                            )}
                            <Button variant="outline" size="sm" asChild className="group-hover:btn-viral transition-all">
                              <a href={`/post/${post.id}`}>
                                <ExternalLink className="h-4 w-4 mr-2" />
                                View Post
                              </a>
                            </Button>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </TabsContent>

            {/* Artworks Tab */}
            <TabsContent value="artworks" className="space-y-4">
              {data.artworks.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <Card>
                    <CardContent className="p-12 text-center">
                      <Upload className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                      <h3 className="text-xl font-semibold mb-2">No artworks yet</h3>
                      <p className="text-muted-foreground">
                        {data.isOwnProfile ? "Upload your creative works to showcase your talent!" : "This user hasn't uploaded any artworks"}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <AnimatePresence>
                    {data.artworks.map((artwork, index) => (
                      <motion.div
                        key={artwork.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.1 }}
                        whileHover={{ scale: 1.02, rotate: 1 }}
                        className="group"
                      >
                        <Card className="overflow-hidden glow-on-hover">
                          <div className="aspect-square relative">
                            {artwork.file_type === "image" && (
                              <img
                                src={artwork.file_url}
                                alt={artwork.title || "Artwork"}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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
                              <div className="w-full h-full bg-gradient-to-br from-[hsl(var(--viral-purple))] to-[hsl(var(--viral-pink))] flex items-center justify-center">
                                <Music className="h-16 w-16 text-white" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          </div>
                          {artwork.title && (
                            <CardContent className="p-4">
                              <p className="font-medium">{artwork.title}</p>
                            </CardContent>
                          )}
                        </Card>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </TabsContent>

            {/* Likes Tab */}
            <TabsContent value="likes">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <Card>
                  <CardContent className="p-12 text-center">
                    <Heart className="h-16 w-16 mx-auto mb-4 text-[hsl(var(--viral-pink))]" />
                    <h3 className="text-xl font-semibold mb-2">Liked Posts</h3>
                    <p className="text-muted-foreground">Coming soon! See all the posts you've loved</p>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Spotify Tab */}
            {(data.isOwnProfile ? isSpotifyConnected : otherUserSpotifyConnected) && (
              <TabsContent value="spotify" className="space-y-6">
                <AnimatePresence>
                  {relevantSpotifyData.topTracks?.items && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      <Card className="music-card">
                        <CardContent className="p-6 text-white">
                          <div className="flex items-center gap-2 mb-4">
                            <Star className="h-5 w-5" />
                            <h3 className="text-lg font-semibold">Top Tracks</h3>
                          </div>
                          <div className="space-y-4">
                            {relevantSpotifyData.topTracks.items.slice(0, 8).map((track: any, i: number) => (
                              <motion.div 
                                key={track.id} 
                                className="flex items-center space-x-4 bg-white/10 rounded-xl p-3 hover:bg-white/20 transition-all"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.3 + i * 0.1 }}
                              >
                                <span className="text-white/70 w-6 text-center font-bold">{i + 1}</span>
                                {track.album?.images?.[2] && (
                                  <img 
                                    src={track.album.images[2].url} 
                                    alt="Album" 
                                    className="h-12 w-12 rounded-lg shadow-lg" 
                                  />
                                )}
                                <div className="flex-1">
                                  <p className="font-medium">{track.name}</p>
                                  <p className="text-sm text-white/70">
                                    {track.artists?.map((a: any) => a.name).join(", ")}
                                  </p>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}

                  {relevantSpotifyData.topArtists?.items && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                    >
                      <Card className="persona-card">
                        <CardContent className="p-6">
                          <div className="flex items-center gap-2 mb-6">
                            <Crown className="h-5 w-5" />
                            <h3 className="text-lg font-semibold">Top Artists</h3>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            {relevantSpotifyData.topArtists.items.slice(0, 8).map((artist: any, i: number) => (
                              <motion.div 
                                key={artist.id} 
                                className="text-center group"
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.5 + i * 0.1 }}
                                whileHover={{ scale: 1.05 }}
                              >
                                <div className="relative mb-3">
                                  {artist.images?.[1] ? (
                                    <img 
                                      src={artist.images[1].url} 
                                      alt={artist.name} 
                                      className="h-20 w-20 rounded-full mx-auto shadow-xl group-hover:shadow-2xl transition-shadow" 
                                    />
                                  ) : (
                                    <div className="h-20 w-20 rounded-full mx-auto bg-white/20 flex items-center justify-center">
                                      <Music className="h-8 w-8" />
                                    </div>
                                  )}
                                  <div className="absolute -top-1 -right-1 bg-white/20 rounded-full px-2 py-1 text-xs font-bold">
                                    {i + 1}
                                  </div>
                                </div>
                                <p className="font-medium text-sm">{artist.name}</p>
                              </motion.div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>
              </TabsContent>
            )}
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}