import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { DotField } from "@/components/DotField";
import { PreferencePicker } from "@/components/PreferencePicker";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { activateAdminAccount } from "@/lib/admin-invite.functions";
import { useServerFn } from "@tanstack/react-start";
import { img } from "@/assets/rangora";
import {
  Mail,
  Lock,
  User,
  Building,
  ArrowRight,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Ticket,
  Activity,
  ShieldCheck,
  Star,
  Flame,
} from "lucide-react";

const searchSchema = z.object({
  mode: z.enum(["login", "signup"]).optional().default("login"),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in or create an account | Rangora" },
      {
        name: "description",
        content:
          "Join Rangora as a participant, apply to organise campus events, or activate an invited administrator account.",
      },
      { property: "og:title", content: "Join Rangora" },
      { property: "og:description", content: "Create your role-specific Rangora account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

type RoleChoice = "participant" | "organizer";

type FormState = {
  full_name: string;
  email: string;
  password: string;
  phone: string;
  address: string;
  department: string;
  course: string;
  preferences: string[];
  account_type: RoleChoice;
  org_name: string;
  position: string;
  org_type: string;
  institutional_id: string;
  org_description: string;
  office: string;
  designation: string;
  staff_id: string;
  invite: string;
};

const initial: FormState = {
  full_name: "",
  email: "",
  password: "",
  phone: "",
  address: "",
  department: "",
  course: "",
  preferences: [],
  account_type: "participant",
  org_name: "",
  position: "",
  org_type: "",
  institutional_id: "",
  org_description: "",
  office: "",
  designation: "",
  staff_id: "",
  invite: "",
};

function AuthPage() {
  const { mode } = Route.useSearch();
  const { user } = useSession();
  const navigate = useNavigate();
  const activate = useServerFn(activateAdminAccount);
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [adminPending, setAdminPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const field =
    (key: keyof FormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((old) => ({ ...old, [key]: event.target.value }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      if (adminPending && user) {
        await activate({ data: { code: form.invite } });
        toast.success("Administrator access activated.");
        await navigate({ to: "/dashboard" });
        return;
      }
      const base = z
        .object({
          email: z.string().trim().email().max(255),
          password: z.string().min(8).max(72),
          ...(mode === "signup" ? { full_name: z.string().trim().min(2).max(100) } : {}),
        })
        .safeParse(form);
      if (!base.success) {
        throw new Error(base.error.issues[0]?.message ?? "Check your details.");
      }

      if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: form.email.trim(),
          password: form.password,
        });
        if (error) throw error;
        const { data: adminApplication } = await supabase
          .from("admin_profiles")
          .select("status")
          .eq("user_id", data.user.id)
          .maybeSingle();
        if (adminApplication?.status === "pending") {
          setAdminPending(true);
          setNotice(
            "Your email is confirmed. Enter your administrator invite code to activate this account."
          );
          return;
        }
        toast.success("Welcome back to Rangora!");
        await navigate({ to: "/dashboard" });
        return;
      }

      if (form.account_type === "organizer") {
        z.object({
          org_name: z.string().trim().min(2).max(120),
          position: z.string().trim().min(2).max(100),
          org_type: z.string().trim().min(2).max(100),
          institutional_id: z.string().trim().min(3).max(120),
          org_description: z.string().trim().min(10).max(1200),
        }).parse(form);
        if (
          !/\.(edu|ac\.[a-z]{2,}|edu\.[a-z]{2,})$/i.test(
            form.email.trim().split("@")[1] ?? ""
          )
        ) {
          throw new Error("Use your institutional email address for an organiser application.");
        }
      }
      if (form.account_type === "participant") {
        z.object({
          phone: z.string().trim().min(8).max(20),
          department: z.string().trim().min(2).max(100),
          course: z.string().trim().min(2).max(100),
          address: z.string().trim().min(4).max(300),
          preferences: z.array(z.string()).min(1),
        }).parse(form);
      }

      const { email, password, invite: _invite, ...metadata } = form;
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth?mode=login`,
          data: metadata,
        },
      });
      if (error) throw error;
      setSent(true);
      toast.success("Confirmation link sent to your email!");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Please check your details and try again.";
      setNotice(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  const update = (key: keyof FormState, value: string) =>
    setForm((old) => ({ ...old, [key]: value }));

  return (
    <div className="relative min-h-screen bg-ivory text-ink selection:bg-terracotta selection:text-white">
      <DotField fixed />
      <SiteHeader />

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12 lg:gap-12">
          {/* Left Column: Visual Campus Showcase & Values */}
          <section className="space-y-6 lg:col-span-5 animate-rise">
            <div className="inline-flex items-center gap-2 border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#fff] px-3 py-1 text-xs font-black uppercase tracking-widest bg-saffron text-black rounded">
              <Sparkles size={13} className="shrink-0 text-black" />
              <span>Verified Campus Gateway</span>
            </div>

            <h1 className="serif-heading text-4xl sm:text-5xl font-black leading-[1.1]">
              Step into the heartbeat of{" "}
              <span className="inline-block px-2.5 py-0.5 -rotate-1 bg-terracotta text-white rounded border-2 border-black dark:border-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_#fff]">
                campus
              </span>{" "}
              celebrations.
            </h1>

            <p className="text-base font-medium leading-relaxed text-ink-body">
              Discover collegiate festivals, book verified passes, collect digital badge crests, and
              curate memories that stay with you long after graduation.
            </p>

            {/* Feature Value Badges */}
            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3 rounded-xl border-2 border-black dark:border-white bg-card p-3.5 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_#fff]">
                <div className="rounded-full border-2 border-black dark:border-white bg-terracotta p-2 text-white shrink-0 shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]">
                  <Activity size={18} />
                </div>
                <div>
                  <h4 className="font-mono text-xs font-black uppercase tracking-wider text-ink">
                    Live Seat Pulse &amp; Capacity
                  </h4>
                  <p className="text-xs text-ink-muted mt-0.5">
                    Real-time seat occupancy guarantees you never arrive to an overcrowded auditorium.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border-2 border-black dark:border-white bg-card p-3.5 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_#fff]">
                <div className="rounded-full border-2 border-black dark:border-white bg-saffron p-2 text-black shrink-0 shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]">
                  <Ticket size={18} />
                </div>
                <div>
                  <h4 className="font-mono text-xs font-black uppercase tracking-wider text-ink">
                    Digital Festival Passport
                  </h4>
                  <p className="text-xs text-ink-muted mt-0.5">
                    One pass per event with instant door check-in, clash guardian, and release options.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border-2 border-black dark:border-white bg-card p-3.5 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_#fff]">
                <div className="rounded-full border-2 border-black dark:border-white bg-sage p-2 text-white shrink-0 shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h4 className="font-mono text-xs font-black uppercase tracking-wider text-ink">
                    Verified Debuts &amp; Badges
                  </h4>
                  <p className="text-xs text-ink-muted mt-0.5">
                    Unlock collectable SVG badge crests, climb campus leaderboards, and claim perks.
                  </p>
                </div>
              </div>
            </div>

            {/* Testimonial Quote */}
            <div className="rounded-2xl border-2 border-dashed border-ink/40 dark:border-white/40 bg-paper/70 p-4">
              <div className="flex items-center gap-1 text-saffron mb-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={13} className="fill-saffron text-saffron" />
                ))}
              </div>
              <p className="text-xs italic leading-relaxed text-ink-body">
                “Rangora made festival week effortless. Our robotics symposium filled all 120 seats,
                and attendees loved collecting the custom badge crests!”
              </p>
              <p className="mt-2 text-[11px] font-mono font-bold text-ink-muted">
                — Aakash Sen, Organiser at Kolkata Science &amp; Tech Conclave
              </p>
            </div>
          </section>

          {/* Right Column: Neo-Brutalist Auth Card */}
          <section className="lg:col-span-7">
            <div className="rounded-2xl border-2 border-black dark:border-white bg-card p-6 sm:p-9 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_#fff]">
              {/* Mode Switcher Tabs */}
              <div className="grid grid-cols-2 gap-2 p-1.5 rounded-xl border-2 border-black dark:border-white bg-elevated shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] mb-6">
                <Link
                  to="/auth"
                  search={{ mode: "login" }}
                  className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                    mode === "login"
                      ? "bg-terracotta text-white border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  <Lock size={14} />
                  <span>Sign In</span>
                </Link>
                <Link
                  to="/auth"
                  search={{ mode: "signup" }}
                  className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                    mode === "signup"
                      ? "bg-saffron text-black border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  <Sparkles size={14} />
                  <span>Create Account</span>
                </Link>
              </div>

              {sent ? (
                <div className="py-10 text-center space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full border-2 border-black dark:border-white bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 flex items-center justify-center shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                    <CheckCircle2 size={32} />
                  </div>
                  <h2 className="serif-heading text-3xl font-black">Check Your Inbox</h2>
                  <p className="max-w-md mx-auto text-sm text-ink-body leading-relaxed">
                    We dispatched a secure verification link to{" "}
                    <strong className="font-mono text-terracotta">{form.email}</strong>. Once
                    confirmed, your profile and passport will be ready to explore.
                  </p>
                  <div className="pt-4">
                    <Link
                      to="/auth"
                      search={{ mode: "login" }}
                      className="inline-flex items-center gap-2 rounded-xl border-2 border-black dark:border-white bg-terracotta px-6 py-3 text-xs font-black uppercase tracking-wider text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
                    >
                      <span>Proceed to Sign In</span>
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-5">
                  <div>
                    <span className="font-mono text-xs uppercase font-extrabold text-terracotta">
                      {mode === "login" ? "Account Access" : "Collegiate Onboarding"}
                    </span>
                    <h2 className="serif-heading text-2xl sm:text-3xl font-black mt-1">
                      {adminPending
                        ? "Activate Administrator Access"
                        : mode === "login"
                          ? "Welcome Back to Rangora"
                          : "Choose Your Campus Role"}
                    </h2>
                  </div>

                  {/* Warning / Error notice */}
                  {notice && (
                    <div
                      role="status"
                      className="flex items-start gap-2.5 rounded-xl border-2 border-black bg-destructive/10 p-3.5 text-xs text-destructive font-medium shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                    >
                      <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                      <span>{notice}</span>
                    </div>
                  )}

                  {/* Role Selector Cards when signing up */}
                  {mode === "signup" && !adminPending && (
                    <div className="space-y-2">
                      <p className="text-xs font-black uppercase tracking-wider text-ink-muted">
                        Select Your Account Role
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => update("account_type", "participant")}
                          className={`p-3.5 rounded-xl border-2 border-black dark:border-white text-left transition-all ${
                            form.account_type === "participant"
                              ? "bg-saffron text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_#fff]"
                              : "bg-elevated hover:bg-parchment opacity-80"
                          }`}
                        >
                          <div className="flex items-center gap-2 font-black text-sm">
                            <User size={16} />
                            <span>Participant</span>
                          </div>
                          <p className="mt-1 text-[11px] text-ink-body font-medium leading-normal">
                            Attend events, book passes, earn debut stamps &amp; badges.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => update("account_type", "organizer")}
                          className={`p-3.5 rounded-xl border-2 border-black dark:border-white text-left transition-all ${
                            form.account_type === "organizer"
                              ? "bg-terracotta text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_#fff]"
                              : "bg-elevated hover:bg-parchment opacity-80"
                          }`}
                        >
                          <div className="flex items-center gap-2 font-black text-sm">
                            <Building size={16} />
                            <span>Campus Organiser</span>
                          </div>
                          <p className="mt-1 text-[11px] text-white/90 font-medium leading-normal">
                            Host festivals, manage seats &amp; verify attendee passes.
                          </p>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Common Name field for signup */}
                  {mode === "signup" && (
                    <label className="grid gap-1.5 text-xs font-black uppercase tracking-wider text-ink-muted">
                      Full Legal / Campus Name
                      <div className="relative">
                        <User
                          size={16}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
                        />
                        <Input
                          type="text"
                          required
                          value={form.full_name}
                          onChange={field("full_name")}
                          placeholder="e.g. Maya Sen"
                          className="pl-9 rounded-xl border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] h-11"
                        />
                      </div>
                    </label>
                  )}

                  {/* Email Input */}
                  <label className="grid gap-1.5 text-xs font-black uppercase tracking-wider text-ink-muted">
                    {form.account_type === "organizer" && mode === "signup"
                      ? "Institutional Email (.edu / .ac)"
                      : "Email Address"}
                    <div className="relative">
                      <Mail
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
                      />
                      <Input
                        type="email"
                        required
                        value={form.email}
                        onChange={field("email")}
                        placeholder={
                          form.account_type === "organizer" && mode === "signup"
                            ? "organiser@jadavpuruniversity.in"
                            : "student@campus.edu"
                        }
                        className="pl-9 rounded-xl border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] h-11"
                      />
                    </div>
                  </label>

                  {/* Password Input with Show/Hide Toggle */}
                  <label className="grid gap-1.5 text-xs font-black uppercase tracking-wider text-ink-muted">
                    Password (8+ characters)
                    <div className="relative">
                      <Lock
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
                      />
                      <Input
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={8}
                        value={form.password}
                        onChange={field("password")}
                        placeholder="••••••••••••"
                        className="pl-9 pr-10 rounded-xl border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] h-11"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </label>

                  {/* Participant Additional Details */}
                  {mode === "signup" &&
                    !adminPending &&
                    form.account_type === "participant" && (
                      <div className="space-y-4 pt-1">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <label className="grid gap-1.5 text-xs font-black uppercase tracking-wider text-ink-muted">
                            Phone Number
                            <Input
                              type="tel"
                              required
                              value={form.phone}
                              onChange={field("phone")}
                              placeholder="+91 98300 12345"
                              className="rounded-xl border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] h-11"
                            />
                          </label>

                          <label className="grid gap-1.5 text-xs font-black uppercase tracking-wider text-ink-muted">
                            Department
                            <Input
                              type="text"
                              required
                              value={form.department}
                              onChange={field("department")}
                              placeholder="e.g. Computer Science"
                              className="rounded-xl border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] h-11"
                            />
                          </label>

                          <label className="grid gap-1.5 text-xs font-black uppercase tracking-wider text-ink-muted">
                            Degree / Course
                            <Input
                              type="text"
                              required
                              value={form.course}
                              onChange={field("course")}
                              placeholder="e.g. B.Tech 3rd Year"
                              className="rounded-xl border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] h-11"
                            />
                          </label>

                          <label className="grid gap-1.5 text-xs font-black uppercase tracking-wider text-ink-muted">
                            Campus Address / Hostel
                            <Input
                              type="text"
                              required
                              value={form.address}
                              onChange={field("address")}
                              placeholder="e.g. Hall 4, Room 210"
                              className="rounded-xl border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] h-11"
                            />
                          </label>
                        </div>

                        <label className="grid gap-2 text-xs font-black uppercase tracking-wider text-ink-muted">
                          Festival &amp; Cultural Interests
                          <PreferencePicker
                            value={form.preferences}
                            onChange={(preferences) =>
                              setForm((old) => ({ ...old, preferences }))
                            }
                          />
                        </label>
                      </div>
                    )}

                  {/* Organiser Additional Details */}
                  {mode === "signup" &&
                    !adminPending &&
                    form.account_type === "organizer" && (
                      <div className="space-y-4 pt-1">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <label className="grid gap-1.5 text-xs font-black uppercase tracking-wider text-ink-muted">
                            Institution / College
                            <Input
                              type="text"
                              required
                              value={form.org_name}
                              onChange={field("org_name")}
                              placeholder="e.g. Jadavpur University"
                              className="rounded-xl border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] h-11"
                            />
                          </label>

                          <label className="grid gap-1.5 text-xs font-black uppercase tracking-wider text-ink-muted">
                            Your Role / Title
                            <Input
                              type="text"
                              required
                              value={form.position}
                              onChange={field("position")}
                              placeholder="e.g. Cultural Convenor"
                              className="rounded-xl border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] h-11"
                            />
                          </label>

                          <label className="grid gap-1.5 text-xs font-black uppercase tracking-wider text-ink-muted">
                            Organisation Type
                            <Input
                              type="text"
                              required
                              value={form.org_type}
                              onChange={field("org_type")}
                              placeholder="e.g. Student Union / Club"
                              className="rounded-xl border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] h-11"
                            />
                          </label>

                          <label className="grid gap-1.5 text-xs font-black uppercase tracking-wider text-ink-muted">
                            Institutional ID Number
                            <Input
                              type="text"
                              required
                              value={form.institutional_id}
                              onChange={field("institutional_id")}
                              placeholder="e.g. JU-ORG-2026"
                              className="rounded-xl border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] h-11"
                            />
                          </label>
                        </div>

                        <label className="grid gap-1.5 text-xs font-black uppercase tracking-wider text-ink-muted">
                          Why You Want to Host &amp; Organise
                          <textarea
                            required
                            minLength={10}
                            maxLength={1200}
                            value={form.org_description}
                            onChange={field("org_description")}
                            placeholder="Detail the campus festival or events your team intends to host on Rangora..."
                            className="min-h-24 rounded-xl border-2 border-black dark:border-white bg-elevated p-3 text-sm normal-case shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                          />
                        </label>
                        <p className="text-[11px] text-ink-muted">
                          Notice: Organiser permissions remain pending until verified by campus
                          administrators.
                        </p>
                      </div>
                    )}

                  {/* Private Admin Activation Code */}
                  {adminPending && (
                    <label className="grid gap-1.5 text-xs font-black uppercase tracking-wider text-ink-muted">
                      Private Administrator Invite Code
                      <div className="relative">
                        <ShieldCheck
                          size={16}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-terracotta"
                        />
                        <Input
                          type="password"
                          required
                          value={form.invite}
                          onChange={field("invite")}
                          placeholder="Enter invite code..."
                          className="pl-9 rounded-xl border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] h-11 font-mono"
                        />
                      </div>
                    </label>
                  )}

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    disabled={busy}
                    className="w-full h-12 text-sm font-black uppercase tracking-wider border-2 border-black dark:border-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_#fff] hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center justify-center gap-2"
                  >
                    {busy ? (
                      <span>Validating Credentials…</span>
                    ) : adminPending ? (
                      <>
                        <ShieldCheck size={16} />
                        <span>Verify Administrator Access</span>
                      </>
                    ) : mode === "login" ? (
                      <>
                        <Lock size={16} />
                        <span>Sign Into Rangora →</span>
                      </>
                    ) : form.account_type === "organizer" ? (
                      <>
                        <Building size={16} />
                        <span>Submit Organiser Application →</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        <span>Create Participant Account →</span>
                      </>
                    )}
                  </Button>
                </form>
              )}
            </div>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
