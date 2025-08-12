-- LOOPLY core schema and policies
-- Note: follows the existing project pattern using current_setting('app.current_user_id', true)

-- 1) Helper enum for response types
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'response_type') THEN
    CREATE TYPE public.response_type AS ENUM ('image','audio','video','text','ai');
  END IF;
END$$;

-- 2) Songs catalog (publicly viewable)
CREATE TABLE IF NOT EXISTS public.songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('spotify','apple_music','youtube')),
  provider_song_id text NOT NULL,
  title text NOT NULL,
  artist text NOT NULL,
  album text,
  artwork_url text,
  duration_ms integer,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_song_id)
);

ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='songs' AND policyname='Anyone can view songs'
  ) THEN
    CREATE POLICY "Anyone can view songs"
    ON public.songs
    FOR SELECT
    USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='songs' AND policyname='Anyone can add songs'
  ) THEN
    CREATE POLICY "Anyone can add songs"
    ON public.songs
    FOR INSERT
    WITH CHECK (true);
  END IF;
END$$;

-- 3) Follows (social graph)
CREATE TABLE IF NOT EXISTS public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id text NOT NULL,
  following_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT follows_unique UNIQUE (follower_id, following_id),
  CONSTRAINT follows_self_check CHECK (follower_id <> following_id)
);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='follows' AND policyname='Anyone can view follows'
  ) THEN
    CREATE POLICY "Anyone can view follows"
    ON public.follows
    FOR SELECT
    USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='follows' AND policyname='Users can follow'
  ) THEN
    CREATE POLICY "Users can follow"
    ON public.follows
    FOR INSERT
    WITH CHECK (follower_id = current_setting('app.current_user_id', true));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='follows' AND policyname='Users can unfollow'
  ) THEN
    CREATE POLICY "Users can unfollow"
    ON public.follows
    FOR DELETE
    USING (follower_id = current_setting('app.current_user_id', true));
  END IF;
END$$;

-- 4) Posts (favorite song posts)
CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  caption text,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','followers')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_posts_updated_at'
  ) THEN
    CREATE TRIGGER update_posts_updated_at
    BEFORE UPDATE ON public.posts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

-- Policies for posts
DO $$
BEGIN
  -- View posts you can see (public, your own, or those by people you follow)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='posts' AND policyname='View visible posts'
  ) THEN
    CREATE POLICY "View visible posts"
    ON public.posts
    FOR SELECT
    USING (
      visibility = 'public'
      OR user_id = current_setting('app.current_user_id', true)
      OR EXISTS (
        SELECT 1 FROM public.follows f
        WHERE f.follower_id = current_setting('app.current_user_id', true)
          AND f.following_id = posts.user_id
      )
    );
  END IF;
  -- Create own posts
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='posts' AND policyname='Create own posts'
  ) THEN
    CREATE POLICY "Create own posts"
    ON public.posts
    FOR INSERT
    WITH CHECK (user_id = current_setting('app.current_user_id', true));
  END IF;
  -- Update own posts
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='posts' AND policyname='Update own posts'
  ) THEN
    CREATE POLICY "Update own posts"
    ON public.posts
    FOR UPDATE
    USING (user_id = current_setting('app.current_user_id', true));
  END IF;
  -- Delete own posts
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='posts' AND policyname='Delete own posts'
  ) THEN
    CREATE POLICY "Delete own posts"
    ON public.posts
    FOR DELETE
    USING (user_id = current_setting('app.current_user_id', true));
  END IF;
END$$;

-- Index for feed performance
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON public.posts (user_id);
CREATE INDEX IF NOT EXISTS idx_posts_song_id ON public.posts (song_id);

-- 5) Responses to posts (creative works)
CREATE TABLE IF NOT EXISTS public.responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  type public.response_type NOT NULL,
  media_url text,
  prompt text,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;

-- Updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_responses_updated_at'
  ) THEN
    CREATE TRIGGER update_responses_updated_at
    BEFORE UPDATE ON public.responses
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

-- Policies for responses
DO $$
BEGIN
  -- View responses if you can view the parent post
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='responses' AND policyname='View responses of visible posts'
  ) THEN
    CREATE POLICY "View responses of visible posts"
    ON public.responses
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.posts p
        WHERE p.id = responses.post_id
          AND (
            p.visibility = 'public'
            OR p.user_id = current_setting('app.current_user_id', true)
            OR EXISTS (
              SELECT 1 FROM public.follows f
              WHERE f.follower_id = current_setting('app.current_user_id', true)
                AND f.following_id = p.user_id
            )
          )
      )
    );
  END IF;
  -- Create responses to posts you can see
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='responses' AND policyname='Create responses on visible posts'
  ) THEN
    CREATE POLICY "Create responses on visible posts"
    ON public.responses
    FOR INSERT
    WITH CHECK (
      user_id = current_setting('app.current_user_id', true)
      AND EXISTS (
        SELECT 1 FROM public.posts p
        WHERE p.id = responses.post_id
          AND (
            p.visibility = 'public'
            OR p.user_id = current_setting('app.current_user_id', true)
            OR EXISTS (
              SELECT 1 FROM public.follows f
              WHERE f.follower_id = current_setting('app.current_user_id', true)
                AND f.following_id = p.user_id
            )
          )
      )
    );
  END IF;
  -- Update/Delete own responses
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='responses' AND policyname='Update own responses'
  ) THEN
    CREATE POLICY "Update own responses"
    ON public.responses
    FOR UPDATE
    USING (user_id = current_setting('app.current_user_id', true));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='responses' AND policyname='Delete own responses'
  ) THEN
    CREATE POLICY "Delete own responses"
    ON public.responses
    FOR DELETE
    USING (user_id = current_setting('app.current_user_id', true));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_responses_post_id ON public.responses (post_id);
CREATE INDEX IF NOT EXISTS idx_responses_user_id ON public.responses (user_id);

-- 6) Post likes
CREATE TABLE IF NOT EXISTS public.post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- View likes if you can view the post
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='post_likes' AND policyname='View likes of visible posts'
  ) THEN
    CREATE POLICY "View likes of visible posts"
    ON public.post_likes
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.posts p
        WHERE p.id = post_likes.post_id
          AND (
            p.visibility = 'public'
            OR p.user_id = current_setting('app.current_user_id', true)
            OR EXISTS (
              SELECT 1 FROM public.follows f
              WHERE f.follower_id = current_setting('app.current_user_id', true)
                AND f.following_id = p.user_id
            )
          )
      )
    );
  END IF;
  -- Like posts you can see (only by yourself)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='post_likes' AND policyname='Like visible posts'
  ) THEN
    CREATE POLICY "Like visible posts"
    ON public.post_likes
    FOR INSERT
    WITH CHECK (
      user_id = current_setting('app.current_user_id', true)
      AND EXISTS (
        SELECT 1 FROM public.posts p
        WHERE p.id = post_likes.post_id
          AND (
            p.visibility = 'public'
            OR p.user_id = current_setting('app.current_user_id', true)
            OR EXISTS (
              SELECT 1 FROM public.follows f
              WHERE f.follower_id = current_setting('app.current_user_id', true)
                AND f.following_id = p.user_id
            )
          )
      )
    );
  END IF;
  -- Unlike your own like
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='post_likes' AND policyname='Unlike own likes'
  ) THEN
    CREATE POLICY "Unlike own likes"
    ON public.post_likes
    FOR DELETE
    USING (user_id = current_setting('app.current_user_id', true));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON public.post_likes (post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON public.post_likes (user_id);

-- 7) Post comments
CREATE TABLE IF NOT EXISTS public.post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_post_comments_updated_at'
  ) THEN
    CREATE TRIGGER update_post_comments_updated_at
    BEFORE UPDATE ON public.post_comments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

DO $$
BEGIN
  -- View comments if you can view the post
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='post_comments' AND policyname='View comments of visible posts'
  ) THEN
    CREATE POLICY "View comments of visible posts"
    ON public.post_comments
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.posts p
        WHERE p.id = post_comments.post_id
          AND (
            p.visibility = 'public'
            OR p.user_id = current_setting('app.current_user_id', true)
            OR EXISTS (
              SELECT 1 FROM public.follows f
              WHERE f.follower_id = current_setting('app.current_user_id', true)
                AND f.following_id = p.user_id
            )
          )
      )
    );
  END IF;
  -- Create comments on posts you can see (only by yourself)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='post_comments' AND policyname='Comment on visible posts'
  ) THEN
    CREATE POLICY "Comment on visible posts"
    ON public.post_comments
    FOR INSERT
    WITH CHECK (
      user_id = current_setting('app.current_user_id', true)
      AND EXISTS (
        SELECT 1 FROM public.posts p
        WHERE p.id = post_comments.post_id
          AND (
            p.visibility = 'public'
            OR p.user_id = current_setting('app.current_user_id', true)
            OR EXISTS (
              SELECT 1 FROM public.follows f
              WHERE f.follower_id = current_setting('app.current_user_id', true)
                AND f.following_id = p.user_id
            )
          )
      )
    );
  END IF;
  -- Update/Delete own comments
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='post_comments' AND policyname='Update own comments'
  ) THEN
    CREATE POLICY "Update own comments"
    ON public.post_comments
    FOR UPDATE
    USING (user_id = current_setting('app.current_user_id', true));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='post_comments' AND policyname='Delete own comments'
  ) THEN
    CREATE POLICY "Delete own comments"
    ON public.post_comments
    FOR DELETE
    USING (user_id = current_setting('app.current_user_id', true));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON public.post_comments (post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_user_id ON public.post_comments (user_id);

-- 8) Storage bucket for media
-- Create bucket if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'looply-media'
  ) THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('looply-media', 'looply-media', true);
  END IF;
END$$;

-- Storage policies for the bucket
DO $$
BEGIN
  -- Public read
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Looply media is publicly accessible'
  ) THEN
    CREATE POLICY "Looply media is publicly accessible"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'looply-media');
  END IF;
  -- Users can upload/update/delete their own files under a user_id prefix
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users can upload looply media'
  ) THEN
    CREATE POLICY "Users can upload looply media"
    ON storage.objects
    FOR INSERT
    WITH CHECK (
      bucket_id = 'looply-media'
      AND current_setting('app.current_user_id', true) = (storage.foldername(name))[1]
    );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users can update looply media'
  ) THEN
    CREATE POLICY "Users can update looply media"
    ON storage.objects
    FOR UPDATE
    USING (
      bucket_id = 'looply-media'
      AND current_setting('app.current_user_id', true) = (storage.foldername(name))[1]
    )
    WITH CHECK (
      bucket_id = 'looply-media'
      AND current_setting('app.current_user_id', true) = (storage.foldername(name))[1]
    );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users can delete looply media'
  ) THEN
    CREATE POLICY "Users can delete looply media"
    ON storage.objects
    FOR DELETE
    USING (
      bucket_id = 'looply-media'
      AND current_setting('app.current_user_id', true) = (storage.foldername(name))[1]
    );
  END IF;
END$$;

-- 9) Helpful indexes
CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows (follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows (following_id);
CREATE INDEX IF NOT EXISTS idx_songs_provider ON public.songs (provider, provider_song_id);
