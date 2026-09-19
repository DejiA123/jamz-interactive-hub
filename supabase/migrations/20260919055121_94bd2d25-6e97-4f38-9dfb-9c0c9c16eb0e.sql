CREATE TYPE public.session_status AS ENUM ('draft', 'live', 'closed');
CREATE TYPE public.activity_kind AS ENUM ('quiz', 'poll', 'word_cloud', 'rating', 'challenge');

CREATE TABLE public.event_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid,
  title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 120),
  join_code text NOT NULL UNIQUE CHECK (join_code ~ '^[0-9]{6}$'),
  theme text NOT NULL DEFAULT 'To live is Christ',
  status public.session_status NOT NULL DEFAULT 'draft',
  current_activity_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_sessions TO authenticated;
GRANT SELECT ON public.event_sessions TO anon;
GRANT ALL ON public.event_sessions TO service_role;
ALTER TABLE public.event_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view live sessions" ON public.event_sessions FOR SELECT TO anon, authenticated USING (status IN ('live', 'closed'));
CREATE POLICY "Hosts can view own sessions" ON public.event_sessions FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Hosts can create sessions" ON public.event_sessions FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Hosts can update own sessions" ON public.event_sessions FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Hosts can delete own sessions" ON public.event_sessions FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE TABLE public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.event_sessions(id) ON DELETE CASCADE,
  kind public.activity_kind NOT NULL,
  prompt text NOT NULL CHECK (char_length(prompt) BETWEEN 2 AND 300),
  position integer NOT NULL DEFAULT 0,
  duration_seconds integer NOT NULL DEFAULT 45 CHECK (duration_seconds BETWEEN 5 AND 600),
  points integer NOT NULL DEFAULT 1000 CHECK (points BETWEEN 0 AND 10000),
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.activities TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activities TO authenticated;
GRANT ALL ON public.activities TO service_role;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view published activities" ON public.activities FOR SELECT TO anon, authenticated USING (is_published AND EXISTS (SELECT 1 FROM public.event_sessions s WHERE s.id = session_id AND s.status IN ('live', 'closed')));
CREATE POLICY "Hosts can view own activities" ON public.activities FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.event_sessions s WHERE s.id = session_id AND s.owner_id = auth.uid()));
CREATE POLICY "Hosts can create own activities" ON public.activities FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.event_sessions s WHERE s.id = session_id AND s.owner_id = auth.uid()));
CREATE POLICY "Hosts can update own activities" ON public.activities FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.event_sessions s WHERE s.id = session_id AND s.owner_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.event_sessions s WHERE s.id = session_id AND s.owner_id = auth.uid()));
CREATE POLICY "Hosts can delete own activities" ON public.activities FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.event_sessions s WHERE s.id = session_id AND s.owner_id = auth.uid()));

CREATE TABLE public.activity_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 160),
  position integer NOT NULL DEFAULT 0,
  is_correct boolean NOT NULL DEFAULT false
);
GRANT SELECT ON public.activity_options TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_options TO authenticated;
GRANT ALL ON public.activity_options TO service_role;
ALTER TABLE public.activity_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view activity options" ON public.activity_options FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.activities a JOIN public.event_sessions s ON s.id = a.session_id WHERE a.id = activity_id AND a.is_published AND s.status IN ('live', 'closed')));
CREATE POLICY "Hosts manage own options" ON public.activity_options FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.activities a JOIN public.event_sessions s ON s.id = a.session_id WHERE a.id = activity_id AND s.owner_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.activities a JOIN public.event_sessions s ON s.id = a.session_id WHERE a.id = activity_id AND s.owner_id = auth.uid()));

CREATE TABLE public.participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.event_sessions(id) ON DELETE CASCADE,
  nickname text NOT NULL CHECK (char_length(nickname) BETWEEN 2 AND 24),
  score integer NOT NULL DEFAULT 0,
  joined_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.participants TO anon, authenticated;
GRANT UPDATE, DELETE ON public.participants TO authenticated;
GRANT ALL ON public.participants TO service_role;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view live participants" ON public.participants FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.event_sessions s WHERE s.id = session_id AND s.status IN ('live', 'closed')));
CREATE POLICY "Anyone can join live sessions" ON public.participants FOR INSERT TO anon, authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.event_sessions s WHERE s.id = session_id AND s.status = 'live'));
CREATE POLICY "Hosts manage own participants" ON public.participants FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.event_sessions s WHERE s.id = session_id AND s.owner_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.event_sessions s WHERE s.id = session_id AND s.owner_id = auth.uid()));

CREATE TABLE public.responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  option_id uuid REFERENCES public.activity_options(id) ON DELETE SET NULL,
  text_answer text CHECK (char_length(text_answer) <= 500),
  rating integer CHECK (rating BETWEEN 1 AND 5),
  points_awarded integer NOT NULL DEFAULT 0 CHECK (points_awarded BETWEEN 0 AND 10000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (activity_id, participant_id)
);
GRANT SELECT, INSERT ON public.responses TO anon, authenticated;
GRANT DELETE ON public.responses TO authenticated;
GRANT ALL ON public.responses TO service_role;
ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view live responses" ON public.responses FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.activities a JOIN public.event_sessions s ON s.id = a.session_id WHERE a.id = activity_id AND s.status IN ('live', 'closed')));
CREATE POLICY "Anyone can answer published activities" ON public.responses FOR INSERT TO anon, authenticated WITH CHECK (points_awarded = 0 AND EXISTS (SELECT 1 FROM public.activities a JOIN public.event_sessions s ON s.id = a.session_id JOIN public.participants p ON p.session_id = s.id WHERE a.id = activity_id AND p.id = participant_id AND a.is_published AND s.status = 'live'));
CREATE POLICY "Hosts delete own responses" ON public.responses FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.activities a JOIN public.event_sessions s ON s.id = a.session_id WHERE a.id = activity_id AND s.owner_id = auth.uid()));

ALTER TABLE public.event_sessions ADD CONSTRAINT event_sessions_current_activity_fk FOREIGN KEY (current_activity_id) REFERENCES public.activities(id) ON DELETE SET NULL;
CREATE INDEX activities_session_position_idx ON public.activities(session_id, position);
CREATE INDEX participants_session_score_idx ON public.participants(session_id, score DESC);
CREATE INDEX responses_activity_idx ON public.responses(activity_id);

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER event_sessions_updated_at BEFORE UPDATE ON public.event_sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER activities_updated_at BEFORE UPDATE ON public.activities FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.event_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.responses;

INSERT INTO public.event_sessions (id, title, join_code, theme, status, current_activity_id) VALUES ('10000000-0000-4000-8000-000000000001', 'Gospel Jamz Live', '260018', 'To live is Christ', 'live', NULL);
INSERT INTO public.activities (id, session_id, kind, prompt, position, duration_seconds, points, is_published) VALUES
('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'word_cloud', 'What does worship mean to you?', 1, 90, 500, true),
('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'quiz', 'Which apostle was known as the Beloved?', 2, 45, 1000, true),
('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'poll', 'Which creative expression moves you most?', 3, 45, 600, true),
('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'challenge', 'Share your testimony in 10 words', 4, 120, 800, true);
UPDATE public.event_sessions SET current_activity_id = '20000000-0000-4000-8000-000000000002' WHERE id = '10000000-0000-4000-8000-000000000001';
INSERT INTO public.activity_options (id, activity_id, label, position, is_correct) VALUES
('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'Peter', 1, false),
('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'Paul', 2, false),
('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', 'John', 3, true),
('30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000002', 'James', 4, false),
('30000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000003', 'Music', 1, false),
('30000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000003', 'Dance', 2, false),
('30000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000003', 'Spoken word', 3, false),
('30000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000003', 'Visual art', 4, false);
INSERT INTO public.participants (id, session_id, nickname, score) VALUES
('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Daniel A.', 2450),
('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Sarah J.', 2120),
('40000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'Marcus W.', 1980),
('40000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'GraceFire', 1740);
INSERT INTO public.responses (activity_id, participant_id, text_answer) VALUES
('20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'Freedom'),
('20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', 'Purpose'),
('20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000003', 'Grace'),
('20000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000004', 'Truth');