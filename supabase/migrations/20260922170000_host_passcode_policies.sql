-- Allow anon and authenticated access for Host Studio passcode and live room participation
DROP POLICY IF EXISTS "Public can view live sessions" ON public.event_sessions;
DROP POLICY IF EXISTS "Hosts can view own sessions" ON public.event_sessions;
DROP POLICY IF EXISTS "Hosts can create sessions" ON public.event_sessions;
DROP POLICY IF EXISTS "Hosts can update own sessions" ON public.event_sessions;
DROP POLICY IF EXISTS "Hosts can delete own sessions" ON public.event_sessions;

CREATE POLICY "Anyone can view sessions" ON public.event_sessions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can create sessions" ON public.event_sessions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can update sessions" ON public.event_sessions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete sessions" ON public.event_sessions FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public can view published activities" ON public.activities;
DROP POLICY IF EXISTS "Hosts can view own activities" ON public.activities;
DROP POLICY IF EXISTS "Hosts can create own activities" ON public.activities;
DROP POLICY IF EXISTS "Hosts can update own activities" ON public.activities;
DROP POLICY IF EXISTS "Hosts can delete own activities" ON public.activities;

CREATE POLICY "Anyone can view activities" ON public.activities FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can create activities" ON public.activities FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can update activities" ON public.activities FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete activities" ON public.activities FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public can view activity options" ON public.activity_options;
DROP POLICY IF EXISTS "Hosts manage own options" ON public.activity_options;

CREATE POLICY "Anyone can view options" ON public.activity_options FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can manage options" ON public.activity_options FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Hosts manage answers for own activities" ON public.activity_answers;
CREATE POLICY "Anyone can manage activity answers" ON public.activity_answers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

GRANT ALL ON public.event_sessions TO anon, authenticated;
GRANT ALL ON public.activities TO anon, authenticated;
GRANT ALL ON public.activity_options TO anon, authenticated;
GRANT ALL ON public.activity_answers TO anon, authenticated;
