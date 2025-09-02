import React from "react";
import { motion } from "framer-motion";
import { Music, Sparkles, Share2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface MusicPersonaData {
  topArtist?: string;
  topGenre?: string;
  favoriteSong?: string;
  username?: string;
  playlistCount?: number;
  totalMinutes?: number;
}

interface MusicPersonaCardProps {
  data: MusicPersonaData;
  userId: string;
  isOwn?: boolean;
}

const getPersonaTagline = (genre?: string): string => {
  const taglines = {
    'pop': 'Pop Princess 💫',
    'rock': 'Rock Royalty 🎸',
    'hip-hop': 'Hip-Hop Hero 🎤',
    'rap': 'Rap Ruler 👑',
    'indie': 'Indie Explorer 🌟',
    'electronic': 'Beat Master 🎛️',
    'jazz': 'Jazz Virtuoso 🎺',
    'classical': 'Symphony Soul 🎼',
    'country': 'Country Cruiser 🤠',
    'r&b': 'R&B Royalty 👸',
    'alternative': 'Alt Adventurer 🚀',
    'folk': 'Folk Philosopher 🍃'
  };
  
  const normalizedGenre = genre?.toLowerCase() || '';
  for (const [key, tagline] of Object.entries(taglines)) {
    if (normalizedGenre.includes(key)) {
      return tagline;
    }
  }
  return 'Music Lover 🎵';
};

const getGradientForGenre = (genre?: string): string => {
  const gradients = {
    'pop': 'from-[hsl(var(--viral-pink))] to-[hsl(var(--viral-purple))]',
    'rock': 'from-red-500 to-orange-600',
    'hip-hop': 'from-yellow-400 to-red-500',
    'rap': 'from-purple-600 to-pink-500',
    'indie': 'from-green-400 to-blue-500',
    'electronic': 'from-cyan-400 to-purple-500',
    'jazz': 'from-yellow-600 to-red-600',
    'classical': 'from-blue-600 to-purple-700',
    'country': 'from-orange-400 to-yellow-500',
    'r&b': 'from-pink-500 to-purple-600',
    'alternative': 'from-gray-600 to-blue-600',
    'folk': 'from-green-500 to-yellow-500'
  };
  
  const normalizedGenre = genre?.toLowerCase() || '';
  for (const [key, gradient] of Object.entries(gradients)) {
    if (normalizedGenre.includes(key)) {
      return gradient;
    }
  }
  return 'from-[hsl(var(--viral-purple))] to-[hsl(var(--viral-pink))]';
};

export const MusicPersonaCard: React.FC<MusicPersonaCardProps> = ({ 
  data, 
  userId,
  isOwn = false 
}) => {
  const { toast } = useToast();
  const gradient = getGradientForGenre(data.topGenre);
  const tagline = getPersonaTagline(data.topGenre);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${data.username}'s Music Persona`,
          text: `Check out my Looply music profile! I'm a ${tagline}`,
          url: window.location.href
        });
      } catch (error) {
        console.error('Error sharing:', error);
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({
      title: "Link Copied!",
      description: "Profile link copied to clipboard"
    });
  };

  const handleDownload = () => {
    // Create canvas for image generation
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 800;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    // Create gradient background
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#a855f7'); // purple
    gradient.addColorStop(1, '#ec4899'); // pink
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add text
    ctx.fillStyle = 'white';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(data.username || 'User', canvas.width / 2, 100);
    
    ctx.font = '32px Arial';
    ctx.fillText(tagline, canvas.width / 2, 160);
    
    ctx.font = '24px Arial';
    ctx.fillText(`Top Artist: ${data.topArtist || 'Unknown'}`, canvas.width / 2, 220);
    ctx.fillText(`Favorite Genre: ${data.topGenre || 'Various'}`, canvas.width / 2, 260);
    
    // Convert to image and download
    const link = document.createElement('a');
    link.download = `${data.username}-looply-persona.png`;
    link.href = canvas.toDataURL();
    link.click();
    
    toast({
      title: "Downloaded!",
      description: "Your persona card has been saved"
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`relative overflow-hidden rounded-3xl p-8 text-white bg-gradient-to-br ${gradient} shadow-2xl`}
    >
      {/* Decorative elements */}
      <div className="absolute top-4 right-4 opacity-20">
        <Sparkles className="h-8 w-8" />
      </div>
      
      <div className="absolute bottom-4 left-4 opacity-10">
        <Music className="h-16 w-16" />
      </div>

      {/* Main Content */}
      <div className="relative z-10">
        <div className="text-center mb-6">
          <motion.h2 
            className="text-3xl font-bold mb-2"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
          >
            {data.username}
          </motion.h2>
          <motion.p 
            className="text-xl opacity-90"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.9 }}
            transition={{ delay: 0.4 }}
          >
            {tagline}
          </motion.p>
        </div>

        <div className="space-y-4 mb-6">
          <motion.div 
            className="bg-white/20 rounded-2xl p-4"
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <p className="text-sm opacity-80">Top Artist</p>
            <p className="font-semibold text-lg">{data.topArtist || 'Connect Spotify to see'}</p>
          </motion.div>

          <motion.div 
            className="bg-white/20 rounded-2xl p-4"
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            <p className="text-sm opacity-80">Favorite Genre</p>
            <p className="font-semibold text-lg">{data.topGenre || 'Various'}</p>
          </motion.div>

          {data.favoriteSong && (
            <motion.div 
              className="bg-white/20 rounded-2xl p-4"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1.0 }}
            >
              <p className="text-sm opacity-80">Current Obsession</p>
              <p className="font-semibold text-lg">{data.favoriteSong}</p>
            </motion.div>
          )}
        </div>

        {/* Stats Row */}
        {(data.playlistCount || data.totalMinutes) && (
          <motion.div 
            className="flex justify-around bg-white/10 rounded-2xl p-4 mb-6"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 1.2 }}
          >
            {data.playlistCount && (
              <div className="text-center">
                <p className="text-2xl font-bold">{data.playlistCount}</p>
                <p className="text-sm opacity-80">Playlists</p>
              </div>
            )}
            {data.totalMinutes && (
              <div className="text-center">
                <p className="text-2xl font-bold">{Math.round(data.totalMinutes / 60)}h</p>
                <p className="text-sm opacity-80">This Month</p>
              </div>
            )}
          </motion.div>
        )}

        {/* Action Buttons */}
        <motion.div 
          className="flex gap-3 justify-center"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1.4 }}
        >
          <Button
            variant="secondary"
            size="sm"
            onClick={handleShare}
            className="bg-white/20 hover:bg-white/30 text-white border-white/30"
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
          
          {isOwn && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownload}
              className="bg-white/20 hover:bg-white/30 text-white border-white/30"
            >
              <Download className="h-4 w-4 mr-2" />
              Save
            </Button>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
};