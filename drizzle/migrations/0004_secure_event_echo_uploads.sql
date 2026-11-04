DROP POLICY IF EXISTS "attendee reviews completed booked event" ON public.reviews;
CREATE POLICY "attendee reviews completed booked event" ON public.reviews
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.registrations AS r
    JOIN public.events AS e ON e.id = r.event_id
    WHERE r.user_id = auth.uid()
      AND r.event_id = public.reviews.event_id
      AND r.kind = 'booked'
      AND e.end_at < now()
  )
);

DROP POLICY IF EXISTS "Rangora attendees upload completed event media" ON storage.objects;
CREATE POLICY "Rangora attendees upload completed event media" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'rangora-event-echo'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND EXISTS (
    SELECT 1
    FROM public.registrations AS r
    JOIN public.events AS e ON e.id = r.event_id
    WHERE r.user_id = auth.uid()
      AND r.event_id = CASE WHEN (storage.foldername(name))[1] ~ '^[0-9]+$' THEN (storage.foldername(name))[1]::integer ELSE -1 END
      AND r.kind = 'booked'
      AND e.end_at < now()
  )
);