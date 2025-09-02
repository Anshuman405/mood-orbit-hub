import React, { useEffect } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/clerk-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Clock, Users, Music, Zap, Star, Target } from "lucide-react";
import { useClerkSupabaseSync } from "@/hooks/useClerkSupabaseSync";
import { Link } from "react-router-dom";

interface Challenge {
  id: string;
  title: string;
  description: string;
  challenge_type: string;
  is_active: boolean;
  starts_at: string;
  ends_at: string;
  song_id?: string;
  songs?: {
    title: string;
    artist: string;
    artwork_url?: string;
  };
}

const fetchChallenges = async () => {
  const { data, error } = await supabase
    .from("challenges")
    .select(`
      id,
      title,
      description,
      challenge_type,
      is_active,
      starts_at,
      ends_at,
      song_id,
      songs (
        title,
        artist,
        artwork_url
      )
    `)
    .eq("is_active", true)
    .order("created_at", { ascending: false });
    
  if (error) throw error;
  return data as Challenge[];
};

const challengeIcons = {
  daily: Clock,
  weekly: Trophy,
  remix: Music,
  viral: Zap,
  community: Users
};

const challengeGradients = {
  daily: "from-[hsl(var(--viral-orange))] to-[hsl(var(--viral-yellow))]",
  weekly: "from-[hsl(var(--viral-purple))] to-[hsl(var(--viral-pink))]",
  remix: "from-[hsl(var(--spotify-green))] to-[hsl(var(--viral-blue))]",
  viral: "from-[hsl(var(--viral-pink))] to-[hsl(var(--viral-purple))]",
  community: "from-[hsl(var(--viral-blue))] to-[hsl(var(--spotify-green))]"
};

export default function Challenges() {
  useClerkSupabaseSync();
  const { user } = useUser();

  useEffect(() => {
    document.title = "Challenges | Looply";
    const desc = "Join viral music challenges and show off your creativity on Looply!";
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = desc;
  }, []);

  const { data: challenges, isLoading } = useQuery({
    queryKey: ["challenges"],
    queryFn: fetchChallenges,
  });

  const getTimeRemaining = (endTime: string) => {
    const end = new Date(endTime);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    
    if (diff <= 0) return "Ended";
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h left`;
    return `${hours}h left`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Trophy className="h-12 w-12 text-[hsl(var(--viral-purple))]" />
        </motion.div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background pb-20 md:pb-0">
      <div className="container mx-auto max-w-6xl px-4 py-6">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="relative">
            <motion.div
              className="absolute -top-4 -right-4 text-6xl"
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              🏆
            </motion.div>
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-[hsl(var(--viral-purple))] to-[hsl(var(--viral-pink))] bg-clip-text text-transparent mb-4">
              Music Challenges
            </h1>
          </div>
          <p className="text-xl text-muted-foreground mb-6 max-w-2xl mx-auto">
            Join viral music challenges, show off your creativity, and compete with the community!
          </p>
          
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button asChild className="btn-viral text-lg px-8 py-3">
              <Link to="/upload">
                <Target className="mr-2 h-5 w-5" />
                Start Creating
              </Link>
            </Button>
          </motion.div>
        </motion.div>

        {/* Active Challenges */}
        {challenges && challenges.length > 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            {challenges.map((challenge, index) => {
              const Icon = challengeIcons[challenge.challenge_type as keyof typeof challengeIcons] || Trophy;
              const gradient = challengeGradients[challenge.challenge_type as keyof typeof challengeGradients] || challengeGradients.daily;
              
              return (
                <motion.div
                  key={challenge.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ y: -5 }}
                  className="group"
                >
                  <Card className="h-full overflow-hidden bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 border-2 border-transparent group-hover:border-[hsl(var(--viral-purple))] transition-all duration-300 shadow-lg group-hover:shadow-xl">
                    <CardContent className="p-0">
                      {/* Header with gradient */}
                      <div className={`bg-gradient-to-r ${gradient} p-6 text-white relative overflow-hidden`}>
                        <div className="absolute top-2 right-2 opacity-20">
                          <Icon className="h-12 w-12" />
                        </div>
                        
                        <div className="relative z-10">
                          <div className="flex items-center gap-2 mb-2">
                            <Icon className="h-6 w-6" />
                            <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                              {challenge.challenge_type}
                            </Badge>
                          </div>
                          
                          <h3 className="text-xl font-bold mb-2">{challenge.title}</h3>
                          
                          <div className="flex items-center gap-2 text-sm opacity-90">
                            <Clock className="h-4 w-4" />
                            {getTimeRemaining(challenge.ends_at)}
                          </div>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-6">
                        <p className="text-muted-foreground mb-4 line-clamp-3">
                          {challenge.description}
                        </p>

                        {/* Featured Song */}
                        {challenge.songs && (
                          <div className="bg-gradient-to-r from-[hsl(var(--spotify-green))]/10 to-[hsl(var(--viral-blue))]/10 rounded-2xl p-4 mb-4">
                            <div className="flex items-center gap-3">
                              {challenge.songs.artwork_url && (
                                <img 
                                  src={challenge.songs.artwork_url} 
                                  alt="Song artwork"
                                  className="h-12 w-12 rounded-lg"
                                />
                              )}
                              <div>
                                <p className="font-medium">{challenge.songs.title}</p>
                                <p className="text-sm text-muted-foreground">{challenge.songs.artist}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                          <Button 
                            asChild 
                            className="w-full btn-viral"
                          >
                            <Link to={`/upload?challenge=${challenge.id}`}>
                              <Star className="mr-2 h-4 w-4" />
                              Join Challenge
                            </Link>
                          </Button>
                        </motion.div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16"
          >
            <div className="relative mb-6">
              <Trophy className="h-24 w-24 mx-auto text-muted-foreground/50" />
              <motion.div
                className="absolute -top-2 -right-2 text-4xl"
                animate={{ 
                  y: [0, -10, 0],
                  rotate: [0, 10, -10, 0] 
                }}
                transition={{ 
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                ✨
              </motion.div>
            </div>
            
            <h2 className="text-2xl font-bold text-muted-foreground mb-4">
              No Active Challenges
            </h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              New challenges are coming soon! In the meantime, start creating and sharing your music content.
            </p>
            
            <Button asChild className="btn-viral">
              <Link to="/upload">
                <Music className="mr-2 h-5 w-5" />
                Create Something Amazing
              </Link>
            </Button>
          </motion.div>
        )}
      </div>
    </main>
  );
}