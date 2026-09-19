CREATE TABLE public.activity_answers (
  activity_id uuid PRIMARY KEY REFERENCES public.activities(id) ON DELETE CASCADE,
  correct_option_id uuid NOT NULL REFERENCES public.activity_options(id) ON DELETE CASCADE
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_answers TO authenticated;
GRANT ALL ON public.activity_answers TO service_role;
ALTER TABLE public.activity_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hosts manage answers for own activities" ON public.activity_answers FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.activities a JOIN public.event_sessions s ON s.id = a.session_id WHERE a.id = activity_id AND s.owner_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.activities a JOIN public.event_sessions s ON s.id = a.session_id WHERE a.id = activity_id AND s.owner_id = auth.uid()));

INSERT INTO public.activity_answers (activity_id, correct_option_id) VALUES ('20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003');
UPDATE public.activity_options SET is_correct = false WHERE is_correct = true;

CREATE OR REPLACE FUNCTION public.score_response() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  answer_id uuid;
  reward integer;
BEGIN
  SELECT aa.correct_option_id, a.points INTO answer_id, reward
  FROM public.activities a
  LEFT JOIN public.activity_answers aa ON aa.activity_id = a.id
  WHERE a.id = NEW.activity_id;
  IF answer_id IS NOT NULL AND NEW.option_id = answer_id THEN
    NEW.points_awarded := reward;
    UPDATE public.participants SET score = score + reward WHERE id = NEW.participant_id;
  ELSE
    NEW.points_awarded := 0;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER score_response_before_insert BEFORE INSERT ON public.responses FOR EACH ROW EXECUTE FUNCTION public.score_response();