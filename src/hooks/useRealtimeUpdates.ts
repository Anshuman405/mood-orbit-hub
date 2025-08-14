import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export function useRealtimeUpdates() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("looply-updates")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, () => {
        queryClient.invalidateQueries({ queryKey: ["feed"] });
        queryClient.invalidateQueries({ queryKey: ["trending"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "post_likes" }, () => {
        queryClient.invalidateQueries({ queryKey: ["feed"] });
        queryClient.invalidateQueries({ queryKey: ["post"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "post_comments" }, () => {
        queryClient.invalidateQueries({ queryKey: ["post"] });
        queryClient.invalidateQueries({ queryKey: ["comments"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "artworks" }, () => {
        queryClient.invalidateQueries({ queryKey: ["post"] });
        queryClient.invalidateQueries({ queryKey: ["artworks"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}