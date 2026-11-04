ALTER TABLE public.event_badges ADD COLUMN IF NOT EXISTS emoji text NOT NULL DEFAULT '✦';
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS liked_by_organiser boolean NOT NULL DEFAULT false;
ALTER TABLE public.sponsors ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'Silver';
ALTER TABLE public.sponsors ADD COLUMN IF NOT EXISTS contact text;
ALTER TABLE public.sponsors ADD COLUMN IF NOT EXISTS message text;
ALTER TABLE public.sponsors ADD COLUMN IF NOT EXISTS requested_by uuid;
ALTER TABLE public.help_requests ADD COLUMN IF NOT EXISTS routed_to uuid;
ALTER TABLE public.reward_awards ADD COLUMN IF NOT EXISTS display_name text NOT NULL DEFAULT '';
ALTER TABLE public.reward_awards ADD COLUMN IF NOT EXISTS note text NOT NULL DEFAULT '';

UPDATE public.help_requests h
SET routed_to = e.organiser_id
FROM public.events e
WHERE h.event_id = e.id AND h.routed_to IS NULL AND e.organiser_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.route_help_request_to_event_organiser()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.event_id IS NOT NULL THEN
    SELECT organiser_id INTO NEW.routed_to FROM public.events WHERE id = NEW.event_id;
  ELSE
    NEW.routed_to := NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.route_help_request_to_event_organiser() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS route_help_request_to_event_organiser ON public.help_requests;
CREATE TRIGGER route_help_request_to_event_organiser
BEFORE INSERT OR UPDATE OF event_id ON public.help_requests
FOR EACH ROW EXECUTE FUNCTION public.route_help_request_to_event_organiser();

CREATE OR REPLACE FUNCTION public.toggle_review_like(_rid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_event integer;
  new_state boolean;
BEGIN
  SELECT event_id INTO target_event FROM public.reviews WHERE id = _rid;
  IF target_event IS NULL OR NOT public.can_manage_event(target_event) THEN
    RAISE EXCEPTION 'Only this event team may like its Event Echo.';
  END IF;
  UPDATE public.reviews
  SET liked_by_organiser = NOT liked_by_organiser
  WHERE id = _rid
  RETURNING liked_by_organiser INTO new_state;
  RETURN new_state;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.toggle_review_like(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_review_like(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_approved_organiser(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_approved_organiser(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.can_manage_event(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_event(integer) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.event_booked_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.event_booked_counts() TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.event_clashes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.event_clashes() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.platform_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_stats() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_rewards(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.events_no_clash() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.registration_capacity_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reviews_validate() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_leaderboard_profile() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_registration_change() FROM PUBLIC, anon, authenticated;