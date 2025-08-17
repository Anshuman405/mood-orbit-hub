import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useClerkSupabaseSync } from "@/hooks/useClerkSupabaseSync";
import { Heart, MessageCircle, Share2, Music, Upload } from "lucide-react";
import { motion } from "framer-motion";

interface PostData {
  post: any;
  song: any;
  profile: any;
  artworks: any[];
  comments: any[];
  likes: any[];
  userLiked: boolean;
}

const fetchPostDetail = async (postId: string, userId?: string): Promise<PostData> => {
  // Get post with song and profile
  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("*")
    .eq("id", postId)
    .single();

  if (postError) throw postError;

  const [
    { data: song },
    { data: profile },
    { data: artworks },
    { data: comments },
    { data: likes },
    { data: userLike }
  ] = await Promise.all([
    supabase.from("songs").select("*").eq("id", post.song_id).single(),
    supabase.from("profiles").select("*").eq("user_id", post.user_id).single(),
    supabase.from("artworks").select("*").eq("post_id", postId).order("created_at", { ascending: false }),
    supabase.from("post_comments").select(`
      *,
      profiles:user_id (username, name, avatar_url)
    `).eq("post_id", postId).order("created_at", { ascending: false }),
    supabase.from("post_likes").select("user_id").eq("post_id", postId),
    userId ? supabase.from("post_likes").select("id").eq("post_id", postId).eq("user_id", userId).maybeSingle() : { data: null }
  ]);

  return {
    post,
    song,
    profile,
    artworks: artworks || [],
    comments: comments || [],
    likes: likes || [],
    userLiked: !!userLike
  };
};

export default function PostDetail() {
  useClerkSupabaseSync();
  const { id } = useParams<{ id: string }>();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [aiIdeas, setAiIdeas] = useState<any>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["post", id],
    queryFn: () => fetchPostDetail(id!, user?.id),
    enabled: !!id
  });

  useEffect(() => {
    if (data?.song) {
      document.title = `${data.song.title} by ${data.song.artist} | Looply`;
    }
  }, [data]);

  const handleLike = async () => {
    if (!user || !id) return;
    
    await supabase.rpc("toggle_like", {
      _user_id: user.id,
      _post_id: id
    });
    
    queryClient.invalidateQueries({ queryKey: ["post", id] });
  };

  const handleComment = async () => {
    if (!user || !comment.trim() || !id) return;

    await supabase.rpc("add_comment", {
      _user_id: user.id,
      _post_id: id,
      _content: comment.trim()
    });

    setComment("");
    queryClient.invalidateQueries({ queryKey: ["post", id] });
  };

  const fetchAIIdeas = async () => {
    if (!data?.song) return;

    try {
      const { data: ideas, error } = await supabase.functions.invoke("ai-ideas", {
        body: {
          songTitle: data.song.title,
          artist: data.song.artist,
          mood: "inspired",
          userId: user?.id
        }
      });

      if (!error) {
        setAiIdeas(ideas);
      }
    } catch (error) {
      console.error("Error fetching AI ideas:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Music className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
          <p>Loading post...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">Failed to load post</p>
          <Button asChild className="mt-4">
            <Link to="/feed">Back to Feed</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <div className="container mx-auto max-w-4xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Post */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardContent className="p-6">
                {/* User Info */}
                <div className="flex items-center space-x-3 mb-4">
                  {data.profile?.avatar_url && (
                    <Link to={`/profile/${data.profile.user_id}`}>
                      <img 
                        src={data.profile.avatar_url} 
                        alt="Avatar" 
                        className="h-10 w-10 rounded-full"
                      />
                    </Link>
                  )}
                  <div>
                    <p className="font-medium">
                      <Link to={`/profile/${data.profile.user_id}`}>{data.profile?.username || data.profile?.name || "User"}</Link>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(data.post.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Song */}
                {data.song && (
                  <div className="mb-4">
                    <p className="text-sm text-muted-foreground mb-2">
                      {data.song.artist} — {data.song.title}
                    </p>
                    <iframe
                      src={`https://open.spotify.com/embed/track/${data.song.provider_song_id}`}
                      width="100%"
                      height="152"
                      frameBorder="0"
                      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                      loading="lazy"
                      className="rounded-lg"
                    />
                  </div>
                )}

                {/* Caption */}
                {data.post.caption && (
                  <p className="mb-4">{data.post.caption}</p>
                )}

                {/* Actions */}
                <div className="flex items-center space-x-4">
                  <Button
                    variant={data.userLiked ? "default" : "outline"}
                    size="sm"
                    onClick={handleLike}
                    disabled={!user}
                  >
                    <Heart className="h-4 w-4 mr-2" />
                    {data.likes.length}
                  </Button>
                  
                  <Button variant="outline" size="sm">
                    <MessageCircle className="h-4 w-4 mr-2" />
                    {data.comments.length}
                  </Button>
                  
                  <Button variant="outline" size="sm">
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </Button>

                  <Button asChild variant="outline" size="sm">
                    <Link to={`/upload?remix=${id}`}>
                      <Upload className="h-4 w-4 mr-2" />
                      Remix
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Artworks/Remixes */}
            {data.artworks.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Artistic Responses</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data.artworks.map((artwork) => (
                      <motion.div
                        key={artwork.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="space-y-2"
                      >
                        {artwork.file_type === "image" && (
                          <img
                            src={artwork.file_url}
                            alt={artwork.title || "Artwork"}
                            className="w-full h-40 object-cover rounded-lg"
                          />
                        )}
                        {artwork.file_type === "video" && (
                          <video
                            src={artwork.file_url}
                            controls
                            className="w-full h-40 rounded-lg"
                          />
                        )}
                        {artwork.file_type === "audio" && (
                          <audio
                            src={artwork.file_url}
                            controls
                            className="w-full"
                          />
                        )}
                        {artwork.title && (
                          <p className="text-sm font-medium">{artwork.title}</p>
                        )}
                        {artwork.description && (
                          <p className="text-sm text-muted-foreground">{artwork.description}</p>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Comments */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Comments</h3>
                
                {/* Add Comment */}
                {user && (
                  <div className="flex space-x-2 mb-6">
                    <Input
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Add a comment..."
                      onKeyPress={(e) => e.key === "Enter" && handleComment()}
                    />
                    <Button onClick={handleComment} disabled={!comment.trim()}>
                      Post
                    </Button>
                  </div>
                )}

                {/* Comments List */}
                <div className="space-y-4">
                  {data.comments.map((comment) => (
                    <div key={comment.id} className="flex space-x-3">
                      {comment.profiles?.avatar_url && (
                        <img
                          src={comment.profiles.avatar_url}
                          alt="Avatar"
                          className="h-8 w-8 rounded-full"
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <p className="text-sm font-medium">
                            {comment.profiles?.username || comment.profiles?.name || "User"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(comment.created_at).toLocaleString()}
                          </p>
                        </div>
                        <p className="text-sm">{comment.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* AI Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">AI Inspiration</h3>
                <Button onClick={fetchAIIdeas} disabled={!user} className="w-full mb-4">
                  Get Creative Ideas
                </Button>

                {aiIdeas && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Post Ideas</h4>
                      <ul className="text-sm space-y-1">
                        {aiIdeas.postIdeas?.map((idea: string, i: number) => (
                          <li key={i} className="text-muted-foreground">• {idea}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Art Prompts</h4>
                      <ul className="text-sm space-y-1">
                        {aiIdeas.artPrompts?.map((prompt: string, i: number) => (
                          <li key={i} className="text-muted-foreground">• {prompt}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Captions</h4>
                      <ul className="text-sm space-y-1">
                        {aiIdeas.captions?.map((caption: string, i: number) => (
                          <li key={i} className="text-muted-foreground">• {caption}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}