import { useState, useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import { checkSpotifyConnection } from "@/lib/spotify";

export function useSpotifyConnection() {
  const { user } = useUser();
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkConnection() {
      if (!user?.id) {
        setIsConnected(false);
        setLoading(false);
        return;
      }

      try {
        const connected = await checkSpotifyConnection(user.id);
        setIsConnected(connected);
      } catch (error) {
        console.error("Error checking Spotify connection:", error);
        setIsConnected(false);
      } finally {
        setLoading(false);
      }
    }

    checkConnection();
  }, [user?.id]);

  return { isConnected, loading };
}