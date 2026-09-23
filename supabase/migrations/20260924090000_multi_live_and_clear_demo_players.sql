-- Several moments can now be live in a room at once. activities.is_published now means
-- "open to the audience right now" (the responses insert policy already requires it).
-- Before this change every launched moment stayed published, so switch off those stale
-- launches, keeping each live room's current moment. Only rows last touched before the
-- multi-live release are affected, so moments launched since then are never switched off.
UPDATE public.activities a
SET is_published = false
WHERE a.is_published
  AND a.updated_at < '2026-09-23 23:25:00+00'
  AND NOT EXISTS (
    SELECT 1 FROM public.event_sessions s
    WHERE s.current_activity_id = a.id AND s.status = 'live'
  );

-- Remove the seeded demo players. Their demo answers are removed by the cascade.
DELETE FROM public.participants
WHERE id IN (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000003',
  '40000000-0000-4000-8000-000000000004'
);
