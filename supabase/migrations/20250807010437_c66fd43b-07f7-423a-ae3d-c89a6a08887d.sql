-- Fix security warnings

-- Fix function search path for get_user_id_from_clerk
CREATE OR REPLACE FUNCTION public.get_user_id_from_clerk(clerk_user_id TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id FROM public.profiles WHERE user_id = clerk_user_id;
$$;

-- Fix function search path for update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Add missing RLS policy for user_roles table
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (user_id = current_setting('app.current_user_id', true));
CREATE POLICY "Users can insert their own role" ON public.user_roles FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id', true));