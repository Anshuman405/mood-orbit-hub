import { supabase } from "@/integrations/supabase/client";

export interface AIIdeas {
  postIdeas: string[];
  artPrompts: string[];
  captions: string[];
}

export async function generateAIIdeas(params: {
  songTitle: string;
  artist: string;
  mood?: string;
  recentLikes?: Array<{ title: string; artist: string }>;
  userId?: string;
}): Promise<AIIdeas | null> {
  try {
    const { data, error } = await supabase.functions.invoke("ai-ideas", {
      body: params
    });

    if (error) throw error;
    return data as AIIdeas;
  } catch (error) {
    console.error("Error generating AI ideas:", error);
    return null;
  }
}