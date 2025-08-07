-- Create enum for mood types
CREATE TYPE public.mood_type AS ENUM (
  'serene', 'energized', 'focused', 'anxious', 'melancholy', 
  'excited', 'peaceful', 'stressed', 'creative', 'grateful'
);

-- Create enum for app roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE, -- Clerk user ID
  email TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE (user_id, role)
);

-- Create groups table
CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  owner_id TEXT REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  is_public BOOLEAN DEFAULT false,
  max_members INTEGER DEFAULT 8,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create group_members table
CREATE TABLE public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (group_id, user_id)
);

-- Create moods table
CREATE TABLE public.moods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  mood_type mood_type NOT NULL,
  gradient_colors JSONB, -- Store gradient color scheme
  notes TEXT,
  emoji TEXT,
  voice_url TEXT,
  image_url TEXT,
  is_anonymous BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create mood_reactions table
CREATE TABLE public.mood_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mood_id UUID REFERENCES public.moods(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (mood_id, user_id)
);

-- Create vibe_streaks table
CREATE TABLE public.vibe_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_checkin_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id)
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mood_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vibe_streaks ENABLE ROW LEVEL SECURITY;

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.get_user_id_from_clerk(clerk_user_id TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT user_id FROM public.profiles WHERE user_id = clerk_user_id;
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (user_id = current_setting('app.current_user_id', true));
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id', true));

-- RLS Policies for groups
CREATE POLICY "Users can view public groups and groups they're members of" ON public.groups FOR SELECT USING (
  is_public = true OR 
  owner_id = current_setting('app.current_user_id', true) OR
  EXISTS (SELECT 1 FROM public.group_members WHERE group_id = id AND user_id = current_setting('app.current_user_id', true))
);
CREATE POLICY "Users can create groups" ON public.groups FOR INSERT WITH CHECK (owner_id = current_setting('app.current_user_id', true));
CREATE POLICY "Group owners can update their groups" ON public.groups FOR UPDATE USING (owner_id = current_setting('app.current_user_id', true));
CREATE POLICY "Group owners can delete their groups" ON public.groups FOR DELETE USING (owner_id = current_setting('app.current_user_id', true));

-- RLS Policies for group_members
CREATE POLICY "Users can view group members of groups they're in" ON public.group_members FOR SELECT USING (
  user_id = current_setting('app.current_user_id', true) OR
  EXISTS (SELECT 1 FROM public.group_members gm WHERE gm.group_id = group_id AND gm.user_id = current_setting('app.current_user_id', true))
);
CREATE POLICY "Users can join groups" ON public.group_members FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id', true));
CREATE POLICY "Users can leave groups" ON public.group_members FOR DELETE USING (user_id = current_setting('app.current_user_id', true));

-- RLS Policies for moods
CREATE POLICY "Users can view moods in groups they're members of" ON public.moods FOR SELECT USING (
  user_id = current_setting('app.current_user_id', true) OR
  (group_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.group_members WHERE group_id = moods.group_id AND user_id = current_setting('app.current_user_id', true)))
);
CREATE POLICY "Users can create their own moods" ON public.moods FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id', true));
CREATE POLICY "Users can update their own moods" ON public.moods FOR UPDATE USING (user_id = current_setting('app.current_user_id', true));
CREATE POLICY "Users can delete their own moods" ON public.moods FOR DELETE USING (user_id = current_setting('app.current_user_id', true));

-- RLS Policies for mood_reactions
CREATE POLICY "Users can view reactions on moods they can see" ON public.mood_reactions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.moods WHERE id = mood_id AND (
    user_id = current_setting('app.current_user_id', true) OR
    (group_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.group_members WHERE group_id = moods.group_id AND user_id = current_setting('app.current_user_id', true)))
  ))
);
CREATE POLICY "Users can create reactions" ON public.mood_reactions FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id', true));
CREATE POLICY "Users can delete their own reactions" ON public.mood_reactions FOR DELETE USING (user_id = current_setting('app.current_user_id', true));

-- RLS Policies for vibe_streaks
CREATE POLICY "Users can view their own streaks" ON public.vibe_streaks FOR SELECT USING (user_id = current_setting('app.current_user_id', true));
CREATE POLICY "Users can update their own streaks" ON public.vibe_streaks FOR UPDATE USING (user_id = current_setting('app.current_user_id', true));
CREATE POLICY "Users can insert their own streaks" ON public.vibe_streaks FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id', true));

-- Create storage buckets for mood images and voice recordings
INSERT INTO storage.buckets (id, name, public) VALUES ('mood-images', 'mood-images', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('voice-recordings', 'voice-recordings', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Storage policies for mood images
CREATE POLICY "Users can upload mood images" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'mood-images' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "Mood images are publicly viewable" ON storage.objects FOR SELECT USING (bucket_id = 'mood-images');
CREATE POLICY "Users can update their own mood images" ON storage.objects FOR UPDATE USING (
  bucket_id = 'mood-images' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Storage policies for voice recordings
CREATE POLICY "Users can upload voice recordings" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'voice-recordings' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "Users can access their own voice recordings" ON storage.objects FOR SELECT USING (
  bucket_id = 'voice-recordings' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Storage policies for avatars
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users can upload their own avatar" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'avatars' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "Users can update their own avatar" ON storage.objects FOR UPDATE USING (
  bucket_id = 'avatars' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Enable realtime for real-time updates
ALTER TABLE public.moods REPLICA IDENTITY FULL;
ALTER TABLE public.mood_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.group_members REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.moods;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mood_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON public.groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_vibe_streaks_updated_at BEFORE UPDATE ON public.vibe_streaks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();