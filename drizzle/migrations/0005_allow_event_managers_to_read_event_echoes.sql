CREATE POLICY "event managers read their event echoes" ON public.reviews
FOR SELECT TO authenticated
USING (public.can_manage_event(event_id));