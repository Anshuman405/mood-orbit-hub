import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Heart, Music, Users } from "lucide-react";

interface SpotifyData {
  topArtists?: { items?: Array<{ name: string; id: string }> };
  topTracks?: { items?: Array<{ artists: Array<{ name: string }> }> };
}

interface MusicCompatibilityProps {
  userSpotifyData?: SpotifyData;
  otherUserSpotifyData?: SpotifyData;
  otherUsername?: string;
}

export const MusicCompatibility: React.FC<MusicCompatibilityProps> = ({
  userSpotifyData,
  otherUserSpotifyData,
  otherUsername
}) => {
  const compatibility = useMemo(() => {
    if (!userSpotifyData || !otherUserSpotifyData) {
      return { score: 0, sharedArtists: [], reason: "Connect Spotify accounts to see compatibility!" };
    }

    const userArtists = new Set(
      userSpotifyData.topArtists?.items?.map(artist => artist.name.toLowerCase()) || []
    );
    
    const userTrackArtists = new Set(
      userSpotifyData.topTracks?.items?.flatMap(track => 
        track.artists.map(artist => artist.name.toLowerCase())
      ) || []
    );

    // Combine both top artists and track artists for more comprehensive matching
    const allUserArtists = new Set([...userArtists, ...userTrackArtists]);

    const otherArtists = new Set(
      otherUserSpotifyData.topArtists?.items?.map(artist => artist.name.toLowerCase()) || []
    );
    
    const otherTrackArtists = new Set(
      otherUserSpotifyData.topTracks?.items?.flatMap(track => 
        track.artists.map(artist => artist.name.toLowerCase())
      ) || []
    );

    const allOtherArtists = new Set([...otherArtists, ...otherTrackArtists]);

    // Find shared artists
    const sharedArtists = Array.from(allUserArtists).filter(artist => 
      allOtherArtists.has(artist)
    );

    // Calculate compatibility score
    const totalUniqueArtists = new Set([...allUserArtists, ...allOtherArtists]).size;
    const score = totalUniqueArtists > 0 ? Math.round((sharedArtists.length / Math.min(allUserArtists.size, allOtherArtists.size)) * 100) : 0;

    let reason = "";
    if (score >= 80) {
      reason = "You're music soulmates! 🎵✨";
    } else if (score >= 60) {
      reason = "Great musical connection! 🎶";
    } else if (score >= 40) {
      reason = "Some shared vibes! 🎤";
    } else if (score >= 20) {
      reason = "Different but interesting tastes 🎨";
    } else {
      reason = "Opposites in music! Time to discover new sounds 🌟";
    }

    return {
      score: Math.min(score, 99), // Cap at 99% for fun
      sharedArtists: sharedArtists.slice(0, 5), // Show top 5 shared artists
      reason
    };
  }, [userSpotifyData, otherUserSpotifyData]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "from-green-400 to-green-600";
    if (score >= 60) return "from-blue-400 to-blue-600";
    if (score >= 40) return "from-yellow-400 to-yellow-600";
    if (score >= 20) return "from-orange-400 to-orange-600";
    return "from-red-400 to-red-600";
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="bg-gradient-to-br from-[hsl(var(--viral-pink))] to-[hsl(var(--viral-purple))] rounded-3xl p-6 text-white"
    >
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Users className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Music Compatibility</h3>
        </div>
        <p className="text-sm opacity-90">
          with {otherUsername || "this user"}
        </p>
      </div>

      <div className="flex items-center justify-center mb-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 150 }}
          className={`relative w-32 h-32 rounded-full bg-gradient-to-r ${getScoreColor(compatibility.score)} flex items-center justify-center shadow-2xl`}
        >
          <div className="text-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-3xl font-bold"
            >
              {compatibility.score}%
            </motion.div>
            <Heart className="h-6 w-6 mx-auto animate-pulse" />
          </div>
          
          {/* Animated ring */}
          <motion.div
            className="absolute inset-0 rounded-full border-4 border-white/30"
            initial={{ rotate: 0 }}
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          />
        </motion.div>
      </div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="text-center mb-4"
      >
        <p className="font-medium text-lg mb-2">{compatibility.reason}</p>
        
        {compatibility.sharedArtists.length > 0 && (
          <div className="bg-white/20 rounded-2xl p-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Music className="h-4 w-4" />
              <span className="text-sm font-medium">Shared Artists</span>
            </div>
            <div className="text-sm space-y-1">
              {compatibility.sharedArtists.map((artist, index) => (
                <motion.div
                  key={artist}
                  initial={{ x: -10, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 1 + index * 0.1 }}
                  className="capitalize"
                >
                  {artist}
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};