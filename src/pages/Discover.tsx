import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useClerkSupabaseSync } from "@/hooks/useClerkSupabaseSync";
import { Search, TrendingUp, Music, Image, Video, Headphones } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const fetchTrendingPosts = async () => {
  const { data, error } = await supabase
    .from("posts")
    .select(`
      *,
      songs (*),
      profiles (username, name, avatar_url),
      post_likes (id)
    `)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw error;

  // Sort by like count
  return (data || []).sort((a, b) => (b.post_likes?.length || 0) - (a.post_likes?.length || 0));
};

const fetchTrendingArtworks = async () => {
  const { data, error } = await supabase
    .from("artworks")
    .select(`
      *,
      posts (*),
      profiles:user_id (username, name, avatar_url)
    `)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw error;
  return data || [];
};

const fetchNewContent = async () => {
  const { data, error } = await supabase
    .from("posts")
    .select(`
      *,
      songs (*),
      profiles (username, name, avatar_url)
    `)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw error;
  return data || [];
};

export default function Discover() {
  useClerkSupabaseSync();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [sortBy, setSortBy] = useState("recent");

  useEffect(() => {
    document.title = "Discover | Looply";
  }, []);

  const { data: trendingPosts, isLoading: loadingPosts } = useQuery({
    queryKey: ["trending-posts"],
    queryFn: fetchTrendingPosts
  });

  const { data: trendingArtworks, isLoading: loadingArtworks } = useQuery({
    queryKey: ["trending-artworks"],
    queryFn: fetchTrendingArtworks
  });

  const { data: newContent, isLoading: loadingNew } = useQuery({
    queryKey: ["new-content"],
    queryFn: fetchNewContent
  });

  const getFileTypeIcon = (type: string) => {
    switch (type) {
      case "image": return <Image className="h-4 w-4" />;
      case "video": return <Video className="h-4 w-4" />;
      case "audio": return <Headphones className="h-4 w-4" />;
      default: return <Music className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <div className="container mx-auto max-w-6xl px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-4">Discover</h1>
          
          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search songs, artists, or users..."
                className="pl-10"
              />
            </div>
            
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Content</SelectItem>
                <SelectItem value="posts">Posts</SelectItem>
                <SelectItem value="artworks">Artworks</SelectItem>
                <SelectItem value="users">Users</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most Recent</SelectItem>
                <SelectItem value="popular">Most Popular</SelectItem>
                <SelectItem value="trending">Trending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs defaultValue="trending" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="trending">Trending</TabsTrigger>
            <TabsTrigger value="artworks">Artworks</TabsTrigger>
            <TabsTrigger value="new">New</TabsTrigger>
            <TabsTrigger value="foryou">For You</TabsTrigger>
          </TabsList>

          {/* Trending Posts */}
          <TabsContent value="trending" className="space-y-4">
            <div className="flex items-center space-x-2 mb-4">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Trending Songs</h2>
            </div>

            {loadingPosts ? (
              <div className="grid gap-4">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-4">
                      <div className="h-4 bg-muted rounded mb-2"></div>
                      <div className="h-24 bg-muted rounded"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid gap-4">
                {trendingPosts?.map((post, index) => (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <span className="text-sm font-bold text-primary">#{index + 1}</span>
                            {post.profiles?.avatar_url && (
                              <img
                                src={post.profiles.avatar_url}
                                alt="Avatar"
                                className="h-8 w-8 rounded-full"
                              />
                            )}
                            <div>
                              <p className="text-sm font-medium">
                                {post.profiles?.username || post.profiles?.name || "User"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {post.post_likes?.length || 0} likes
                              </p>
                            </div>
                          </div>
                          <Button variant="outline" size="sm" asChild>
                            <Link to={`/post/${post.id}`}>View</Link>
                          </Button>
                        </div>

                        {post.songs && (
                          <div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {post.songs.artist} — {post.songs.title}
                            </p>
                            <iframe
                              src={`https://open.spotify.com/embed/track/${post.songs.provider_song_id}`}
                              width="100%"
                              height="152"
                              frameBorder="0"
                              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                              loading="lazy"
                              className="rounded-lg"
                            />
                          </div>
                        )}

                        {post.caption && (
                          <p className="mt-3 text-sm">{post.caption}</p>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Trending Artworks */}
          <TabsContent value="artworks" className="space-y-4">
            <div className="flex items-center space-x-2 mb-4">
              <Image className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Trending Artworks</h2>
            </div>

            {loadingArtworks ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(9)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <div className="aspect-square bg-muted"></div>
                    <CardContent className="p-3">
                      <div className="h-4 bg-muted rounded"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {trendingArtworks?.map((artwork, index) => (
                  <motion.div
                    key={artwork.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className="overflow-hidden hover:shadow-md transition-shadow">
                      <div className="aspect-square relative">
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
                            muted
                            loop
                            onMouseEnter={(e) => e.currentTarget.play()}
                            onMouseLeave={(e) => e.currentTarget.pause()}
                          />
                        )}
                        {artwork.file_type === "audio" && (
                          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                            <Headphones className="h-12 w-12 text-primary" />
                          </div>
                        )}
                        <div className="absolute top-2 right-2">
                          {getFileTypeIcon(artwork.file_type)}
                        </div>
                      </div>
                      
                      <CardContent className="p-3">
                        <div className="flex items-center space-x-2 mb-2">
                          {artwork.profiles?.avatar_url && (
                            <img
                              src={artwork.profiles.avatar_url}
                              alt="Avatar"
                              className="h-6 w-6 rounded-full"
                            />
                          )}
                          <p className="text-sm font-medium">
                            {artwork.profiles?.username || artwork.profiles?.name || "User"}
                          </p>
                        </div>
                        
                        {artwork.title && (
                          <p className="text-sm font-medium mb-1">{artwork.title}</p>
                        )}
                        
                        {artwork.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {artwork.description}
                          </p>
                        )}

                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full mt-3" 
                          asChild
                        >
                          <Link to={`/post/${artwork.post_id}`}>View Post</Link>
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* New Content */}
          <TabsContent value="new" className="space-y-4">
            <div className="flex items-center space-x-2 mb-4">
              <Music className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">New Posts</h2>
            </div>

            {loadingNew ? (
              <div className="grid gap-4">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-4">
                      <div className="h-4 bg-muted rounded mb-2"></div>
                      <div className="h-24 bg-muted rounded"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid gap-4">
                {newContent?.map((post, index) => (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            {post.profiles?.avatar_url && (
                              <img
                                src={post.profiles.avatar_url}
                                alt="Avatar"
                                className="h-8 w-8 rounded-full"
                              />
                            )}
                            <div>
                              <p className="text-sm font-medium">
                                {post.profiles?.username || post.profiles?.name || "User"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(post.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <Button variant="outline" size="sm" asChild>
                            <Link to={`/post/${post.id}`}>View</Link>
                          </Button>
                        </div>

                        {post.songs && (
                          <div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {post.songs.artist} — {post.songs.title}
                            </p>
                            <iframe
                              src={`https://open.spotify.com/embed/track/${post.songs.provider_song_id}`}
                              width="100%"
                              height="152"
                              frameBorder="0"
                              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                              loading="lazy"
                              className="rounded-lg"
                            />
                          </div>
                        )}

                        {post.caption && (
                          <p className="mt-3 text-sm">{post.caption}</p>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* For You */}
          <TabsContent value="foryou">
            <Card>
              <CardContent className="p-12 text-center">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Personalized Feed Coming Soon</h3>
                <p className="text-muted-foreground">
                  We're working on AI-powered recommendations based on your music taste and activity.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}