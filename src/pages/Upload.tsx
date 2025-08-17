import React, { useState, useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileUpload } from "@/components/ui/file-upload";
import { useClerkSupabaseSync } from "@/hooks/useClerkSupabaseSync";
import { uploadArtwork, getFileType, getImageDimensions, getVideoDuration, getAudioDuration } from "@/lib/storage";
import { Upload, Music, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { name: string; images?: { url: string }[] };
}

export default function UploadPage() {
  useClerkSupabaseSync();
  const { user } = useUser();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const remixPostId = searchParams.get("remix");

  const [songQuery, setSongQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([]);
  const [selectedSong, setSelectedSong] = useState<SpotifyTrack | null>(null);
  const [caption, setCaption] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [artworkTitle, setArtworkTitle] = useState("");
  const [artworkDescription, setArtworkDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  // Spotify personalized data
  const [likedTracks, setLikedTracks] = useState<SpotifyTrack[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [playlistTracks, setPlaylistTracks] = useState<SpotifyTrack[]>([]);
  const [topTracks, setTopTracks] = useState<SpotifyTrack[]>([]);
  const [activeSource, setActiveSource] = useState<'search'|'liked'|'playlists'|'top'>('search');
  const [songFilter, setSongFilter] = useState<string>("");
  const [artworkFilter, setArtworkFilter] = useState<string>("");

  useEffect(() => {
    document.title = "Upload | Looply";
    // Fetch personalized Spotify data (mocked for now)
    // Replace with real API calls to Spotify if available
    // Example: getUserTopTracks, getUserLikedTracks, getUserPlaylists
    // setLikedTracks([...]); setPlaylists([...]); setTopTracks([...]);
  }, []);

  const searchSpotify = async () => {
    if (!songQuery.trim()) return;
    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("spotify-search", {
        body: { q: songQuery }
      });
      
      if (error) throw error;
      setSearchResults(data?.tracks || []);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || !selectedSong) return;
    
    setUploading(true);
    
    try {
      // Create post first
      const { data: postData, error: postError } = await supabase.rpc("create_post", {
        _user_id: user.id,
        _song_provider: "spotify",
        _provider_song_id: selectedSong.id,
        _title: selectedSong.name,
        _artist: selectedSong.artists[0]?.name || "",
        _album: selectedSong.album?.name || null,
        _artwork_url: selectedSong.album?.images?.[0]?.url || null,
        _caption: caption || null,
        _visibility: "public"
      });

      if (postError) throw postError;

      // Upload artwork if provided
      if (selectedFile && postData) {
        const fileUrl = await uploadArtwork(selectedFile, user.id);
        if (fileUrl) {
          const fileType = getFileType(selectedFile);
          let width = 0, height = 0, duration = 0;

          if (fileType === "image") {
            const dimensions = await getImageDimensions(selectedFile);
            width = dimensions.width;
            height = dimensions.height;
          } else if (fileType === "video") {
            duration = await getVideoDuration(selectedFile);
          } else if (fileType === "audio") {
            duration = await getAudioDuration(selectedFile);
          }

          await supabase.from("artworks").insert({
            user_id: user.id,
            post_id: postData.id,
            title: artworkTitle || null,
            description: artworkDescription || null,
            file_url: fileUrl,
            file_type: fileType,
            file_size: selectedFile.size,
            width,
            height,
            duration_seconds: duration
          });
        }
      }

      navigate("/feed");
    } catch (error) {
      console.error("Upload error:", error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <div className="container mx-auto max-w-6xl px-4 py-6">
        <div className="flex items-center space-x-3 mb-6">
          <Upload className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">
            {remixPostId ? "Create Remix" : "Upload Your Creation"}
          </h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* LEFT: Song selection & Spotify personalized */}
          <div>
            <Card>
              <CardContent className="p-6">
                <div className="mb-4">
                  <div className="mb-2">
                    {/* Dropdown filter for song source */}
                    <Select value={activeSource} onValueChange={v=>setActiveSource(v as any)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choose source" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="search">Search</SelectItem>
                        <SelectItem value="liked">Liked Songs</SelectItem>
                        <SelectItem value="playlists">Playlists</SelectItem>
                        <SelectItem value="top">Top Tracks</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {activeSource==='search' && (
                  <div>
                    <div className="flex space-x-2 mb-4">
                      <Input
                        value={songQuery}
                        onChange={(e) => setSongQuery(e.target.value)}
                        placeholder="Search for a song or artist..."
                        onKeyPress={(e) => e.key === "Enter" && searchSpotify()}
                      />
                      <Button onClick={searchSpotify} disabled={loading}>{loading ? "..." : "Search"}</Button>
                    </div>
                    <div className="space-y-3">
                      {searchResults.filter(track=>track.name.toLowerCase().includes(songFilter.toLowerCase())).map((track) => (
                        <Card
                          key={track.id}
                          className={`cursor-pointer transition-colors ${selectedSong?.id === track.id ? "ring-2 ring-primary" : ""}`}
                          onClick={() => setSelectedSong(track)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center space-x-3">
                              {track.album?.images?.[2] && (
                                <img src={track.album.images[2].url} alt="Album" className="h-12 w-12 rounded" />
                              )}
                              <div className="flex-1">
                                <p className="font-medium">{track.name}</p>
                                <p className="text-sm text-muted-foreground">{track.artists[0]?.name} • {track.album?.name}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
                {activeSource==='liked' && (
                  <div className="space-y-3">
                    {likedTracks.filter(track=>track.name.toLowerCase().includes(songFilter.toLowerCase())).map((track) => (
                      <Card key={track.id} className={`cursor-pointer transition-colors ${selectedSong?.id === track.id ? "ring-2 ring-primary" : ""}`} onClick={()=>setSelectedSong(track)}>
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-3">
                            {track.album?.images?.[2] && (<img src={track.album.images[2].url} alt="Album" className="h-12 w-12 rounded" />)}
                            <div className="flex-1">
                              <p className="font-medium">{track.name}</p>
                              <p className="text-sm text-muted-foreground">{track.artists[0]?.name} • {track.album?.name}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
                {activeSource==='playlists' && (
                  <div>
                    <div className="mb-2">Select a playlist:</div>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {playlists.map(pl=>(<Button key={pl.id} size="sm" variant="outline" onClick={()=>setPlaylistTracks(pl.tracks)}>{pl.name}</Button>))}
                    </div>
                    <div className="space-y-3">
                      {playlistTracks.filter(track=>track.name.toLowerCase().includes(songFilter.toLowerCase())).map((track) => (
                        <Card key={track.id} className={`cursor-pointer transition-colors ${selectedSong?.id === track.id ? "ring-2 ring-primary" : ""}`} onClick={()=>setSelectedSong(track)}>
                          <CardContent className="p-4">
                            <div className="flex items-center space-x-3">
                              {track.album?.images?.[2] && (<img src={track.album.images[2].url} alt="Album" className="h-12 w-12 rounded" />)}
                              <div className="flex-1">
                                <p className="font-medium">{track.name}</p>
                                <p className="text-sm text-muted-foreground">{track.artists[0]?.name} • {track.album?.name}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
                {activeSource==='top' && (
                  <div className="space-y-3">
                    {topTracks.filter(track=>track.name.toLowerCase().includes(songFilter.toLowerCase())).map((track) => (
                      <Card key={track.id} className={`cursor-pointer transition-colors ${selectedSong?.id === track.id ? "ring-2 ring-primary" : ""}`} onClick={()=>setSelectedSong(track)}>
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-3">
                            {track.album?.images?.[2] && (<img src={track.album.images[2].url} alt="Album" className="h-12 w-12 rounded" />)}
                            <div className="flex-1">
                              <p className="font-medium">{track.name}</p>
                              <p className="text-sm text-muted-foreground">{track.artists[0]?.name} • {track.album?.name}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          {/* RIGHT: Artwork upload, comments, filters */}
          <div>
            <Card>
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-4">Add Your Creation</h2>
                <Input value={artworkFilter} onChange={e=>setArtworkFilter(e.target.value)} placeholder="Filter artwork by style, color, type..." className="mb-2" />
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Caption</label>
                    <Textarea value={caption} onChange={e=>setCaption(e.target.value)} placeholder="Share your inspiration..." rows={3} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Upload Artwork (Optional)</label>
                    <FileUpload onFileSelect={setSelectedFile} onFileRemove={()=>setSelectedFile(null)} selectedFile={selectedFile || undefined} disabled={uploading} />
                  </div>
                  {selectedFile && (
                    <>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Artwork Title</label>
                        <Input value={artworkTitle} onChange={e=>setArtworkTitle(e.target.value)} placeholder="Give your creation a title..." />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Description</label>
                        <Textarea value={artworkDescription} onChange={e=>setArtworkDescription(e.target.value)} placeholder="Describe your creative process..." rows={2} />
                      </div>
                    </>
                  )}
                  <div className="flex space-x-3">
                    <Button variant="outline" onClick={()=>setSelectedSong(null)}>Back</Button>
                    <Button onClick={handleSubmit} disabled={uploading || !selectedSong} className="flex-1">{uploading ? "Publishing..." : "Publish"}</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}