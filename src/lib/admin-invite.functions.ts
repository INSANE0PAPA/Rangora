import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const activateAdminAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => {
    if (typeof input.code !== "string" || !input.code.trim() || input.code.length > 200) {
      throw new Error("Enter a valid administrator invite code.");
    }
    return { code: input.code.trim() };
  })
  .handler(async ({ data, context }) => {
    const expected = process.env["RANGORA_ADMIN_INVITE_CODE"];
    if (!expected) throw new Error("Administrator invitations are not configured.");
    const encoder = new TextEncoder();
    const [provided, configured] = await Promise.all([
      crypto.subtle.digest("SHA-256", encoder.encode(data.code)),
      crypto.subtle.digest("SHA-256", encoder.encode(expected)),
    ]);
    const left = new Uint8Array(provided);
    const right = new Uint8Array(configured);
    let difference = 0;
    for (let index = 0; index < left.length; index += 1) difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
    if (difference !== 0) throw new Error("That administrator invite code is not valid.");

    const { data: application, error: applicationError } = await context.supabase
      .from("admin_profiles")
      .select("user_id,status")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (applicationError || !application || application.status !== "pending") {
      throw new Error("This account is not waiting for administrator activation.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: authResult, error: authError } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    if (authError || !authResult.user?.email_confirmed_at) throw new Error("Confirm your email before activating administrator access.");
    const { error: roleError } = await supabaseAdmin.from("user_roles").upsert(
      { user_id: context.userId, role: "admin" },
      { onConflict: "user_id,role", ignoreDuplicates: true },
    );
    if (roleError) throw new Error("Administrator access could not be activated.");
    const { error: profileError } = await supabaseAdmin.from("admin_profiles").update({ status: "approved" }).eq("user_id", context.userId);
    if (profileError) throw new Error("Administrator profile could not be updated.");
    return { ok: true };
  });