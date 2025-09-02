import React, { useState } from "react";
import { motion } from "framer-motion";
import { UserPlus, UserMinus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser } from "@clerk/clerk-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface FollowButtonProps {
  targetUserId: string;
  isFollowing: boolean;
  onFollowChange?: (isFollowing: boolean) => void;
  variant?: "default" | "compact";
}

export const FollowButton: React.FC<FollowButtonProps> = ({
  targetUserId,
  isFollowing: initialFollowing,
  onFollowChange,
  variant = "default"
}) => {
  const { user } = useUser();
  const { toast } = useToast();
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [isLoading, setIsLoading] = useState(false);

  const handleToggleFollow = async () => {
    if (!user) return;
    
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.rpc('toggle_follow', {
        _follower_id: user.id,
        _following_id: targetUserId
      });

      if (error) throw error;

      const newFollowingState = data?.[0]?.action === 'followed';
      setIsFollowing(newFollowingState);
      onFollowChange?.(newFollowingState);
      
      toast({
        title: newFollowingState ? "Following!" : "Unfollowed",
        description: newFollowingState 
          ? "You're now following this user" 
          : "You've unfollowed this user"
      });
    } catch (error) {
      console.error('Error toggling follow:', error);
      toast({
        title: "Error",
        description: "Failed to update follow status",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (variant === "compact") {
    return (
      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Button
          variant={isFollowing ? "outline" : "default"}
          size="sm"
          onClick={handleToggleFollow}
          disabled={isLoading}
          className={
            isFollowing 
              ? "border-[hsl(var(--viral-purple))] text-[hsl(var(--viral-purple))] hover:bg-[hsl(var(--viral-purple))] hover:text-white"
              : "btn-viral"
          }
        >
          {isLoading ? (
            <Users className="h-4 w-4 animate-spin" />
          ) : isFollowing ? (
            <>
              <UserMinus className="h-4 w-4 mr-2" />
              Following
            </>
          ) : (
            <>
              <UserPlus className="h-4 w-4 mr-2" />
              Follow
            </>
          )}
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="w-full"
    >
      <Button
        variant={isFollowing ? "outline" : "default"}
        size="lg"
        onClick={handleToggleFollow}
        disabled={isLoading}
        className={`w-full ${
          isFollowing 
            ? "border-[hsl(var(--viral-purple))] text-[hsl(var(--viral-purple))] hover:bg-[hsl(var(--viral-purple))] hover:text-white"
            : "btn-viral"
        }`}
      >
        <motion.div
          initial={false}
          animate={isFollowing ? { rotate: 180 } : { rotate: 0 }}
          transition={{ duration: 0.3 }}
          className="mr-3"
        >
          {isLoading ? (
            <Users className="h-5 w-5 animate-spin" />
          ) : isFollowing ? (
            <UserMinus className="h-5 w-5" />
          ) : (
            <UserPlus className="h-5 w-5" />
          )}
        </motion.div>
        
        <span className="font-semibold">
          {isLoading ? "Loading..." : isFollowing ? "Following" : "Follow"}
        </span>
      </Button>
    </motion.div>
  );
};