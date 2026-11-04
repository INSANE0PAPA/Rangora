CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m jsonb := coalesce(NEW.raw_user_meta_data, '{}'::jsonb);
  nm text;
  account_type text;
BEGIN
  nm := coalesce(nullif(m->>'full_name', ''), split_part(NEW.email, '@', 1));
  account_type := coalesce(m->>'account_type', 'participant');

  INSERT INTO public.profiles(id, full_name, email, phone, address, department, course, preferences)
  VALUES (
    NEW.id, nm, NEW.email, m->>'phone', m->>'address', m->>'department', m->>'course',
    ARRAY(SELECT jsonb_array_elements_text(CASE WHEN jsonb_typeof(m->'preferences')='array' THEN m->'preferences' ELSE '[]'::jsonb END))
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'participant') ON CONFLICT DO NOTHING;
  INSERT INTO public.leaderboard(user_id, display_name, department)
  VALUES (NEW.id, nm, m->>'department') ON CONFLICT DO NOTHING;

  IF account_type = 'organizer' THEN
    INSERT INTO public.organiser_profiles(user_id, org_name, position, org_type, institutional_id, description)
    VALUES (NEW.id, coalesce(m->>'org_name',''), coalesce(m->>'position',''), coalesce(m->>'org_type',''), m->>'institutional_id', m->>'org_description')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_organiser_role_after_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.user_id, 'organizer') ON CONFLICT DO NOTHING;
  ELSIF OLD.status = 'approved' AND NEW.status <> 'approved' THEN
    DELETE FROM public.user_roles WHERE user_id = NEW.user_id AND role = 'organizer';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.sync_organiser_role_after_review() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER sync_organiser_role_after_review
AFTER UPDATE OF status ON public.organiser_profiles
FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.sync_organiser_role_after_review();

CREATE POLICY "review owner reads own echo" ON public.reviews
FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

REVOKE EXECUTE ON FUNCTION public.sync_organiser_role_after_review() FROM PUBLIC, anon, authenticated;