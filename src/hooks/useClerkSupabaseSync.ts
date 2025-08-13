import { useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import { supabase } from "@/integrations/supabase/client";

/** Syncs Clerk user -> Supabase profiles using the ensure_profile RPC */
export const useClerkSupabaseSync = () => {
  const { isSignedIn, user } = useUser();

  useEffect(() => {
    if (!isSignedIn || !user) return;

    const email = user.primaryEmailAddress?.emailAddress || "";
    const name = user.fullName || "";
    const avatar = user.imageUrl || "";
    const username = (user.username || email.split("@")[0] || "").slice(0, 30);

    // Fire and forget; errors are fine to log
    supabase
      .rpc("ensure_profile", {
        _user_id: user.id,
        _email: email,
        _name: name,
        _avatar_url: avatar,
        _username: username,
        _favorite_song_id: null,
      })
      .then(({ error }) => {
        if (error) console.warn("ensure_profile error:", error.message);
      });
  }, [isSignedIn, user]);
};
