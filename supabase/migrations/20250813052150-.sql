-- Create helper RPCs to operate under RLS using current_user_id from Clerk
-- These functions are SECURITY DEFINER and set the app.current_user_id so RLS policies pass

create schema if not exists public;

-- Create post with song upsert (by provider/provider_song_id)
CREATE OR REPLACE FUNCTION public.create_post(
  _user_id text,
  _song_provider text,
  _provider_song_id text,
  _title text,
  _artist text,
  _album text DEFAULT NULL,
  _artwork_url text DEFAULT NULL,
  _caption text DEFAULT NULL,
  _visibility text DEFAULT 'public'
) RETURNS public.posts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_song_id uuid;
  v_post public.posts;
BEGIN
  -- Ensure RLS checks see the current user
  PERFORM set_config('app.current_user_id', _user_id, true);

  -- Try to find existing song by provider + external id
  SELECT id INTO v_song_id
  FROM public.songs
  WHERE provider = _song_provider AND provider_song_id = _provider_song_id
  LIMIT 1;

  -- If not found, insert
  IF v_song_id IS NULL THEN
    INSERT INTO public.songs (provider, provider_song_id, title, artist, album, artwork_url)
    VALUES (_song_provider, _provider_song_id, _title, _artist, _album, _artwork_url)
    RETURNING id INTO v_song_id;
  END IF;

  -- Create the post
  INSERT INTO public.posts (user_id, song_id, caption, visibility)
  VALUES (_user_id, v_song_id, _caption, COALESCE(_visibility, 'public'))
  RETURNING * INTO v_post;

  RETURN v_post;
END;
$$;

-- Add a comment to a post
CREATE OR REPLACE FUNCTION public.add_comment(
  _user_id text,
  _post_id uuid,
  _content text
) RETURNS public.post_comments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comment public.post_comments;
BEGIN
  PERFORM set_config('app.current_user_id', _user_id, true);

  INSERT INTO public.post_comments (user_id, post_id, content)
  VALUES (_user_id, _post_id, _content)
  RETURNING * INTO v_comment;

  RETURN v_comment;
END;
$$;

-- Toggle like on a post
CREATE OR REPLACE FUNCTION public.toggle_like(
  _user_id text,
  _post_id uuid
) RETURNS TABLE(action text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_like_id uuid;
BEGIN
  PERFORM set_config('app.current_user_id', _user_id, true);

  SELECT id INTO v_like_id FROM public.post_likes
  WHERE user_id = _user_id AND post_id = _post_id;

  IF v_like_id IS NULL THEN
    INSERT INTO public.post_likes (user_id, post_id) VALUES (_user_id, _post_id);
    RETURN QUERY SELECT 'liked'::text;
  ELSE
    DELETE FROM public.post_likes WHERE id = v_like_id;
    RETURN QUERY SELECT 'unliked'::text;
  END IF;
END;
$$;