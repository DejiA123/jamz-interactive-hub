-- Host Studio can remove players, but only by proving the host passcode to the database.
-- The passcode is stored as a bcrypt hash in a table visitors cannot read.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.host_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  passcode_hash text NOT NULL
);
ALTER TABLE public.host_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.host_settings FROM anon, authenticated;

-- bcrypt hash of the current host passcode (trimmed, upper-case).
INSERT INTO public.host_settings (id, passcode_hash)
VALUES (true, '$2a$10$L5Q7GWZYK3N/JRUyz5h6V.k9Dlbfnk9IF9QRvSPHVnAgBtByOYPfi')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.check_host_passcode(p_passcode text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.host_settings
    WHERE passcode_hash = extensions.crypt(upper(trim(coalesce(p_passcode, ''))), passcode_hash)
  );
$$;

-- Removing a player also removes their answers (responses cascade).
CREATE OR REPLACE FUNCTION public.host_remove_participant(p_passcode text, p_participant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT public.check_host_passcode(p_passcode) THEN
    RAISE EXCEPTION 'Incorrect host passcode' USING ERRCODE = '28P01';
  END IF;
  DELETE FROM public.participants WHERE id = p_participant_id;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.host_remove_all_participants(p_passcode text, p_session_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  removed integer;
BEGIN
  IF NOT public.check_host_passcode(p_passcode) THEN
    RAISE EXCEPTION 'Incorrect host passcode' USING ERRCODE = '28P01';
  END IF;
  DELETE FROM public.participants WHERE session_id = p_session_id;
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;

REVOKE ALL ON FUNCTION public.check_host_passcode(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.host_remove_participant(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.host_remove_all_participants(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_host_passcode(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.host_remove_participant(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.host_remove_all_participants(text, uuid) TO anon, authenticated;
