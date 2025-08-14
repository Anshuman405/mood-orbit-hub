import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { songTitle, artist, mood, recentLikes, userId } = await req.json();
    
    if (!songTitle || !artist) {
      return new Response("Missing songTitle or artist", { status: 400 });
    }

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      return new Response("Gemini API key not configured", { status: 500 });
    }

    // Build context from user's recent likes
    const likesContext = recentLikes?.length > 0 
      ? `\nUser's recent likes: ${recentLikes.map((like: any) => `"${like.title}" by ${like.artist}`).join(", ")}`
      : "";

    const moodContext = mood ? `\nCurrent mood: ${mood}` : "";

    const prompt = `You are an AI creative assistant for Looply, a viral music community where artists create visual art, remixes, and covers inspired by users' favorite songs.

Song: "${songTitle}" by ${artist}${moodContext}${likesContext}

Generate creative inspiration for artists responding to this song. Provide exactly:

1. **3 Post Ideas** - Creative concepts for visual art, remix styles, or covers
2. **3 Art Prompts** - Detailed prompts for generating visual artwork 
3. **3 Catchy Captions** - Engaging social media captions

Format as JSON:
{
  "postIdeas": [
    "Idea 1 description",
    "Idea 2 description", 
    "Idea 3 description"
  ],
  "artPrompts": [
    "Detailed art prompt 1",
    "Detailed art prompt 2",
    "Detailed art prompt 3"
  ],
  "captions": [
    "Catchy caption 1",
    "Catchy caption 2",
    "Catchy caption 3"
  ]
}

Keep responses creative, inspiring, and specific to the song's genre, mood, and lyrical themes. Focus on actionable ideas that artists can immediately use.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiApiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.9,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", errorText);
      return new Response("AI service error", { status: 500 });
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      return new Response("No content generated", { status: 500 });
    }

    // Try to parse JSON from the response
    let ideas;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = generatedText.match(/```json\n(.*?)\n```/s) || generatedText.match(/```\n(.*?)\n```/s);
      const jsonString = jsonMatch ? jsonMatch[1] : generatedText;
      ideas = JSON.parse(jsonString);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      // Fallback: create structured response from text
      ideas = {
        postIdeas: [
          `Create a visual interpretation of "${songTitle}"`,
          `Remix this track with your own style`,
          `Cover this song with a unique twist`
        ],
        artPrompts: [
          `Digital art inspired by the mood of "${songTitle}" by ${artist}`,
          `Abstract visualization of the emotions in this song`,
          `Album cover redesign for "${songTitle}"`
        ],
        captions: [
          `Vibing to "${songTitle}" 🎵 What's your take?`,
          `This song hits different... ${artist} inspiration`,
          `Turning "${songTitle}" into visual magic ✨`
        ]
      };
    }

    return new Response(JSON.stringify(ideas), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("AI ideas error:", error);
    return new Response("Internal server error", { status: 500, headers: corsHeaders });
  }
});