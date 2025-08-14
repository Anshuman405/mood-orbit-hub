-- Complete Looply database schema with all tables and RLS policies

-- Create storage buckets for artworks
INSERT INTO storage.buckets (id, name, public) VALUES ('artworks', 'artworks', true);

-- Spotify connections table for OAuth tokens
CREATE TABLE IF NOT EXISTS spotify_connections (
  user_id text primary key,
  access_token text not null,
  refresh_token text not null,
  scope text,
  token_type text default 'Bearer',
  expires_at timestamptz not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Artworks table for user uploads  
CREATE TABLE IF NOT EXISTS artworks (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  post_id uuid references posts(id) on delete cascade,
  title text,
  description text,
  file_url text not null,
  file_type text not null, -- image, video, audio
  file_size integer,
  width integer,
  height integer,
  duration_seconds integer, -- for video/audio
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Challenges table for daily/weekly challenges
CREATE TABLE IF NOT EXISTS challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  song_id uuid references songs(id),
  challenge_type text default 'daily', -- daily, weekly, special
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null default (now() + interval '1 day'),
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Challenge participations
CREATE TABLE IF NOT EXISTS challenge_participations (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid references challenges(id) on delete cascade,
  user_id text not null,
  post_id uuid references posts(id) on delete cascade,
  created_at timestamptz default now(),
  unique(challenge_id, user_id)
);

-- User followers/following
CREATE TABLE IF NOT EXISTS followers (
  id uuid primary key default gen_random_uuid(),
  follower_id text not null,
  following_id text not null,
  created_at timestamptz default now(),
  unique(follower_id, following_id)
);

-- Add missing columns to existing tables
ALTER TABLE posts ADD COLUMN IF NOT EXISTS challenge_id uuid references challenges(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS follower_count integer default 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS following_count integer default 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS post_count integer default 0;

-- Enable RLS on all tables
ALTER TABLE spotify_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE artworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_participations ENABLE ROW LEVEL SECURITY;
ALTER TABLE followers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for spotify_connections
CREATE POLICY "Users can manage own Spotify connection" 
ON spotify_connections FOR ALL 
USING (current_setting('app.current_user_id', true) = user_id)
WITH CHECK (current_setting('app.current_user_id', true) = user_id);

-- RLS Policies for artworks
CREATE POLICY "Anyone can view artworks" 
ON artworks FOR SELECT 
USING (true);

CREATE POLICY "Users can create own artworks" 
ON artworks FOR INSERT 
WITH CHECK (current_setting('app.current_user_id', true) = user_id);

CREATE POLICY "Users can update own artworks" 
ON artworks FOR UPDATE 
USING (current_setting('app.current_user_id', true) = user_id);

CREATE POLICY "Users can delete own artworks" 
ON artworks FOR DELETE 
USING (current_setting('app.current_user_id', true) = user_id);

-- RLS Policies for challenges
CREATE POLICY "Anyone can view active challenges" 
ON challenges FOR SELECT 
USING (true);

-- RLS Policies for challenge_participations  
CREATE POLICY "Anyone can view challenge participations" 
ON challenge_participations FOR SELECT 
USING (true);

CREATE POLICY "Users can create own participations" 
ON challenge_participations FOR INSERT 
WITH CHECK (current_setting('app.current_user_id', true) = user_id);

-- RLS Policies for followers
CREATE POLICY "Anyone can view followers" 
ON followers FOR SELECT 
USING (true);

CREATE POLICY "Users can follow others" 
ON followers FOR INSERT 
WITH CHECK (current_setting('app.current_user_id', true) = follower_id);

CREATE POLICY "Users can unfollow" 
ON followers FOR DELETE 
USING (current_setting('app.current_user_id', true) = follower_id);

-- Storage policies for artworks bucket
CREATE POLICY "Anyone can view artworks" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'artworks');

CREATE POLICY "Users can upload artworks" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'artworks' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own artworks" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'artworks' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own artworks" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'artworks' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Database functions for common operations
CREATE OR REPLACE FUNCTION toggle_follow(_follower_id text, _following_id text)
RETURNS TABLE(action text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_follow_id uuid;
BEGIN
  PERFORM set_config('app.current_user_id', _follower_id, true);

  SELECT id INTO v_follow_id FROM followers
  WHERE follower_id = _follower_id AND following_id = _following_id;

  IF v_follow_id IS NULL THEN
    INSERT INTO followers (follower_id, following_id) VALUES (_follower_id, _following_id);
    -- Update counts
    UPDATE profiles SET following_count = following_count + 1 WHERE user_id = _follower_id;
    UPDATE profiles SET follower_count = follower_count + 1 WHERE user_id = _following_id;
    RETURN QUERY SELECT 'followed'::text;
  ELSE
    DELETE FROM followers WHERE id = v_follow_id;
    -- Update counts  
    UPDATE profiles SET following_count = GREATEST(following_count - 1, 0) WHERE user_id = _follower_id;
    UPDATE profiles SET follower_count = GREATEST(follower_count - 1, 0) WHERE user_id = _following_id;
    RETURN QUERY SELECT 'unfollowed'::text;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION join_challenge(_user_id text, _challenge_id uuid, _post_id uuid)
RETURNS challenge_participations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_participation challenge_participations;
BEGIN
  PERFORM set_config('app.current_user_id', _user_id, true);

  INSERT INTO challenge_participations (challenge_id, user_id, post_id)
  VALUES (_challenge_id, _user_id, _post_id)
  ON CONFLICT (challenge_id, user_id) DO UPDATE SET post_id = EXCLUDED.post_id
  RETURNING * INTO v_participation;

  -- Link post to challenge
  UPDATE posts SET challenge_id = _challenge_id WHERE id = _post_id;

  RETURN v_participation;
END;
$function$;

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER artworks_updated_at BEFORE UPDATE ON artworks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER spotify_connections_updated_at BEFORE UPDATE ON spotify_connections FOR EACH ROW EXECUTE FUNCTION update_updated_at();