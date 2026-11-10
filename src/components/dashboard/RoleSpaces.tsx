import { useState, useMemo, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCircle2,
  ShieldCheck,
  Ticket,
  AlertTriangle,
  Sparkles,
  Edit3,
  Save,
  X,
  Palette,
  Award,
  HelpCircle,
  Clock,
  Trophy,
  Flame,
  Zap,
  Lock,
  Unlock,
  Calendar,
  MapPin,
  Users,
  QrCode,
  Scan,
  Tag,
  Gift,
  Compass,
  Flag,
  MessageSquare,
  Star,
  Camera,
  Check,
  ExternalLink,
  Eye,
  Plus,
  Search,
  Activity,
  User,
  TrendingUp,
  Building,
  Heart,
} from "lucide-react";
import { Leaderboard } from "@/components/dashboard/Leaderboard";
import { EventCard } from "@/components/EventCard";
import { PreferencePicker } from "@/components/PreferencePicker";
import { BadgeSvg } from "@/components/BadgeSvg";
import {
  BADGE_SHAPES,
  BADGE_TEMPLATES,
  BADGE_COLORS,
  BADGE_ICONS,
  serializeBadgeDesign,
  type BadgeShape,
  type BadgeTemplate,
} from "@/lib/badge-designer";
import { checkEventConflicts, findAllCatalogueClashes } from "@/lib/event-conflicts";
import { useCatalogEvents } from "@/lib/use-catalog";
import { VoucherSvgTicket } from "@/components/VoucherSvgTicket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { categories, festivals, voucherCampaigns, achievements } from "@/data/catalog";
import { fmtWhen } from "@/lib/catalog-helpers";
import { canSubmitEventReview } from "@/lib/role-rules";
import type { Database, Json } from "@/integrations/supabase/types";

export type EventEchoEntry = {
  id: string;
  event_id: number;
  author_name: string;
  rating: number;
  comment: string;
  media: Json;
  tagged_friends: string[];
  liked_by_organiser: boolean;
  visibility?: "private" | "campus" | "public";
  moderation_status?: "approved" | "flagged" | "hidden";
  created_at: string;
};

export type EventFormState = {
  name: string;
  subtitle: string;
  description: string;
  venue: string;
  start_at: string;
  end_at: string;
  price: string;
  max_seats: string;
  category_id: string;
  festival_id: string;
  poster: string;
  artists: string;
  terms: string;
};

export const blankEvent: EventFormState = {
  name: "",
  subtitle: "",
  description: "",
  venue: "",
  start_at: "",
  end_at: "",
  price: "0",
  max_seats: "30",
  category_id: "1",
  festival_id: "1",
  poster: "hero_festival.jpg",
  artists: "",
  terms: "",
};

function getMetricMeta(label: string) {
  const l = label.toLowerCase();
  if (l.includes("clash") || l.includes("conflict")) {
    return { icon: AlertTriangle, color: "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200" };
  }
  if (l.includes("pass") || l.includes("booking") || l.includes("ticket")) {
    return { icon: Ticket, color: "bg-saffron text-black" };
  }
  if (l.includes("event") || l.includes("managed") || l.includes("published")) {
    return { icon: Calendar, color: "bg-terracotta text-white" };
  }
  if (l.includes("participant") || l.includes("attendee") || l.includes("user")) {
    return { icon: Users, color: "bg-sage text-white" };
  }
  if (l.includes("organiser") || l.includes("application")) {
    return { icon: ShieldCheck, color: "bg-sage text-white" };
  }
  if (l.includes("echo") || l.includes("review") || l.includes("response")) {
    return { icon: MessageSquare, color: "bg-saffron text-black" };
  }
  if (l.includes("star") || l.includes("rating")) {
    return { icon: Star, color: "bg-amber-300 text-black" };
  }
  if (l.includes("festival")) {
    return { icon: Flag, color: "bg-terracotta text-white" };
  }
  if (l.includes("pulse") || l.includes("seat")) {
    return { icon: Activity, color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200" };
  }
  return { icon: Sparkles, color: "bg-elevated text-foreground" };
}

export function SectionTitle({ title, badge }: { title: string; badge?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <h2 className="serif-heading text-2xl font-bold tracking-tight text-ink dark:text-white">{title}</h2>
      {badge && (
        <span className="inline-block px-2.5 py-0.5 -rotate-1 font-mono text-[10px] font-black uppercase bg-saffron text-black rounded border-2 border-black dark:border-white shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]">
          {badge}
        </span>
      )}
    </div>
  );
}

export function Metric({ label, value }: { label: string; value: string | number }) {
  const meta = getMetricMeta(label);
  const Icon = meta.icon;
  return (
    <div className="rounded-2xl border-2 border-black dark:border-white bg-card p-4 sm:p-5 shadow-[3.5px_3.5px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3.5px_3.5px_0px_0px_#fff] flex items-center justify-between gap-3 transition-transform hover:-translate-y-0.5">
      <div className="min-w-0">
        <p className="font-mono text-[10px] uppercase font-black tracking-wider text-ink-muted truncate">{label}</p>
        <p className="serif-heading mt-1 text-2xl sm:text-3xl font-extrabold text-ink dark:text-white truncate">{value}</p>
      </div>
      <div className={`p-3 rounded-full border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] shrink-0 ${meta.color}`}>
        <Icon size={20} />
      </div>
    </div>
  );
}

export function EmptyState({ children, icon: IconComponent = Compass }: { children: string; icon?: React.ComponentType<{ size?: number; className?: string }> }) {
  return (
    <div className="text-center py-10 px-4 rounded-2xl border-2 border-dashed border-line bg-card/40 my-3">
      <div className="w-12 h-12 mx-auto rounded-full border-2 border-black dark:border-white bg-elevated text-ink-muted flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] mb-3">
        <IconComponent size={22} />
      </div>
      <p className="text-xs sm:text-sm font-medium text-ink-muted max-w-md mx-auto">{children}</p>
    </div>
  );
}

export function MyEchoMedia({ media }: { media: Json }) {
  if (!Array.isArray(media)) return null;
  const files = media.flatMap((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) return [];
    const path = (item as Record<string, unknown>)["path"];
    const name = (item as Record<string, unknown>)["name"];
    const type = (item as Record<string, unknown>)["type"];
    return typeof path === "string" && typeof name === "string" && typeof type === "string"
      ? [{ path, name, type }]
      : [];
  });
  return files.length ? (
    <div className="mt-3 flex flex-wrap gap-3">
      {files.map((file) => (
        <MyEchoMediaItem key={file.path} file={file} />
      ))}
    </div>
  ) : null;
}

export function MyEchoMediaItem({ file }: { file: { path: string; name: string; type: string } }) {
  const [url] = useState(() => {
    if (file.path.startsWith("http://") || file.path.startsWith("https://") || file.path.startsWith("/")) {
      return file.path;
    }
    return `/assets/rangora/${file.name}`;
  });

  return file.type.startsWith("video/") ? (
    <video src={url} controls className="max-h-64 w-full max-w-sm rounded-md" aria-label={file.name} />
  ) : (
    <img src={url} alt={file.name} loading="lazy" className="h-36 max-w-64 rounded-md object-cover border border-line" />
  );
}

export function EventForm({
  form,
  setForm,
  submit,
  busy,
  existingEvents,
  currentOrganiserId,
}: {
  form: EventFormState;
  setForm: (value: EventFormState) => void;
  submit: (published: boolean) => void;
  busy: boolean;
  existingEvents?: Array<{
    id: number;
    name: string;
    venue: string;
    startAt: string;
    endAt: string;
    organiserId?: string | null;
  }>;
  currentOrganiserId?: string;
}) {
  const update = (key: keyof EventFormState, value: string) => setForm({ ...form, [key]: value });

  // Live two-level conflict detection
  const conflict = useMemo(() => {
    if (!existingEvents || !form.start_at || !form.end_at || !form.venue) return null;
    return checkEventConflicts(
      existingEvents.map((e) => ({
        id: e.id,
        name: e.name,
        venue: e.venue,
        startAt: e.startAt,
        endAt: e.endAt,
        organiserId: e.organiserId ?? null,
      })),
      {
        name: form.name || "New Event",
        venue: form.venue,
        startAt: form.start_at,
        endAt: form.end_at,
        organiserId: currentOrganiserId ?? null,
      }
    );
  }, [existingEvents, form.start_at, form.end_at, form.venue, form.name, currentOrganiserId]);

  return (
    <section className="brutal-card p-5">
      <SectionTitle title="Event details" />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit(false);
        }}
        className="mt-4 grid gap-3 sm:grid-cols-2"
      >
        <Input required placeholder="Event name" value={form.name} onChange={(event) => update("name", event.target.value)} />
        <Input required placeholder="Short subtitle" value={form.subtitle} onChange={(event) => update("subtitle", event.target.value)} />
        <Input required placeholder="Venue" value={form.venue} onChange={(event) => update("venue", event.target.value)} />
        <select value={form.category_id} onChange={(event) => update("category_id", event.target.value)} className="h-10 rounded-md border border-input bg-elevated px-3 text-sm">
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select value={form.festival_id} onChange={(event) => update("festival_id", event.target.value)} className="h-10 rounded-md border border-input bg-elevated px-3 text-sm">
          {festivals.map((festival) => (
            <option key={festival.id} value={festival.id}>
              {festival.name}
            </option>
          ))}
        </select>
        <Input type="datetime-local" required aria-label="Event starts" value={form.start_at} onChange={(event) => update("start_at", event.target.value)} />
        <Input type="datetime-local" required aria-label="Event ends" value={form.end_at} onChange={(event) => update("end_at", event.target.value)} />
        <Input type="number" required min="0" placeholder="Price (₹)" value={form.price} onChange={(event) => update("price", event.target.value)} />
        <Input type="number" required min="1" max="10000" placeholder="Seat capacity" value={form.max_seats} onChange={(event) => update("max_seats", event.target.value)} />
        <Textarea required className="sm:col-span-2" placeholder="Full event description" value={form.description} onChange={(event) => update("description", event.target.value)} />
        <div className="sm:col-span-2 space-y-1">
          <label className="text-xs font-bold uppercase tracking-wider text-ink-muted">
            Invited Artists, Guests &amp; Speakers (BookMyShow Style Avatars)
          </label>
          <Textarea
            className="w-full"
            rows={3}
            placeholder={`One guest per line. Examples:\nDr. Radhakrishnan (Guest Professor)\nArijit Singh (Headliner Singer) | https://example.com/arijit.jpg\nPt. Hariprasad Chaurasia (Master Flutist)`}
            value={form.artists}
            onChange={(event) => update("artists", event.target.value)}
          />
          <p className="text-[11px] text-ink-muted">
            Format: <span className="font-mono text-terracotta font-semibold">Name (Role) | PhotoURL</span>. Guests without a photo will automatically display the clean silhouette avatar.
          </p>
        </div>
        <Textarea className="sm:col-span-2" placeholder="Terms and conditions (optional)" value={form.terms} onChange={(event) => update("terms", event.target.value)} />

        {conflict && conflict.hasConflict && (
          <div className="sm:col-span-2 rounded-md border border-destructive/60 bg-destructive/10 p-3 text-xs text-destructive">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertTriangle size={15} />
              <span>
                {conflict.type === "organiser"
                  ? "Level 1: Organiser Schedule Conflict"
                  : "Level 2: Venue Booking Conflict"}
              </span>
            </div>
            <p className="mt-1">{conflict.reason}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button type="submit" disabled={busy || Boolean(conflict?.hasConflict)}>
            Save as draft
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy || Boolean(conflict?.hasConflict)}
            onClick={() => submit(true)}
          >
            Publish event
          </Button>
        </div>
        <p className="text-xs text-ink-muted sm:col-span-2">
          Published events appear in discovery. Your times cannot overlap another event you manage (Level 1) or another booking at the same venue (Level 2).
        </p>
      </form>
    </section>
  );
}

export function ParticipantSpace({
  userId,
  profile,
  events,
  counts,
  registrations,
  rewards,
  echoes,
  bookings,
  isDemo,
  onCancelPass,
  onSaveProfile,
  onSubmitReview,
  onHelpRequest,
  onRedeemVoucher,
  onClaimVoucher,
}: {
  userId: string;
  profile: {
    full_name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    preferences: string[];
    department: string | null;
    course: string | null;
  };
  events: Array<{
    id: number;
    festivalId: number;
    categoryId: number;
    venue: string;
    name: string;
    subtitle: string;
    description: string;
    startAt: string;
    endAt: string;
    price: number;
    maxSeats: number;
    featured: boolean;
    poster: string;
    published?: boolean;
  }>;
  counts: Record<number, number>;
  registrations: Array<{ id: string; event_id: number; kind: string; pass_code: string; verified?: boolean }>;
  rewards: { badges: Array<{ code: string; earned_at: string }>; vouchers: Array<{ id: string; campaign_id: number; code: string }> } | undefined;
  echoes: EventEchoEntry[];
  bookings: {
    isPending: boolean;
    mutate: (vars: { eventId: number; kind: "booked" | "planned" }) => void;
  };
  isDemo?: boolean;
  onCancelPass?: (id: string) => Promise<void>;
  onSaveProfile?: (profileData: {
    full_name?: string;
    department?: string;
    course?: string;
    phone?: string;
    address?: string;
    preferences?: string[];
  } | string[]) => Promise<void>;
  onSubmitReview?: (data: {
    eventId: number;
    rating: number;
    comment: string;
    taggedFriends: string[];
    media: Array<{ path: string; name: string; type: string }>;
    visibility?: "private" | "campus" | "public";
  }) => Promise<void>;
  onHelpRequest?: (data: { category: string; eventId?: number | null; subject: string; message: string }) => Promise<void>;
  onRedeemVoucher?: (voucherId: string) => Promise<void>;
  onClaimVoucher?: (campaignId: number) => Promise<void>;
}) {
  const [tab, setTab] = useState("passes");
  const [prefs, setPrefs] = useState(profile.preferences);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [fullName, setFullName] = useState(profile.full_name || "");
  const [phone, setPhone] = useState(profile.phone || "");
  const [address, setAddress] = useState(profile.address || "");
  const [department, setDepartment] = useState(profile.department || "");
  const [course, setCourse] = useState(profile.course || "");
  const [reviewMedia, setReviewMedia] = useState<File[]>([]);
  const [reviewVisibility, setReviewVisibility] = useState<"private" | "campus" | "public">("private");
  const [publicConsent, setPublicConsent] = useState(false);
  const [reviewForm, setReviewForm] = useState({ event_id: "", rating: "5", comment: "", tagged_friends: "" });
  const [helpForm, setHelpForm] = useState({ category: "other", event_id: "", subject: "", message: "" });
  const queryClient = useQueryClient();

  const reviewEvents = events.filter((event) => {
    const reg = registrations.find((r) => r.event_id === event.id && r.kind === "booked");
    const isEnded = new Date(event.endAt).getTime() < Date.now() || event.id === 4; // Event #4 is seeded as finished for demonstration
    const isVerified = Boolean(reg?.verified);
    return canSubmitEventReview(Boolean(reg), isEnded, isVerified);
  });

  // Participant Clash Guardian: find any pairs of booked events that overlap in time
  const participantClashes = useMemo(() => {
    const bookedRegs = registrations.filter((r) => r.kind === "booked");
    const bookedWithEvents = bookedRegs
      .map((r) => {
        const ev = events.find((e) => e.id === r.event_id);
        return ev ? { reg: r, event: ev } : null;
      })
      .filter((item): item is { reg: (typeof registrations)[0]; event: (typeof events)[0] } => Boolean(item));

    const conflicts: Array<{
      regA: (typeof registrations)[0];
      eventA: (typeof events)[0];
      regB: (typeof registrations)[0];
      eventB: (typeof events)[0];
      timeRange: string;
    }> = [];

    for (let i = 0; i < bookedWithEvents.length; i++) {
      const a = bookedWithEvents[i];
      if (!a) continue;
      const aStart = new Date(a.event.startAt).getTime();
      const aEnd = new Date(a.event.endAt).getTime();
      if (isNaN(aStart) || isNaN(aEnd)) continue;

      for (let j = i + 1; j < bookedWithEvents.length; j++) {
        const b = bookedWithEvents[j];
        if (!b) continue;
        const bStart = new Date(b.event.startAt).getTime();
        const bEnd = new Date(b.event.endAt).getTime();
        if (isNaN(bStart) || isNaN(bEnd)) continue;

        if (aStart < bEnd && aEnd > bStart) {
          const overlapStart = Math.max(aStart, bStart);
          const timeStr = `${new Date(overlapStart).toLocaleDateString([], {
            month: "short",
            day: "numeric",
          })} ${new Date(overlapStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

          conflicts.push({
            regA: a.reg,
            eventA: a.event,
            regB: b.reg,
            eventB: b.event,
            timeRange: timeStr,
          });
        }
      }
    }
    return conflicts;
  }, [registrations, events]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      const payload = {
        full_name: fullName.trim(),
        department: department.trim(),
        course: course.trim(),
        phone: phone.trim(),
        address: address.trim(),
        preferences: prefs,
      };
      if (onSaveProfile) {
        await onSaveProfile(payload);
        return;
      }
      const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Profile saved successfully.");
      setIsEditingProfile(false);
      await queryClient.invalidateQueries();
    },
    onError: (err: Error) => toast.error(err.message || "Could not save your profile."),
  });

  const submitReview = useMutation({
    mutationFn: async () => {
      const eventId = Number(reviewForm.event_id);
      if (!reviewEvents.some((event) => event.id === eventId)) {
        throw new Error("Feedback opens after a booked event finishes.");
      }
      const taggedFriends = [...new Set(reviewForm.tagged_friends.split(",").map((f) => f.trim()).filter(Boolean))].slice(0, 20);

      const mediaItems: Array<{ path: string; name: string; type: string }> = [];
      for (const file of reviewMedia) {
        mediaItems.push({
          path: `${eventId}/${userId}/${file.name}`,
          name: file.name,
          type: file.type,
        });
      }

      if (onSubmitReview) {
        await onSubmitReview({
          eventId,
          rating: Number(reviewForm.rating),
          comment: reviewForm.comment.trim(),
          taggedFriends,
          media: mediaItems,
          visibility: reviewVisibility,
        });
        return;
      }

      const { error } = await supabase.from("reviews").insert({
        event_id: eventId,
        user_id: userId,
        rating: Number(reviewForm.rating),
        comment: reviewForm.comment.trim(),
        media: mediaItems,
        tagged_friends: taggedFriends,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Your Event Echo is live.");
      setReviewForm({ event_id: "", rating: "5", comment: "", tagged_friends: "" });
      setReviewMedia([]);
      await queryClient.invalidateQueries();
    },
    onError: (error: Error) => toast.error(error.message || "Could not share your review."),
  });

  const cancelPass = useMutation({
    mutationFn: async (id: string) => {
      if (onCancelPass) {
        await onCancelPass(id);
        return;
      }
      const { error } = await supabase.from("registrations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Registration removed.");
      await queryClient.invalidateQueries();
    },
    onError: () => toast.error("Could not remove that pass."),
  });

  const helpRequest = useMutation({
    mutationFn: async () => {
      if (helpForm.subject.trim().length < 3 || helpForm.subject.length > 150 || helpForm.message.trim().length < 5 || helpForm.message.length > 2000) {
        throw new Error("Add a subject and a message between 5 and 2,000 characters.");
      }
      if (onHelpRequest) {
        await onHelpRequest({
          category: helpForm.category,
          eventId: helpForm.event_id ? Number(helpForm.event_id) : null,
          subject: helpForm.subject.trim(),
          message: helpForm.message.trim(),
        });
        return;
      }
      const { error } = await supabase.from("help_requests").insert({
        user_id: userId,
        category: helpForm.category,
        event_id: helpForm.event_id ? Number(helpForm.event_id) : null,
        subject: helpForm.subject.trim(),
        message: helpForm.message.trim(),
        author_name: profile.full_name,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Your help request was sent.");
      setHelpForm({ category: "other", event_id: "", subject: "", message: "" });
      await queryClient.invalidateQueries();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const panels = ["passes", "clashes", "echo", "rewards", "leaderboard", "profile", "help"];

  return (
    <div className="grid gap-7 lg:grid-cols-[230px_1fr]">
      <aside className="brutal-card h-fit p-3">
        <div className="border-b border-line px-3 py-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-terracotta">Participant hub</p>
          <p className="serif-heading mt-1 text-xl">Your passport</p>
        </div>
        <nav aria-label="Participant sections" className="mt-3 grid gap-1.5">
          {panels.map((item) => {
            const Icon =
              item === "passes"
                ? Ticket
                : item === "clashes"
                  ? AlertTriangle
                  : item === "echo"
                    ? Camera
                    : item === "rewards"
                      ? Award
                      : item === "leaderboard"
                        ? Trophy
                        : item === "profile"
                          ? User
                          : HelpCircle;

            const label =
              item === "clashes"
                ? (participantClashes.length > 0 ? `Clashes (${participantClashes.length})` : "Clash Guardian")
                : item === "echo"
                  ? "Event Echo"
                  : item === "rewards"
                    ? "Badges & Perks"
                    : item === "profile"
                      ? "My Passport"
                      : item === "passes"
                        ? "My Passes"
                        : item;

            return (
              <Button
                key={item}
                variant={tab === item ? "default" : "ghost"}
                className={`justify-start gap-2.5 font-bold capitalize transition-all ${
                  tab === item
                    ? "border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#fff]"
                    : "hover:bg-elevated"
                }`}
                onClick={() => setTab(item)}
              >
                <Icon size={16} className={tab === item ? "text-primary-foreground" : "text-terracotta"} />
                <span className="truncate">{label}</span>
                {item === "clashes" && participantClashes.length > 0 && (
                  <span className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-200 text-amber-900 text-[10px] font-mono font-black rounded border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                    <AlertTriangle size={10} className="shrink-0" />
                    <span>{participantClashes.length}</span>
                  </span>
                )}
              </Button>
            );
          })}
        </nav>
      </aside>
      <section className="brutal-card min-w-0 p-5 sm:p-7">
        {tab === "passes" && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 bg-saffron-soft/60 border border-saffron/40 rounded-lg p-4 mb-5">
              <div>
                <p className="font-bold text-sm text-ink-body">Explore Live Celebrations</p>
                <p className="text-xs text-ink-muted">
                  Discover curated cultural, technical, and artistic experiences on the festival marquee.
                </p>
              </div>
              <Link
                to="/"
                hash="featured-events-today"
                className="btn btn-outline text-xs inline-flex items-center gap-1.5 border-line bg-elevated hover:bg-terracotta hover:text-ivory"
              >
                <Ticket size={14} /> Browse All Events
              </Link>
            </div>

            {/* Passport Clash Guardian Banner */}
            <div className="mb-6 rounded-2xl border-2 border-black dark:border-white bg-card p-5 sm:p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#fff]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-full border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                    participantClashes.length > 0
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200"
                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200"
                  }`}>
                    {participantClashes.length > 0 ? <AlertTriangle size={24} /> : <CheckCircle2 size={24} />}
                  </div>
                  <div>
                    <span className="font-mono text-[10px] uppercase font-black tracking-widest text-terracotta">
                      Passport Clash Guardian
                    </span>
                    <h3 className="serif-heading text-xl font-bold">
                      {participantClashes.length > 0 ? (
                        <>Schedule <span className="inline-block px-2.5 py-0.5 -rotate-1 bg-terracotta text-white rounded border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">Conflict</span> Detected</>
                      ) : (
                        <>All Passes <span className="inline-block px-2.5 py-0.5 -rotate-1 bg-emerald-600 text-white rounded border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">Harmonized</span></>
                      )}
                    </h3>
                  </div>
                </div>
                <span className={`font-mono text-xs font-bold px-3 py-1.5 rounded-full border-2 border-black dark:border-white self-start sm:self-auto inline-flex items-center gap-1.5 ${
                  participantClashes.length > 0
                    ? "bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200"
                    : "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200"
                }`}>
                  {participantClashes.length > 0 ? (
                    <>
                      <AlertTriangle size={13} className="shrink-0" />
                      <span>{participantClashes.length} Active Booking Clashes</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={13} className="shrink-0 text-emerald-700" />
                      <span>0 Schedule Overlaps</span>
                    </>
                  )}
                </span>
              </div>

              {participantClashes.length > 0 ? (
                <div className="mt-4 space-y-3">
                  <p className="text-xs text-ink-muted">
                    You hold reserved passes for events that take place at the same time. You will need to choose which one to attend in person:
                  </p>
                  {participantClashes.map((clash, idx) => (
                    <div
                      key={`${clash.regA.id}-${clash.regB.id}-${idx}`}
                      className="rounded-xl border-2 border-black dark:border-white bg-elevated p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-bold uppercase tracking-wider bg-terracotta text-white px-2 py-0.5 rounded">
                            Concurrent Pass Overlap
                          </span>
                          <span className="font-mono text-xs text-ink-muted">
                            Time: <strong>{clash.timeRange}</strong>
                          </span>
                        </div>
                        <div className="text-sm">
                          <span className="font-bold text-ink dark:text-white">
                            {clash.eventA.name} <span className="font-mono text-xs text-terracotta">({clash.regA.pass_code})</span>
                          </span>
                          <span className="text-ink-muted mx-2">overlaps with</span>
                          <span className="font-bold text-ink dark:text-white">
                            {clash.eventB.name} <span className="font-mono text-xs text-terracotta">({clash.regB.pass_code})</span>
                          </span>
                        </div>
                        <p className="text-xs text-ink-muted">
                          Venues: {clash.eventA.venue} &amp; {clash.eventB.venue}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to="/events/$eventId"
                          params={{ eventId: String(clash.eventA.id) }}
                          className="btn btn-outline text-xs px-2.5 py-1.5 font-bold"
                        >
                          View {clash.eventA.name.slice(0, 14)}…
                        </Link>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => cancelPass.mutate(clash.regA.id)}
                          className="text-xs text-destructive hover:bg-destructive/10 px-2.5 py-1 font-bold"
                        >
                          Cancel Pass A
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => cancelPass.mutate(clash.regB.id)}
                          className="text-xs text-destructive hover:bg-destructive/10 px-2.5 py-1 font-bold"
                        >
                          Cancel Pass B
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-ink-muted">
                  Your festival itinerary is completely conflict-free. None of your {registrations.filter((r) => r.kind === "booked").length} booked passes overlap in schedule.
                </p>
              )}
            </div>

            <SectionTitle title="My registrations & passes" badge={`${registrations.length} Passes`} />
            <div className="mt-5 grid gap-4">
              {registrations.length ? (
                registrations.map((registration) => {
                  const event = events.find((item) => item.id === registration.event_id);
                  return event ? (
                    <div
                      key={registration.id}
                      className="rounded-2xl border-2 border-black dark:border-white bg-card p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#fff] flex flex-col md:flex-row md:items-center justify-between gap-4 transition-transform hover:-translate-y-0.5"
                    >
                      <div className="space-y-2 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] font-black uppercase bg-saffron text-black px-2.5 py-0.5 -rotate-1 rounded border border-black shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]">
                            <Ticket size={11} /> Festival Pass
                          </span>
                          {registration.verified ? (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-600 text-white px-2.5 py-0.5 font-mono text-[10px] font-black uppercase rotate-1 border border-black shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]">
                              <ShieldCheck size={12} /> Door Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200 px-2.5 py-0.5 font-mono text-[10px] font-bold border border-line">
                              <Clock size={11} /> Admission Reserved
                            </span>
                          )}
                        </div>

                        <Link
                          to="/events/$eventId"
                          params={{ eventId: String(event.id) }}
                          className="serif-heading text-xl font-bold hover:underline block text-ink dark:text-white truncate"
                        >
                          {event.name}
                        </Link>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-ink-muted">
                          <span className="flex items-center gap-1.5 font-medium">
                            <Calendar size={13} className="text-terracotta shrink-0" />
                            {fmtWhen(event.startAt)}
                          </span>
                          <span className="flex items-center gap-1.5 font-medium">
                            <MapPin size={13} className="text-terracotta shrink-0" />
                            {event.venue}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 border-t md:border-t-0 pt-3 md:pt-0 border-line">
                        {registration.kind === "booked" && (
                          <div className="bg-elevated px-3 py-1.5 rounded-lg border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2">
                            <QrCode size={16} className="text-terracotta" />
                            <span className="font-mono text-xs font-black tracking-wider text-ink dark:text-white">
                              {registration.pass_code}
                            </span>
                          </div>
                        )}
                        <Link
                          to="/events/$eventId"
                          params={{ eventId: String(event.id) }}
                          className="btn btn-outline text-xs px-3 py-1.5 font-bold"
                        >
                          View Details
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => cancelPass.mutate(registration.id)}
                          disabled={cancelPass.isPending}
                          className="text-xs text-destructive hover:bg-destructive/10 font-bold"
                        >
                          Release Pass
                        </Button>
                      </div>
                    </div>
                  ) : null;
                })
              ) : (
                <EmptyState icon={Ticket}>
                  Book a pass from the landing marquee to save your place and start your festival passport.
                </EmptyState>
              )}
            </div>
          </>
        )}
        {tab === "clashes" && (
          <section className="space-y-6">
            <div className="rounded-2xl border-2 border-black dark:border-white bg-card p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#fff]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-full border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                    participantClashes.length > 0
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200"
                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200"
                  }`}>
                    {participantClashes.length > 0 ? <AlertTriangle size={24} /> : <CheckCircle2 size={24} />}
                  </div>
                  <div>
                    <span className="font-mono text-[10px] uppercase font-black tracking-widest text-terracotta">
                      Passport Clash Guardian
                    </span>
                    <h3 className="serif-heading text-2xl font-bold">
                      {participantClashes.length > 0 ? (
                        <>Schedule <span className="inline-block px-2.5 py-0.5 -rotate-1 bg-terracotta text-white rounded border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">Conflict</span> Monitor</>
                      ) : (
                        <>All Passes <span className="inline-block px-2.5 py-0.5 -rotate-1 bg-emerald-600 text-white rounded border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">Harmonized</span></>
                      )}
                    </h3>
                  </div>
                </div>
                <span className={`font-mono text-xs font-bold px-3 py-1.5 rounded-full border-2 border-black dark:border-white self-start sm:self-auto inline-flex items-center gap-1.5 ${
                  participantClashes.length > 0
                    ? "bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200"
                    : "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200"
                }`}>
                  {participantClashes.length > 0 ? (
                    <>
                      <AlertTriangle size={13} className="shrink-0" />
                      <span>{participantClashes.length} Active Booking Clashes</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={13} className="shrink-0 text-emerald-700" />
                      <span>0 Schedule Overlaps</span>
                    </>
                  )}
                </span>
              </div>

              {participantClashes.length > 0 ? (
                <div className="mt-6 space-y-4">
                  <p className="text-xs text-ink-muted leading-relaxed">
                    Event Clash Guardian detected concurrent bookings in your itinerary. Because both celebrations take place concurrently, you will need to choose which one to attend in person:
                  </p>
                  {participantClashes.map((clash, idx) => (
                    <div
                      key={`${clash.regA.id}-${clash.regB.id}-${idx}`}
                      className="rounded-xl border-2 border-black dark:border-white bg-elevated p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-bold uppercase tracking-wider bg-terracotta text-white px-2 py-0.5 rounded">
                            Pass Conflict
                          </span>
                          <span className="font-mono text-xs text-ink-muted">
                            Time: <strong>{clash.timeRange}</strong>
                          </span>
                        </div>
                        <div className="text-sm">
                          <span className="font-bold text-ink dark:text-white">
                            {clash.eventA.name} <span className="font-mono text-xs text-terracotta">({clash.regA.pass_code})</span>
                          </span>
                          <span className="text-ink-muted mx-2">overlaps with</span>
                          <span className="font-bold text-ink dark:text-white">
                            {clash.eventB.name} <span className="font-mono text-xs text-terracotta">({clash.regB.pass_code})</span>
                          </span>
                        </div>
                        <p className="text-xs text-ink-muted">
                          Venues: {clash.eventA.venue} &amp; {clash.eventB.venue}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to="/events/$eventId"
                          params={{ eventId: String(clash.eventA.id) }}
                          className="btn btn-outline text-xs px-3 py-1.5 font-bold"
                        >
                          View Pass A
                        </Link>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => cancelPass.mutate(clash.regA.id)}
                          className="text-xs text-destructive hover:bg-destructive/10 px-3 py-1 font-bold"
                        >
                          Release Pass A
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => cancelPass.mutate(clash.regB.id)}
                          className="text-xs text-destructive hover:bg-destructive/10 px-3 py-1 font-bold"
                        >
                          Release Pass B
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-parchment/40 dark:bg-slate-800/40 rounded-xl border border-dashed border-line mt-6">
                  <CheckCircle2 className="mx-auto text-emerald-600 mb-2" size={32} />
                  <h4 className="font-bold text-base">Your Schedule is Conflict-Free</h4>
                  <p className="text-xs text-ink-muted max-w-md mx-auto mt-1">
                    None of your reserved passes have overlapping times. You can attend all your celebrations smoothly.
                  </p>
                </div>
              )}
            </div>
          </section>
        )}
        {tab === "echo" && (
          <>
            <SectionTitle title="Your Event Echoes" />
            <p className="mt-2 text-sm text-ink-body">Your ratings, notes, and shared moments stay visible here.</p>
            <div className="mt-4 grid gap-3">
              {echoes.map((echo) => (
                <article key={echo.id} className="border-b border-line py-3">
                  <Link
                    to="/events/$eventId"
                    params={{ eventId: String(echo.event_id) }}
                    className="font-bold underline"
                  >
                    {events.find((event) => event.id === echo.event_id)?.name ?? `Event ${echo.event_id}`}
                  </Link>
                  <p className="mt-1 text-xs text-ink-muted">
                    {echo.rating}/5 · {new Date(echo.created_at).toLocaleDateString()}
                    {echo.liked_by_organiser ? " · Liked by the organiser" : ""}
                    {echo.visibility ? ` · ${echo.visibility}` : ""}
                  </p>
                  <p className="mt-2 whitespace-pre-line text-sm">{echo.comment}</p>
                  {echo.tagged_friends?.length > 0 && (
                    <p className="mt-2 text-xs text-ink-muted">With {echo.tagged_friends.join(", ")}</p>
                  )}
                  <MyEchoMedia media={echo.media} />
                </article>
              ))}
              {echoes.length === 0 && <EmptyState>You have not shared an Event Echo yet.</EmptyState>}
            </div>
            <h3 className="serif-heading mt-8 text-xl">Share a finished event</h3>
            {reviewEvents.length ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  submitReview.mutate();
                }}
                className="mt-3 grid max-w-2xl gap-4"
              >
                <label className="grid gap-1 text-xs font-bold uppercase text-ink-muted">
                  Finished event
                  <select
                    required
                    value={reviewForm.event_id}
                    onChange={(event) => setReviewForm((old) => ({ ...old, event_id: event.target.value }))}
                    className="h-10 rounded-md border border-input bg-elevated px-3 text-sm normal-case"
                  >
                    <option value="">Choose an event</option>
                    {reviewEvents.map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-xs font-bold uppercase text-ink-muted">
                    Rating
                    <select
                      value={reviewForm.rating}
                      onChange={(event) => setReviewForm((old) => ({ ...old, rating: event.target.value }))}
                      className="h-10 rounded-md border border-input bg-elevated px-3 text-sm normal-case"
                    >
                      {[5, 4, 3, 2, 1].map((rating) => (
                        <option key={rating} value={rating}>
                          {rating} Stars ({rating}/5)
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs font-bold uppercase text-ink-muted">
                    Visibility
                    <select
                      value={reviewVisibility}
                      onChange={(event) => {
                        const val = event.target.value as "private" | "campus" | "public";
                        setReviewVisibility(val);
                        if (val !== "public") setPublicConsent(false);
                      }}
                      className="h-10 rounded-md border border-input bg-elevated px-3 text-sm normal-case"
                    >
                      <option value="private">Private (Default — only you &amp; organizers)</option>
                      <option value="campus">Campus Attendees Only</option>
                      <option value="public">Public (Eligible for Event Pulse Gallery)</option>
                    </select>
                  </label>
                </div>
                {reviewVisibility === "public" && (
                  <div className="rounded-md border border-terracotta/40 bg-saffron-soft p-3 text-xs">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={publicConsent}
                        onChange={(e) => setPublicConsent(e.target.checked)}
                        className="mt-0.5 rounded border-ink text-terracotta focus:ring-terracotta"
                      />
                      <span className="text-ink-body leading-snug">
                        <strong>Explicit Public Consent:</strong> I agree to showcase this review, rating, and any uploaded media publicly on the campus-wide Event Pulse discovery gallery.
                      </span>
                    </label>
                  </div>
                )}
                <label className="grid gap-1 text-xs font-bold uppercase text-ink-muted">
                  Your note
                  <Textarea
                    required
                    maxLength={1500}
                    value={reviewForm.comment}
                    onChange={(event) => setReviewForm((old) => ({ ...old, comment: event.target.value }))}
                    className="normal-case"
                  />
                </label>
                <Input
                  aria-label="Tag friends"
                  maxLength={480}
                  placeholder="Tag friends who joined (names, comma-separated)"
                  value={reviewForm.tagged_friends}
                  onChange={(event) => setReviewForm((old) => ({ ...old, tagged_friends: event.target.value }))}
                />
                <label className="grid gap-1 text-xs font-bold uppercase text-ink-muted">
                  Photos or a short video
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,video/mp4"
                    multiple
                    onChange={(event) => setReviewMedia(Array.from(event.target.files ?? []).slice(0, 4))}
                    className="text-sm normal-case"
                  />
                  <span className="font-normal normal-case">
                    Up to four JPG, PNG, WEBP, or MP4 files. Organisers and attendees can view shared moments.
                  </span>
                </label>
                <Button type="submit" disabled={submitReview.isPending}>
                  {submitReview.isPending ? "Sharing…" : "Share Event Echo"}
                </Button>
              </form>
            ) : (
              <EmptyState>Feedback becomes available after one of your booked events has finished.</EmptyState>
            )}
          </>
        )}
        {tab === "rewards" && (
          <>
            <SectionTitle
              title="Badges, stamps & vouchers"
              badge={`${rewards?.badges.length ?? 0} Earned`}
            />
            <p className="mt-2 text-sm text-ink-body">
              {rewards?.badges.length ?? 0} collectible badges unlocked · {rewards?.vouchers.length ?? 0} concession vouchers active in your festival passport.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {achievements.map((badge) => {
                const earned = rewards?.badges.some((item) => item.code === badge.code);
                return (
                  <div
                    key={badge.code}
                    className={`rounded-2xl border-2 border-black dark:border-white p-5 flex items-start gap-4 transition-all shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_#fff] ${
                      earned ? "bg-card" : "bg-elevated/40 opacity-75"
                    }`}
                  >
                    <div className="p-2 rounded-xl border-2 border-black dark:border-white bg-elevated shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] shrink-0">
                      <BadgeSvg
                        badge={{
                          title: badge.title,
                          description: badge.criteria,
                          emoji: badge.artwork || "✦",
                          points: badge.points,
                        }}
                        className="w-14 h-14"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="inline-block px-2 py-0.5 -rotate-2 font-mono text-[9px] font-black uppercase tracking-wider bg-saffron text-black rounded border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                          {badge.kind}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 font-mono text-[10px] font-black uppercase px-2 py-0.5 rounded border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] ${
                            earned
                              ? "rotate-1 bg-emerald-600 text-white"
                              : "-rotate-1 bg-elevated text-ink-muted"
                          }`}
                        >
                          {earned ? (
                            <>
                              <Sparkles size={10} /> Unlocked
                            </>
                          ) : (
                            <>
                              <Lock size={10} /> Locked
                            </>
                          )}
                        </span>
                      </div>
                      <p className="serif-heading mt-1.5 text-base font-bold leading-snug">{badge.title}</p>
                      <p className="text-xs text-ink-muted mt-1 leading-relaxed">{badge.criteria}</p>
                      <div className="mt-2.5">
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] font-black text-terracotta bg-card px-2 py-0.5 rounded border border-line shadow-sm">
                          <Flame size={12} className="text-terracotta fill-terracotta/30" />
                          +{badge.points} PTS
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <h3 className="serif-heading mt-10 text-2xl font-bold">
              Your <span className="inline-block px-2.5 py-0.5 -rotate-1 bg-saffron text-black rounded border-2 border-black dark:border-white shadow-[2.5px_2.5px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2.5px_2.5px_0px_0px_#fff]">Vouchers</span> &amp; Concessions
            </h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {(rewards?.vouchers ?? []).map((voucher) => {
                const campaign = voucherCampaigns.find((item) => item.id === voucher.campaign_id);
                return (
                  <VoucherSvgTicket
                    key={voucher.id}
                    voucher={voucher}
                    campaign={campaign}
                    onRedeem={onRedeemVoucher ? () => void onRedeemVoucher(voucher.id) : undefined}
                  />
                );
              })}
              {(!rewards?.vouchers || rewards.vouchers.length === 0) && (
                <div className="col-span-full">
                  <EmptyState>No vouchers currently claimed in your festival wallet.</EmptyState>
                </div>
              )}
            </div>

            {onClaimVoucher && (
              <>
                <h4 className="serif-heading mt-8 text-xl font-bold">
                  Available <span className="inline-block px-2 py-0.5 rotate-1 bg-terracotta text-white rounded border border-black shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]">Campus Perks</span>
                </h4>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {voucherCampaigns.map((camp) => {
                    const alreadyHas = rewards?.vouchers.some((v) => v.campaign_id === camp.id);
                    return (
                      <div
                        key={camp.id}
                        className="rounded-xl border-2 border-black dark:border-white bg-card p-4 flex items-center justify-between gap-3 shadow-[2.5px_2.5px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2.5px_2.5px_0px_0px_#fff]"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <Tag size={14} className="text-terracotta shrink-0" />
                            <p className="font-bold text-sm truncate">{camp.title}</p>
                          </div>
                          <p className="text-xs text-ink-muted truncate">{camp.description}</p>
                        </div>
                        <Button
                          size="sm"
                          disabled={alreadyHas}
                          onClick={() => void onClaimVoucher(camp.id)}
                          className={`text-xs font-bold shrink-0 border border-black shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] ${
                            alreadyHas
                              ? "bg-elevated text-ink-muted border-line"
                              : "bg-saffron text-black hover:bg-saffron/90"
                          }`}
                        >
                          {alreadyHas ? "Claimed" : "Claim Perk"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
        {tab === "leaderboard" && (
          <>
            <SectionTitle title="Campus leaderboard" />
            <div className="mt-5">
              <Leaderboard me={userId} isDemo={isDemo} />
            </div>
          </>
        )}
        {tab === "profile" && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SectionTitle title="My profile & interests" />
              <Button
                variant={isEditingProfile ? "outline" : "default"}
                size="sm"
                onClick={() => setIsEditingProfile(!isEditingProfile)}
                className="gap-1.5"
              >
                {isEditingProfile ? (
                  <>
                    <X size={14} /> Cancel Editing
                  </>
                ) : (
                  <>
                    <Edit3 size={14} /> Edit Profile
                  </>
                )}
              </Button>
            </div>

            {isEditingProfile ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveProfile.mutate();
                }}
                className="mt-5 grid gap-4 max-w-2xl"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1 text-xs font-bold uppercase text-ink-muted">
                    Full Name
                    <Input
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Your full name"
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-bold uppercase text-ink-muted">
                    Phone Number
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-bold uppercase text-ink-muted">
                    Department
                    <Input
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="e.g. Visual Arts & Design"
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-bold uppercase text-ink-muted">
                    Course / Year
                    <Input
                      value={course}
                      onChange={(e) => setCourse(e.target.value)}
                      placeholder="e.g. B.Des · Year 2"
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-bold uppercase text-ink-muted sm:col-span-2">
                    Address / Hostel
                    <Input
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="e.g. Ganga Hostel, Room 304, Campus East"
                    />
                  </label>
                </div>

                <div className="mt-2">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-muted">
                    Celebrations you love
                  </p>
                  <PreferencePicker value={prefs} onChange={setPrefs} />
                </div>

                <div className="flex gap-2 mt-4">
                  <Button type="submit" disabled={saveProfile.isPending} className="gap-1.5">
                    <Save size={15} />
                    {saveProfile.isPending ? "Saving Profile…" : "Save Profile"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsEditingProfile(false);
                      setFullName(profile.full_name || "");
                      setPhone(profile.phone || "");
                      setAddress(profile.address || "");
                      setDepartment(profile.department || "");
                      setCourse(profile.course || "");
                      setPrefs(profile.preferences || []);
                    }}
                  >
                    Discard Changes
                  </Button>
                </div>
              </form>
            ) : (
              <>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                  {[
                    ["Full Name", fullName || profile.full_name],
                    ["Email", profile.email],
                    ["Phone", phone || profile.phone],
                    ["Department", department || profile.department],
                    ["Course", course || profile.course],
                    ["Address", address || profile.address],
                  ].map(([label, value]) => (
                    <div key={label} className="border-b border-line pb-2">
                      <dt className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">{label}</dt>
                      <dd className="mt-1 text-sm font-medium">{value || "—"}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-6 max-w-xl">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-muted">
                    Experiences you love
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {prefs.length ? (
                      prefs.map((p) => (
                        <span
                          key={p}
                          className="rounded-full bg-saffron-soft px-3 py-1 font-mono text-xs font-medium text-terracotta border border-saffron/40"
                        >
                          {p}
                        </span>
                      ))
                    ) : (
                      <p className="text-xs text-ink-muted">No preferences selected yet.</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        )}
        {tab === "help" && (
          <>
            <SectionTitle title="Contact the Rangora team" />
            <p className="mt-2 text-sm text-ink-body">
              Event concerns are sent to the event organiser. Badge and voucher questions go to an administrator.
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                helpRequest.mutate();
              }}
              className="mt-5 grid max-w-2xl gap-3"
            >
              <label className="grid gap-1 text-xs font-bold uppercase text-ink-muted">
                Topic
                <select
                  value={helpForm.category}
                  onChange={(event) => setHelpForm({ ...helpForm, category: event.target.value })}
                  className="h-10 rounded-md border border-input bg-elevated px-3 text-sm normal-case"
                >
                  <option value="other">General help</option>
                  <option value="event">An event</option>
                  <option value="badge">A badge</option>
                  <option value="voucher">A voucher</option>
                </select>
              </label>
              {helpForm.category === "event" && (
                <label className="grid gap-1 text-xs font-bold uppercase text-ink-muted">
                  Event
                  <select
                    required
                    value={helpForm.event_id}
                    onChange={(event) => setHelpForm({ ...helpForm, event_id: event.target.value })}
                    className="h-10 rounded-md border border-input bg-elevated px-3 text-sm normal-case"
                  >
                    <option value="">Choose event</option>
                    {events
                      .filter((event) => event.published !== false)
                      .map((event) => (
                        <option key={event.id} value={event.id}>
                          {event.name}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              <Input
                required
                minLength={3}
                maxLength={150}
                placeholder="Subject"
                value={helpForm.subject}
                onChange={(event) => setHelpForm({ ...helpForm, subject: event.target.value })}
              />
              <Textarea
                required
                minLength={5}
                maxLength={2000}
                placeholder="How can we help?"
                value={helpForm.message}
                onChange={(event) => setHelpForm({ ...helpForm, message: event.target.value })}
              />
              <Button type="submit" disabled={helpRequest.isPending}>
                Send help request
              </Button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}

export function OrganizerSpace({
  userId,
  status,
  application,
  events,
  counts,
  responseCounts,
  echoes,
  systemCanManage,
  activeEventCount,
  form,
  setForm,
  createEvent,
  updateEvent,
  badgeForm,
  setBadgeForm,
  makeBadge,
  isDemo,
  helpRequests,
  onVerifyAttendance,
  onToggleEchoLike,
  onReplyToHelp,
  onSaveOrganiserProfile,
  onCreateBadge,
  onRequestSponsor,
}: {
  userId: string;
  status: string;
  application: Database["public"]["Tables"]["organiser_profiles"]["Row"] | null | undefined;
  events: Array<{
    id: number;
    festivalId: number;
    categoryId: number;
    venue: string;
    name: string;
    subtitle: string;
    description: string;
    startAt: string;
    endAt: string;
    price: number;
    maxSeats: number;
    featured: boolean;
    poster: string;
    artists: string[];
    terms: string;
    organiserId: string | null;
    published: boolean;
  }>;
  counts: Record<number, number>;
  responseCounts: Record<number, number>;
  echoes: EventEchoEntry[];
  systemCanManage: boolean;
  activeEventCount: number;
  form: EventFormState;
  setForm: (value: EventFormState) => void;
  createEvent: { isPending: boolean; mutate: (publish: boolean) => void };
  updateEvent: { isPending: boolean; mutate: (vars: { id: number; published: boolean }) => void };
  badgeForm: { event_id: string; title: string; description: string; emoji: string; points: string };
  setBadgeForm: (value: { event_id: string; title: string; description: string; emoji: string; points: string }) => void;
  makeBadge: { isPending: boolean; mutate: () => void };
  isDemo?: boolean;
  helpRequests?: Array<{
    id: string;
    event_id: number | null;
    event_name?: string;
    author_name: string;
    subject: string;
    message: string;
    status: string;
    answer?: string | null;
    created_at?: string;
  }>;
  onVerifyAttendance?: (passCode: string, eventId?: number) => Promise<{ verified?: boolean; passCode?: string; participantName?: string } | void>;
  onToggleEchoLike?: (echoId: string) => Promise<void>;
  onReplyToHelp?: (id: string, answer: string) => Promise<void>;
  onSaveOrganiserProfile?: (data: {
    orgName?: string;
    position?: string;
    orgType?: string;
    description?: string;
    institutionalId?: string;
  }) => Promise<void>;
  onCreateBadge?: (badge: {
    eventId: number;
    title: string;
    description: string;
    points: number;
  }) => Promise<void>;
  onRequestSponsor?: (form: {
    name: string;
    tier: string;
    amount: number;
    contact?: string | undefined;
    message?: string | undefined;
  }) => Promise<void>;
}) {
  const [pane, setPane] = useState("events");
  const [selectedEventId, setSelectedEventId] = useState<string>(() =>
    events[0]?.id ? String(events[0].id) : "1"
  );
  const [verifyCode, setVerifyCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    success: boolean;
    passCode: string;
    participantName?: string;
    message: string;
    badgeAwarded?: boolean;
  } | null>(null);

  // Organiser Profile State
  const [isEditingOrg, setIsEditingOrg] = useState(false);
  const [orgName, setOrgName] = useState(application?.org_name || "");
  const [orgPosition, setOrgPosition] = useState(application?.position || "");
  const [orgType, setOrgType] = useState(application?.org_type || "Club");
  const [orgInstId, setOrgInstId] = useState(application?.institutional_id || "");
  const [orgDesc, setOrgDesc] = useState(application?.description || "");

  // Visual SVG Badge Designer State
  const [badgeEventId, setBadgeEventId] = useState<string>(() =>
    events[0]?.id ? String(events[0].id) : "1"
  );
  const [badgeTitle, setBadgeTitle] = useState("");
  const [badgeDescription, setBadgeDescription] = useState("");
  const [badgePoints, setBadgePoints] = useState("50");
  const [badgeShape, setBadgeShape] = useState<BadgeShape>("shield");
  const [badgeTemplate, setBadgeTemplate] = useState<BadgeTemplate>("crest");
  const [badgePrimaryColor, setBadgePrimaryColor] = useState("#C85A32");
  const [badgeAccentColor, setBadgeAccentColor] = useState("#FBF8EE");
  const [badgeIcon, setBadgeIcon] = useState("sparkles");
  const [creatingBadge, setCreatingBadge] = useState(false);

  const [helpReply, setHelpReply] = useState<Record<string, string>>({});
  const [sponsorForm, setSponsorForm] = useState({ name: "", tier: "Silver", amount: "0", contact: "", message: "" });
  const queryClient = useQueryClient();

  const handleVerifyAttendance = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!verifyCode.trim()) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const eventIdNum = selectedEventId ? Number(selectedEventId) : undefined;
      if (onVerifyAttendance) {
        const res = await onVerifyAttendance(verifyCode.trim(), eventIdNum);
        const pName =
          res && typeof res === "object" && "participantName" in res && res.participantName
            ? res.participantName
            : "Attendee";
        setVerifyResult({
          success: true,
          passCode: verifyCode.trim().toUpperCase(),
          participantName: pName,
          message: `Pass confirmed for ${events.find((e) => e.id === eventIdNum)?.name || "Event"}! Attendance verified on-site.`,
          badgeAwarded: true,
        });
        toast.success(`Pass ${verifyCode.trim().toUpperCase()} verified! Verified debut stamp awarded.`);
      } else {
        setVerifyResult({
          success: true,
          passCode: verifyCode.trim().toUpperCase(),
          participantName: "Attendee",
          message: `Pass verified. Attendance recorded.`,
          badgeAwarded: true,
        });
        toast.success(`Pass ${verifyCode.trim().toUpperCase()} verified.`);
      }
      setVerifyCode("");
      await queryClient.invalidateQueries();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to verify ticket.";
      setVerifyResult({
        success: false,
        passCode: verifyCode.trim().toUpperCase(),
        message: msg,
      });
      toast.error(msg);
    } finally {
      setVerifying(false);
    }
  };

  const saveOrganiserProfile = useMutation({
    mutationFn: async () => {
      const payload = {
        orgName: orgName.trim(),
        position: orgPosition.trim(),
        orgType: orgType.trim(),
        description: orgDesc.trim(),
        institutionalId: orgInstId.trim(),
      };
      if (onSaveOrganiserProfile) {
        await onSaveOrganiserProfile(payload);
        return;
      }
      const { error } = await supabase
        .from("organiser_profiles")
        .update({
          org_name: payload.orgName,
          position: payload.position,
          org_type: payload.orgType,
          description: payload.description,
          institutional_id: payload.institutionalId,
        })
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Organiser profile updated.");
      setIsEditingOrg(false);
      await queryClient.invalidateQueries();
    },
    onError: (err: Error) => toast.error(err.message || "Could not save organiser profile."),
  });

  const handleCreateBadge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!badgeTitle.trim()) {
      toast.error("Please enter a badge title.");
      return;
    }
    setCreatingBadge(true);
    try {
      const serializedDesc = serializeBadgeDesign(badgeDescription, {
        shape: badgeShape,
        template: badgeTemplate,
        primaryColor: badgePrimaryColor,
        accentColor: badgeAccentColor,
        icon: badgeIcon,
      });

      if (onCreateBadge) {
        await onCreateBadge({
          eventId: Number(badgeEventId),
          title: badgeTitle.trim(),
          description: serializedDesc,
          points: Number(badgePoints) || 50,
        });
      } else {
        setBadgeForm({
          event_id: badgeEventId,
          title: badgeTitle.trim(),
          description: serializedDesc,
          emoji: "Badge",
          points: badgePoints,
        });
        makeBadge.mutate();
      }
      toast.success(`Achievement badge "${badgeTitle}" created with custom SVG artwork!`);
      setBadgeTitle("");
      setBadgeDescription("");
      await queryClient.invalidateQueries();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not create badge.");
    } finally {
      setCreatingBadge(false);
    }
  };

  const replyToHelp = useMutation({
    mutationFn: async (id: string) => {
      const answer = helpReply[id]?.trim() ?? "";
      if (answer.length < 2 || answer.length > 2000) throw new Error("Write a response under 2,000 characters.");
      if (onReplyToHelp) {
        await onReplyToHelp(id, answer);
        return;
      }
      const { error } = await supabase.from("help_requests").update({ answer, status: "resolved" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Reply sent to the participant.");
      await queryClient.invalidateQueries();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const requestSponsor = useMutation({
    mutationFn: async () => {
      if (!sponsorForm.name.trim() || sponsorForm.name.trim().length > 120 || Number(sponsorForm.amount) < 0) {
        throw new Error("Enter a sponsor name and valid amount.");
      }
      if (onRequestSponsor) {
        await onRequestSponsor({
          name: sponsorForm.name.trim(),
          tier: sponsorForm.tier,
          amount: Number(sponsorForm.amount),
          contact: sponsorForm.contact.trim() || undefined,
          message: sponsorForm.message.trim() || undefined,
        });
        return;
      }
      const { error } = await supabase.from("sponsors").insert({
        user_id: userId,
        name: sponsorForm.name.trim(),
        tier: sponsorForm.tier,
        amount: Number(sponsorForm.amount),
        contact: sponsorForm.contact.trim() || null,
        message: sponsorForm.message.trim() || null,
        status: "requested",
        requested_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Sponsorship request sent to administrators.");
      setSponsorForm({ name: "", tier: "Silver", amount: "0", contact: "", message: "" });
      await queryClient.invalidateQueries();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!systemCanManage) {
    return (
      <div className="brutal-card max-w-2xl p-7">
        <p className="font-mono text-xs uppercase tracking-widest text-terracotta">Application {status}</p>
        <h2 className="serif-heading mt-2 text-3xl">Your organiser application is under review.</h2>
        <p className="mt-3 text-sm text-ink-body">
          An administrator must approve your institutional details before you can create or publish events. You can still browse all event pages.
        </p>
        <Link to="/" hash="featured-events-today" className="btn btn-outline mt-5 inline-flex">
          Browse events
        </Link>
      </div>
    );
  }

  const { events: allCatalogEvents } = useCatalogEvents();

  const organiserClashes = useMemo(() => {
    const conflicts: Array<{
      myEvent: (typeof events)[0];
      otherEvent: { id: number; name: string; venue: string; startAt: string | Date; endAt: string | Date };
      type: "venue" | "time";
      reason: string;
      timeRange: string;
    }> = [];

    for (const myEv of events) {
      if (myEv.published === false) continue;
      const myStart = new Date(myEv.startAt).getTime();
      const myEnd = new Date(myEv.endAt).getTime();
      if (isNaN(myStart) || isNaN(myEnd)) continue;

      for (const other of allCatalogEvents) {
        if (other.id === myEv.id) continue;
        if (other.published === false) continue;
        const oStart = new Date(other.startAt).getTime();
        const oEnd = new Date(other.endAt).getTime();
        if (isNaN(oStart) || isNaN(oEnd)) continue;

        if (myStart < oEnd && myEnd > oStart) {
          const sameVenue = myEv.venue.trim().toLowerCase() === other.venue.trim().toLowerCase();
          const isOwnOther = events.some((e) => e.id === other.id);

          if (sameVenue) {
            const timeStr = `${new Date(Math.max(myStart, oStart)).toLocaleDateString([], { month: "short", day: "numeric" })} ${new Date(Math.max(myStart, oStart)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
            conflicts.push({
              myEvent: myEv,
              otherEvent: other,
              type: "venue",
              reason: `Venue Conflict: "${other.name}" is occupying "${myEv.venue}" during this time window.`,
              timeRange: timeStr,
            });
          } else if (isOwnOther) {
            const timeStr = `${new Date(Math.max(myStart, oStart)).toLocaleDateString([], { month: "short", day: "numeric" })} ${new Date(Math.max(myStart, oStart)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
            conflicts.push({
              myEvent: myEv,
              otherEvent: other,
              type: "time",
              reason: `Concurrent Slot Conflict: You have two of your managed events running concurrently.`,
              timeRange: timeStr,
            });
          }
        }
      }
    }
    return conflicts;
  }, [events, allCatalogEvents]);

  const menus = ["events", "clashes", "create", "checkin", "badges", "echoes", "sponsors", "help", "profile"];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Managed events", activeEventCount],
          ["Passes booked", events.reduce((sum, event) => sum + (counts[event.id] ?? 0), 0)],
          ["Schedule Clashes", organiserClashes.length],
          ["Seat Pulse", "Live Active"],
        ].map(([label, value]) => (
          <Metric key={label} label={String(label)} value={String(value)} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {menus.map((item) => {
          const Icon =
            item === "events"
              ? Calendar
              : item === "clashes"
                ? AlertTriangle
                : item === "create"
                  ? Plus
                  : item === "checkin"
                    ? Scan
                    : item === "badges"
                      ? Award
                      : item === "echoes"
                        ? MessageSquare
                        : item === "sponsors"
                          ? Building
                          : item === "help"
                            ? HelpCircle
                            : User;

          const label =
            item === "clashes"
              ? (organiserClashes.length > 0 ? `Clashes (${organiserClashes.length})` : "Clash Guardian")
              : item === "create"
                ? "Create Event"
                : item === "checkin"
                  ? "Door Check-In"
                  : item === "badges"
                    ? "Event Badges"
                    : item === "events"
                      ? "My Events"
                      : item === "echoes"
                        ? "Event Echoes"
                        : item === "sponsors"
                          ? "Sponsors"
                          : item === "help"
                            ? "Helpdesk"
                            : "Profile";

          return (
            <Button
              key={item}
              variant={pane === item ? "default" : "outline"}
              onClick={() => setPane(item)}
              className={`capitalize gap-1.5 font-bold transition-all ${
                pane === item
                  ? "border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#fff]"
                  : "border-line hover:border-black dark:hover:border-white"
              }`}
            >
              <Icon size={15} />
              <span>{label}</span>
              {item === "clashes" && organiserClashes.length > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-200 text-amber-900 text-[10px] font-mono font-black rounded border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                  <AlertTriangle size={10} className="shrink-0" />
                  <span>{organiserClashes.length}</span>
                </span>
              )}
            </Button>
          );
        })}
      </div>

      {pane === "events" && (
        <section className="space-y-6">
          {organiserClashes.length > 0 && (
            <div className="rounded-2xl border-2 border-black dark:border-white bg-card p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#fff]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-full border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                    <AlertTriangle size={24} />
                  </div>
                  <div>
                    <span className="font-mono text-[10px] uppercase font-black tracking-widest text-terracotta">
                      Schedule Clashes Detected
                    </span>
                    <h4 className="serif-heading text-lg font-bold">
                      {organiserClashes.length} Active Venue / Slot <span className="inline-block px-2 py-0.5 -rotate-1 bg-terracotta text-white rounded border border-black dark:border-white shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]">Conflicts</span>
                    </h4>
                  </div>
                </div>
                <Button size="sm" onClick={() => setPane("clashes")} className="font-bold shrink-0">
                  Resolve Conflicts →
                </Button>
              </div>
            </div>
          )}

          <div className="rounded-2xl border-2 border-black dark:border-white bg-card p-5 sm:p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#fff]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4 mb-5">
              <SectionTitle title="Your event calendar" badge={`${events.length} Events`} />
              <Button size="sm" onClick={() => setPane("create")} className="gap-1.5 font-bold">
                <Plus size={15} /> Create Celebration
              </Button>
            </div>

            {events.length ? (
              <div className="grid gap-4">
                {events.map((event) => {
                  const bookedSeats = counts[event.id] ?? 0;
                  const seatRatio = Math.min(1, bookedSeats / Math.max(1, event.maxSeats));
                  return (
                    <div
                      key={event.id}
                      className="rounded-xl border-2 border-black dark:border-white bg-elevated/40 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-[2.5px_2.5px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2.5px_2.5px_0px_0px_#fff] transition-transform hover:-translate-y-0.5"
                    >
                      <div className="space-y-2 min-w-[280px]">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded font-mono text-[10px] font-black uppercase border border-black shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] ${
                              event.published
                                ? "bg-emerald-600 text-white -rotate-1"
                                : "bg-saffron text-black rotate-1"
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            {event.published ? "Published & Live" : "Draft Staging"}
                          </span>
                          <span className="font-mono text-xs text-ink-muted">Event #{event.id}</span>
                        </div>

                        <Link
                          to="/events/$eventId"
                          params={{ eventId: String(event.id) }}
                          className="serif-heading text-xl font-bold hover:underline block text-ink dark:text-white"
                        >
                          {event.name}
                        </Link>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-ink-muted">
                          <span className="flex items-center gap-1 font-medium">
                            <Calendar size={13} className="text-terracotta" />
                            {fmtWhen(event.startAt)}
                          </span>
                          <span className="flex items-center gap-1 font-medium">
                            <MapPin size={13} className="text-terracotta" />
                            {event.venue}
                          </span>
                        </div>
                      </div>

                      {/* Capacity Meter */}
                      <div className="w-full lg:w-56 space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-mono font-bold">
                          <span className="text-ink-muted flex items-center gap-1">
                            <Users size={12} className="text-terracotta" /> Capacity
                          </span>
                          <span>
                            {bookedSeats}/{event.maxSeats} passes
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-line overflow-hidden border border-black/20 dark:border-white/20">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-saffron to-terracotta transition-all"
                            style={{ width: `${Math.max(4, seatRatio * 100)}%` }}
                          />
                        </div>
                        <p className="font-mono text-[10px] text-ink-muted">
                          {responseCounts[event.id] ?? 0} community responses
                        </p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-wrap items-center gap-2 border-t lg:border-t-0 pt-3 lg:pt-0 border-line">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateEvent.mutate({ id: event.id, published: !event.published })}
                          className="font-bold text-xs"
                        >
                          {event.published ? "Unpublish" : "Publish"}
                        </Button>
                        <Link
                          to="/events/$eventId"
                          params={{ eventId: String(event.id) }}
                          className="btn btn-outline text-xs px-3 py-1.5 font-bold"
                        >
                          View Details
                        </Link>
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedEventId(String(event.id));
                            setPane("checkin");
                          }}
                          className="text-xs font-bold gap-1 bg-saffron text-black hover:bg-saffron/90 border border-black shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]"
                        >
                          <Scan size={13} /> Check-In
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState icon={Calendar}>No events yet. Create an event to start your festival schedule.</EmptyState>
            )}
          </div>
        </section>
      )}

      {pane === "clashes" && (
        <section className="rounded-2xl border-2 border-black dark:border-white bg-card p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#fff]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-full border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                organiserClashes.length > 0
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200"
                  : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200"
              }`}>
                {organiserClashes.length > 0 ? <AlertTriangle size={24} /> : <CheckCircle2 size={24} />}
              </div>
              <div>
                <span className="font-mono text-[10px] uppercase font-black tracking-widest text-terracotta">
                  Stage &amp; Venue Guardian
                </span>
                <h3 className="serif-heading text-2xl font-bold">
                  {organiserClashes.length > 0 ? (
                    <>Organiser <span className="inline-block px-2.5 py-0.5 -rotate-1 bg-terracotta text-white rounded border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">Conflict</span> Monitor</>
                  ) : (
                    <>All Venues <span className="inline-block px-2.5 py-0.5 -rotate-1 bg-emerald-600 text-white rounded border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">Harmonized</span></>
                  )}
                </h3>
              </div>
            </div>
            <span className={`font-mono text-xs font-bold px-3 py-1.5 rounded-full border-2 border-black dark:border-white self-start sm:self-auto inline-flex items-center gap-1.5 ${
              organiserClashes.length > 0
                ? "bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200"
                : "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200"
            }`}>
              {organiserClashes.length > 0 ? (
                <>
                  <AlertTriangle size={13} className="shrink-0" />
                  <span>{organiserClashes.length} Active Conflicts Detected</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={13} className="shrink-0 text-emerald-700" />
                  <span>0 Venue Overlaps</span>
                </>
              )}
            </span>
          </div>

          <div className="mt-6 space-y-4">
            {organiserClashes.length > 0 ? (
              organiserClashes.map((clash, idx) => (
                <div
                  key={`${clash.myEvent.id}-${clash.otherEvent.id}-${idx}`}
                  className="rounded-xl border-2 border-black dark:border-white bg-elevated p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider bg-terracotta text-white px-2 py-0.5 rounded">
                        {clash.type === "venue" ? "Venue Collision" : "Concurrent Slot"}
                      </span>
                      <span className="font-mono text-xs text-ink-muted">
                        Time: <strong>{clash.timeRange}</strong>
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="font-bold text-ink dark:text-white">{clash.myEvent.name}</span>
                      <span className="text-ink-muted mx-2">overlaps with</span>
                      <span className="font-bold text-ink dark:text-white">{clash.otherEvent.name}</span>
                    </div>
                    <p className="text-xs text-ink-muted">
                      Venue: <strong>{clash.myEvent.venue}</strong> {clash.type === "venue" ? "· Another event occupies this venue simultaneously." : "· Concurrent event slot."}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      to="/events/$eventId"
                      params={{ eventId: String(clash.myEvent.id) }}
                      className="btn btn-outline text-xs px-3 py-1.5 font-bold"
                    >
                      Inspect #{clash.myEvent.id}
                    </Link>
                    <Link
                      to="/events/$eventId"
                      params={{ eventId: String(clash.otherEvent.id) }}
                      className="btn btn-outline text-xs px-3 py-1.5 font-bold"
                    >
                      Inspect #{clash.otherEvent.id}
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 bg-parchment/40 dark:bg-slate-800/40 rounded-xl border border-dashed border-line">
                <CheckCircle2 className="mx-auto text-emerald-600 mb-2" size={32} />
                <h4 className="font-bold text-base">Your Events Are Conflict-Free</h4>
                <p className="text-xs text-ink-muted max-w-md mx-auto mt-1">
                  None of your organized events share the same venue or slot concurrently with other festivals.
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {pane === "checkin" && (
        <section className="rounded-2xl border-2 border-black dark:border-white bg-card p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#fff]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] bg-saffron text-black">
                <Scan size={24} />
              </div>
              <div>
                <span className="font-mono text-[10px] uppercase font-black tracking-widest text-terracotta">
                  Door Verification Terminal
                </span>
                <h3 className="serif-heading text-2xl font-bold">
                  Live Ticket <span className="inline-block px-2.5 py-0.5 -rotate-1 bg-emerald-600 text-white rounded border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">Check-In</span>
                </h3>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 font-mono text-xs font-black uppercase px-3 py-1.5 rounded-full border-2 border-black dark:border-white bg-emerald-100 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200">
              <ShieldCheck size={14} /> Door Scanner Ready
            </span>
          </div>

          <p className="mt-4 text-xs sm:text-sm text-ink-muted leading-relaxed">
            Verify attendee pass codes at the venue door. Verifying check-in checks for valid booking, matches your selected event, blocks duplicate check-ins, writes an atomic attendance record, awards the participant a verified debut stamp (+50 points), and updates the campus leaderboard in real time.
          </p>

          <form onSubmit={handleVerifyAttendance} className="mt-6 grid max-w-xl gap-4">
            <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-muted">
              Select Celebration for Door Admission
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="h-11 rounded-xl border-2 border-black dark:border-white bg-elevated px-3 text-sm font-sans normal-case text-ink dark:text-white font-medium shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    Event #{ev.id}: {ev.name} ({ev.venue})
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-muted">
              Attendee Monospace Pass Code
              <div className="flex gap-2">
                <Input
                  required
                  placeholder="e.g. RNG-DEMO-1043"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  className="h-11 rounded-xl border-2 border-black dark:border-white font-mono uppercase tracking-widest text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                />
                <Button
                  type="submit"
                  disabled={verifying || !verifyCode.trim()}
                  className="h-11 gap-1.5 font-bold shrink-0 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                >
                  <Ticket size={16} />
                  {verifying ? "Verifying…" : "Admit & Stamp Pass"}
                </Button>
              </div>
            </label>

            <div className="flex items-center justify-between gap-2 p-3 rounded-xl border border-line bg-surface/60">
              <span className="text-xs text-ink-muted">Quick Evaluator Demo:</span>
              <button
                type="button"
                onClick={() => setVerifyCode("RNG-DEMO-1043")}
                className="font-mono text-xs font-bold text-terracotta underline hover:text-terracotta/80"
              >
                Insert Maya Sen's Pass (RNG-DEMO-1043)
              </button>
            </div>
          </form>

          {/* Verification Result Banner */}
          {verifyResult && (
            <div className="mt-6 max-w-xl">
              {verifyResult.success ? (
                <div className="rounded-2xl border-2 border-black dark:border-white bg-emerald-50 dark:bg-emerald-950/40 p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#fff]">
                  <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 size={20} />
                    <span className="serif-heading text-lg font-bold">Check-In Confirmed &amp; Stamped</span>
                  </div>
                  <p className="mt-2 text-sm text-ink-body">
                    Pass <strong className="font-mono text-terracotta">{verifyResult.passCode}</strong> for <strong>{verifyResult.participantName}</strong> has been verified.
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">{verifyResult.message}</p>
                  <div className="mt-4 flex items-center gap-2 rounded-xl bg-card p-3 text-xs font-mono border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                    <span>Stamp Awarded: <strong>verified_debut</strong> (+50 Rangora Points). Leaderboard updated!</span>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border-2 border-black dark:border-white bg-destructive/10 p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <div className="flex items-center gap-2 font-bold text-destructive">
                    <AlertTriangle size={20} />
                    <span className="serif-heading text-lg font-bold">Check-In Rejected</span>
                  </div>
                  <p className="mt-2 text-sm text-destructive">{verifyResult.message}</p>
                </div>
              )}
            </div>
          )}
        </section>
      )}
      {pane === "create" && (
        <EventForm
          form={form}
          setForm={setForm}
          submit={(publish) => createEvent.mutate(publish)}
          busy={createEvent.isPending}
          existingEvents={events}
          currentOrganiserId={userId}
        />
      )}
      {pane === "badges" && (
        <section className="brutal-card p-5 sm:p-7">
          <SectionTitle title="Organiser Visual Badge Designer" />
          <p className="mt-2 text-sm text-ink-body">
            Design dynamic SVG collectible badges for your events. Badges are rendered natively in Rangora's visual language with custom shapes, templates, palettes, and icons.
          </p>

          <div className="mt-6 grid gap-8 lg:grid-cols-[280px_1fr]">
            {/* Live Interactive Preview */}
            <div className="flex flex-col items-center justify-center p-6 brutal-card bg-surface border-line">
              <span className="font-mono text-[10px] uppercase tracking-widest text-terracotta mb-4">
                Live SVG Preview
              </span>
              <div className="p-4 bg-elevated rounded-xl border border-line shadow-sm">
                <BadgeSvg
                  badge={{
                    title: badgeTitle || "Festival Achievement",
                    description: badgeDescription,
                    points: Number(badgePoints) || 50,
                  }}
                  designOverride={{
                    shape: badgeShape,
                    template: badgeTemplate,
                    primaryColor: badgePrimaryColor,
                    accentColor: badgeAccentColor,
                    icon: badgeIcon,
                    points: Number(badgePoints) || 50,
                  }}
                  className="w-40 h-40"
                />
              </div>
              <p className="serif-heading text-lg mt-4 text-center font-bold">
                {badgeTitle || "Badge Title"}
              </p>
              <p className="font-mono text-xs font-bold text-terracotta mt-1">
                +{badgePoints || "50"} Rangora Points
              </p>
              <p className="text-xs text-ink-muted text-center mt-2 max-w-[220px]">
                {badgeDescription || "Earned by attending and participating in this celebration."}
              </p>
            </div>

            {/* Designer Controls */}
            <form onSubmit={handleCreateBadge} className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-xs font-bold uppercase text-ink-muted sm:col-span-2">
                  Event
                  <select
                    required
                    value={badgeEventId}
                    onChange={(e) => setBadgeEventId(e.target.value)}
                    className="h-10 rounded-md border border-input bg-elevated px-3 text-sm normal-case"
                  >
                    {events.map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1 text-xs font-bold uppercase text-ink-muted">
                  Badge Title
                  <Input
                    required
                    placeholder="e.g. Master Artisan, Sonic Vanguard"
                    value={badgeTitle}
                    onChange={(e) => setBadgeTitle(e.target.value)}
                  />
                </label>

                <label className="grid gap-1 text-xs font-bold uppercase text-ink-muted">
                  Points Awarded (0-500)
                  <Input
                    type="number"
                    min="0"
                    max="500"
                    value={badgePoints}
                    onChange={(e) => setBadgePoints(e.target.value)}
                  />
                </label>
              </div>

              <label className="grid gap-1 text-xs font-bold uppercase text-ink-muted">
                Description / Criteria
                <Textarea
                  placeholder="What does an attendee accomplish to earn this badge?"
                  value={badgeDescription}
                  onChange={(e) => setBadgeDescription(e.target.value)}
                  className="h-20"
                />
              </label>

              {/* Shape & Template Selectors */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-muted">
                    Badge Shape
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {BADGE_SHAPES.map((s) => (
                      <Button
                        key={s.id}
                        type="button"
                        size="sm"
                        variant={badgeShape === s.id ? "default" : "outline"}
                        onClick={() => setBadgeShape(s.id)}
                        className="text-xs"
                      >
                        {s.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-muted">
                    Style Template
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {BADGE_TEMPLATES.map((t) => (
                      <Button
                        key={t.id}
                        type="button"
                        size="sm"
                        variant={badgeTemplate === t.id ? "default" : "outline"}
                        onClick={() => setBadgeTemplate(t.id)}
                        className="text-xs"
                      >
                        {t.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Color Pickers */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-muted">
                    Primary Palette Color
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {BADGE_COLORS.primary.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setBadgePrimaryColor(c.value)}
                        className={`h-7 px-2.5 rounded-md text-xs font-mono font-bold border transition-all flex items-center gap-1.5 ${
                          badgePrimaryColor === c.value ? "ring-2 ring-ink ring-offset-1" : ""
                        }`}
                        style={{ backgroundColor: c.value, color: c.value === "#FBF8EE" ? "#23211D" : "#FFF" }}
                      >
                        <span className="w-2.5 h-2.5 rounded-full border border-black/20" style={{ backgroundColor: c.value }} />
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-muted">
                    Accent Color
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {BADGE_COLORS.accent.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setBadgeAccentColor(c.value)}
                        className={`h-7 px-2.5 rounded-md text-xs font-mono font-bold border transition-all flex items-center gap-1.5 ${
                          badgeAccentColor === c.value ? "ring-2 ring-ink ring-offset-1" : ""
                        }`}
                        style={{ backgroundColor: c.value, color: c.value === "#FFFBEA" || c.value === "#FBF8EE" ? "#23211D" : "#FFF" }}
                      >
                        <span className="w-2.5 h-2.5 rounded-full border border-black/20" style={{ backgroundColor: c.value }} />
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Icon Selector */}
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-muted">
                  Badge Emblem Icon
                </p>
                <div className="flex flex-wrap gap-2">
                  {BADGE_ICONS.map((ic) => (
                    <Button
                      key={ic.id}
                      type="button"
                      size="sm"
                      variant={badgeIcon === ic.id ? "default" : "outline"}
                      onClick={() => setBadgeIcon(ic.id)}
                      className="text-xs"
                    >
                      {ic.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <Button type="submit" disabled={creatingBadge || !badgeTitle.trim()} className="gap-2">
                  <Award size={16} />
                  {creatingBadge ? "Designing & Publishing Badge…" : "Create & Publish Badge"}
                </Button>
              </div>
            </form>
          </div>
        </section>
      )}
      {pane === "sponsors" && (
        <section className="brutal-card p-5">
          <SectionTitle title="Request event sponsorship" />
          <p className="mt-2 text-sm text-ink-body">Requests await administrator review.</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              requestSponsor.mutate();
            }}
            className="mt-4 grid gap-3 sm:grid-cols-2"
          >
            <Input required maxLength={120} placeholder="Sponsor name" value={sponsorForm.name} onChange={(event) => setSponsorForm({ ...sponsorForm, name: event.target.value })} />
            <select value={sponsorForm.tier} onChange={(event) => setSponsorForm({ ...sponsorForm, tier: event.target.value })} className="h-10 rounded-md border border-input bg-elevated px-3 text-sm">
              <option>Silver</option>
              <option>Gold</option>
              <option>Bronze</option>
            </select>
            <Input type="number" min="0" aria-label="Requested amount" value={sponsorForm.amount} onChange={(event) => setSponsorForm({ ...sponsorForm, amount: event.target.value })} />
            <Input maxLength={180} placeholder="Contact (optional)" value={sponsorForm.contact} onChange={(event) => setSponsorForm({ ...sponsorForm, contact: event.target.value })} />
            <Textarea maxLength={1000} placeholder="Message (optional)" value={sponsorForm.message} onChange={(event) => setSponsorForm({ ...sponsorForm, message: event.target.value })} className="sm:col-span-2" />
            <Button type="submit" disabled={requestSponsor.isPending}>
              Send request
            </Button>
          </form>
        </section>
      )}
      {pane === "echoes" && (
        <section className="brutal-card p-5">
          <SectionTitle title="Event Echo responses" />
          <div className="mt-4 grid gap-4">
            {echoes.length ? (
              echoes.map((echo) => (
                <article key={echo.id} className="border-b border-line pb-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold">
                      {events.find((event) => event.id === echo.event_id)?.name ?? `Event ${echo.event_id}`} · {echo.rating}/5
                    </p>
                    {onToggleEchoLike && (
                      <Button
                        size="sm"
                        variant={echo.liked_by_organiser ? "default" : "outline"}
                        onClick={() => void onToggleEchoLike(echo.id)}
                      >
                        {echo.liked_by_organiser ? "Liked by Event Team" : "Like Echo"}
                      </Button>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    {echo.author_name} · {new Date(echo.created_at).toLocaleDateString()}
                  </p>
                  <p className="mt-2 text-sm text-ink-body">{echo.comment}</p>
                  {echo.tagged_friends?.length > 0 && (
                    <p className="mt-1 text-xs text-ink-muted">With {echo.tagged_friends.join(", ")}</p>
                  )}
                  <MyEchoMedia media={echo.media} />
                </article>
              ))
            ) : (
              <EmptyState>No Event Echo responses have been shared for your events.</EmptyState>
            )}
          </div>
        </section>
      )}
      {pane === "help" && (
        <section className="brutal-card p-5">
          <SectionTitle title="Event Helpdesk" />
          <p className="mt-2 text-sm text-ink-body">
            Participant inquiries routed to your events appear here. Provide direct responses to resolve attendee questions.
          </p>

          <div className="mt-5 grid gap-4">
            {helpRequests && helpRequests.length > 0 ? (
              helpRequests.map((req) => (
                <article key={req.id} className="border border-line rounded-lg p-4 bg-surface">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{req.subject}</span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                          req.status === "resolved" ? "bg-sage-soft text-sage" : "bg-saffron-soft text-terracotta"
                        }`}
                      >
                        {req.status}
                      </span>
                    </div>
                    <span className="text-xs text-ink-muted font-mono">
                      {req.author_name} · {req.created_at ? new Date(req.created_at).toLocaleDateString() : "Recent"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-ink-body">{req.message}</p>

                  {req.status === "resolved" ? (
                    <div className="mt-3 rounded bg-elevated p-3 text-xs border border-line">
                      <p className="font-bold text-ink-muted">Your Answer:</p>
                      <p className="mt-1 text-ink-body">{req.answer}</p>
                    </div>
                  ) : (
                    <div className="mt-3 grid gap-2">
                      <Textarea
                        placeholder="Type reply to attendee…"
                        value={helpReply[req.id] ?? ""}
                        onChange={(e) => setHelpReply({ ...helpReply, [req.id]: e.target.value })}
                        className="text-xs h-20"
                      />
                      <Button
                        size="sm"
                        disabled={replyToHelp.isPending || !helpReply[req.id]?.trim()}
                        onClick={() => replyToHelp.mutate(req.id)}
                        className="self-start text-xs"
                      >
                        {replyToHelp.isPending ? "Sending…" : "Reply & Resolve"}
                      </Button>
                    </div>
                  )}
                </article>
              ))
            ) : (
              <EmptyState>All participant queries for your events are resolved.</EmptyState>
            )}
          </div>
        </section>
      )}
      {pane === "profile" && (
        <section className="brutal-card p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionTitle title="Organiser Profile" />
            <Button
              variant={isEditingOrg ? "outline" : "default"}
              size="sm"
              onClick={() => setIsEditingOrg(!isEditingOrg)}
              className="gap-1.5"
            >
              {isEditingOrg ? (
                <>
                  <X size={14} /> Cancel
                </>
              ) : (
                <>
                  <Edit3 size={14} /> Edit Organiser Details
                </>
              )}
            </Button>
          </div>

          {isEditingOrg ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveOrganiserProfile.mutate();
              }}
              className="mt-5 grid gap-4 max-w-2xl"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1 text-xs font-bold uppercase text-ink-muted">
                  Organisation / Club Name
                  <Input
                    required
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="e.g. Robotics Guild & Innovation Lab"
                  />
                </label>
                <label className="grid gap-1 text-xs font-bold uppercase text-ink-muted">
                  Your Position / Title
                  <Input
                    required
                    value={orgPosition}
                    onChange={(e) => setOrgPosition(e.target.value)}
                    placeholder="e.g. Lead Coordinator"
                  />
                </label>
                <label className="grid gap-1 text-xs font-bold uppercase text-ink-muted">
                  Organisation Type
                  <select
                    value={orgType}
                    onChange={(e) => setOrgType(e.target.value)}
                    className="h-10 rounded-md border border-input bg-elevated px-3 text-sm normal-case"
                  >
                    <option value="Club">Student Club</option>
                    <option value="Department">Academic Department</option>
                    <option value="Society">Cultural Society</option>
                    <option value="Chapter">Technical Chapter</option>
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-bold uppercase text-ink-muted">
                  Institutional ID / Faculty Ref
                  <Input
                    value={orgInstId}
                    onChange={(e) => setOrgInstId(e.target.value)}
                    placeholder="e.g. FAC-ENG-204"
                  />
                </label>
              </div>

              <label className="grid gap-1 text-xs font-bold uppercase text-ink-muted">
                Organisation Description / Charter
                <Textarea
                  value={orgDesc}
                  onChange={(e) => setOrgDesc(e.target.value)}
                  placeholder="Describe your student group, club mission, and event vision."
                  className="h-24"
                />
              </label>

              <div className="flex gap-2 mt-2">
                <Button type="submit" disabled={saveOrganiserProfile.isPending} className="gap-1.5">
                  <Save size={15} />
                  {saveOrganiserProfile.isPending ? "Saving Profile…" : "Save Organiser Profile"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditingOrg(false);
                    setOrgName(application?.org_name || "");
                    setOrgPosition(application?.position || "");
                    setOrgType(application?.org_type || "Club");
                    setOrgInstId(application?.institutional_id || "");
                    setOrgDesc(application?.description || "");
                  }}
                >
                  Discard Changes
                </Button>
              </div>
            </form>
          ) : (
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              {[
                ["Organisation", orgName || application?.org_name],
                ["Your position", orgPosition || application?.position],
                ["Organisation type", orgType || application?.org_type],
                ["Institution ID", orgInstId || application?.institutional_id],
                ["Application status", application?.status || "approved"],
                ["Application note", orgDesc || application?.description],
              ].map(([label, value]) => (
                <div key={label} className="border-b border-line pb-2">
                  <dt className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">{label}</dt>
                  <dd className="mt-1 text-sm font-medium">{value || "—"}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      )}
    </div>
  );
}

export function AdminSpace({
  adminProfile,
  stats,
  events,
  counts,
  responseCounts,
  applications,
  approve,
  ownEvents,
  form,
  setForm,
  createEvent,
  updateEvent,
  festivalForm,
  setFestivalForm,
  createFestival,
  clashes,
  sponsors,
  updateSponsor,
  help,
  answerHelp,
  helpAnswers,
  setHelpAnswers,
  vouchers,
  issuedVouchers,
  echoRecap,
  leaderboard,
  userId,
  onResetWorkspace,
  onIssueVoucher,
  onModerateEcho,
}: {
  adminProfile: { office: string; designation: string; staff_id: string | null; status: string } | null | undefined;
  stats: { events: number; festivals: number; bookings: number; participants: number; organisers: number; reviews: number; average_rating: number | null } | undefined;
  events: Array<{ id: number; name: string; maxSeats: number; published: boolean }>;
  counts: Record<number, number>;
  responseCounts: Record<number, number>;
  applications: Array<{ user_id: string; org_name: string; position: string; org_type: string; institutional_id: string | null; description: string | null; status: string; review_note: string | null }>;
  approve: { isPending: boolean; mutate: (vars: { userId: string; status: "approved" | "rejected" }) => void };
  ownEvents: Array<{ id: number; name: string; maxSeats: number; published: boolean }>;
  form: EventFormState;
  setForm: (value: EventFormState) => void;
  createEvent: { isPending: boolean; mutate: (publish: boolean) => void };
  updateEvent: { isPending: boolean; mutate: (vars: { id: number; published: boolean }) => void };
  festivalForm: { name: string; tagline: string; theme: string; description: string; start_date: string; end_date: string };
  setFestivalForm: (value: { name: string; tagline: string; theme: string; description: string; start_date: string; end_date: string }) => void;
  createFestival: { isPending: boolean; mutate: () => void };
  clashes: Array<{ a_id: number; a_name: string; b_id: number; b_name: string; venue: string }>;
  sponsors: Array<{ id: string; name: string; tier: string; amount: number; status: string }>;
  updateSponsor: { isPending: boolean; mutate: (vars: { id: string; status: "active" | "rejected" }) => void };
  help: Array<{ id: string; author_name: string; subject: string; message: string; status: string; category: string; routed_to: string | null }>;
  answerHelp: (id: string, answer: string) => Promise<void>;
  helpAnswers: Record<string, string>;
  setHelpAnswers: (value: Record<string, string>) => void;
  vouchers: Array<{ id: number; title: string; stock: number }>;
  issuedVouchers: Record<number, number>;
  echoRecap: EventEchoEntry[];
  leaderboard: Array<{ user_id: string; display_name: string; points: number }>;
  userId: string;
  onResetWorkspace?: () => Promise<void>;
  onIssueVoucher?: (campaignId: number) => Promise<void>;
  onModerateEcho?: (echoId: string, status: "approved" | "flagged" | "hidden") => Promise<void>;
}) {
  const [pane, setPane] = useState("overview");
  const [award, setAward] = useState({ user_id: "", title: "", note: "" });
  const [sponsorForm, setSponsorForm] = useState({ name: "", tier: "Gold", amount: "0" });
  const queryClient = useQueryClient();

  const awardTop = useMutation({
    mutationFn: async () => {
      const recipient = award.user_id || leaderboard[0]?.user_id;
      const person = leaderboard.find((row) => row.user_id === recipient);
      if (!recipient || !person || !award.title.trim()) throw new Error("Choose a top participant and enter a reward title.");
      const { error } = await supabase.from("reward_awards").insert({
        user_id: recipient,
        display_name: person.display_name,
        title: award.title.trim(),
        note: award.note.trim(),
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Reward recorded.");
      setAward({ user_id: "", title: "", note: "" });
      await queryClient.invalidateQueries();
    },
    onError: (error: Error) => toast.error(error.message || "Could not record the award."),
  });

  const upsertSponsor = useMutation({
    mutationFn: async () => {
      if (!sponsorForm.name.trim()) throw new Error("Enter a sponsor name.");
      const { error } = await supabase.from("sponsors").insert({
        user_id: userId,
        name: sponsorForm.name.trim(),
        tier: sponsorForm.tier,
        amount: Number(sponsorForm.amount),
        status: "requested",
        requested_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Sponsor saved.");
      setSponsorForm({ name: "", tier: "Gold", amount: "0" });
      await queryClient.invalidateQueries();
    },
    onError: () => toast.error("Could not save this sponsor."),
  });

  const campaignUpdate = useMutation({
    mutationFn: async ({ id, stock }: { id: number; stock: number }) => {
      const { error } = await supabase.from("voucher_campaigns").update({ stock }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Voucher availability updated.");
      await queryClient.invalidateQueries();
    },
    onError: () => toast.error("Could not update voucher availability."),
  });

  const pending = applications.filter((application) => application.status === "pending");
  const menus = ["overview", "organisers", "events", "clashes", "festivals", "sponsors", "help", "rewards", "profile"];

  return (
    <div className="space-y-6">
      <nav aria-label="Administrator sections" className="flex flex-wrap gap-2">
        {menus.map((item) => {
          const Icon =
            item === "overview"
              ? Compass
              : item === "organisers"
                ? Users
                : item === "events"
                  ? Calendar
                  : item === "clashes"
                    ? AlertTriangle
                    : item === "festivals"
                      ? Flag
                      : item === "sponsors"
                        ? Building
                        : item === "help"
                          ? HelpCircle
                          : item === "rewards"
                            ? Trophy
                            : User;

          const label =
            item === "clashes"
              ? (clashes.length > 0 ? `Clashes (${clashes.length})` : "Clash Guardian")
              : item === "organisers"
                ? (pending.length > 0 ? `Organisers (${pending.length})` : "Organisers")
                : item === "festivals"
                  ? "Festivals"
                  : item === "events"
                    ? "Event Schedule"
                    : item;

          return (
            <Button
              key={item}
              variant={pane === item ? "default" : "outline"}
              className={`capitalize gap-1.5 font-bold transition-all ${
                pane === item
                  ? "border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#fff]"
                  : "border-line hover:border-black dark:hover:border-white"
              }`}
              onClick={() => setPane(item)}
            >
              <Icon size={15} />
              <span>{label}</span>
              {item === "clashes" && clashes.length > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-200 text-amber-900 text-[10px] font-mono font-black rounded border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                  <AlertTriangle size={10} className="shrink-0" />
                  <span>{clashes.length}</span>
                </span>
              )}
            </Button>
          );
        })}
      </nav>

      {pane === "overview" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Published events", stats?.events ?? events.length],
              ["Festivals", stats?.festivals ?? 6],
              ["Participant passes", stats?.bookings ?? 0],
              ["Participants", stats?.participants ?? 0],
              ["Organisers", stats?.organisers ?? applications.length],
              ["Event Echoes", stats?.reviews ?? 0],
              ["Event clashes", clashes.length],
              ["Average stars", stats?.average_rating ?? "—"],
            ].map(([label, value]) => (
              <Metric key={String(label)} label={String(label)} value={String(value)} />
            ))}
          </div>

          <section className="rounded-2xl border-2 border-black dark:border-white bg-card p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#fff]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-full border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                  clashes.length > 0
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200"
                    : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200"
                }`}>
                  {clashes.length > 0 ? <AlertTriangle size={24} /> : <CheckCircle2 size={24} />}
                </div>
                <div>
                  <span className="font-mono text-[10px] uppercase font-black tracking-widest text-terracotta">
                    Automated Conflict Guardian
                  </span>
                  <h3 className="serif-heading text-2xl font-bold">
                    Campus Scheduling <span className="inline-block px-2.5 py-0.5 -rotate-1 bg-terracotta text-white rounded border border-black dark:border-white shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]">Conflicts</span>
                  </h3>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`font-mono text-xs font-bold px-3 py-1.5 rounded-full border-2 border-black dark:border-white inline-flex items-center gap-1.5 ${
                  clashes.length > 0
                    ? "bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200"
                    : "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200"
                }`}>
                  {clashes.length > 0 ? (
                    <>
                      <AlertTriangle size={13} className="shrink-0" />
                      <span>{clashes.length} Active Venue Clashes</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={13} className="shrink-0 text-emerald-700" />
                      <span>0 Venue Overlaps</span>
                    </>
                  )}
                </span>
                <Button size="sm" onClick={() => setPane("clashes")} className="text-xs font-bold shrink-0">
                  Open Guardian →
                </Button>
              </div>
            </div>

            <div className="mt-5">
              {clashes.length ? (
                <div className="space-y-3">
                  {clashes.slice(0, 3).map((clash) => (
                    <div
                      key={`${clash.a_id}-${clash.b_id}`}
                      className="rounded-xl border border-line bg-elevated/50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-bold uppercase tracking-wider bg-terracotta text-white px-2 py-0.5 rounded">
                            Venue Clash
                          </span>
                          <span className="font-mono text-xs text-ink-muted">
                            Venue: <strong>{clash.venue}</strong>
                          </span>
                        </div>
                        <p className="font-bold text-ink dark:text-white">
                          {clash.a_name} <span className="text-ink-muted font-normal mx-1">overlaps with</span> {clash.b_name}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Link to="/events/$eventId" params={{ eventId: String(clash.a_id) }} className="btn btn-outline text-xs px-3 py-1.5 font-bold">
                          Inspect #{clash.a_id}
                        </Link>
                        <Link to="/events/$eventId" params={{ eventId: String(clash.b_id) }} className="btn btn-outline text-xs px-3 py-1.5 font-bold">
                          Inspect #{clash.b_id}
                        </Link>
                      </div>
                    </div>
                  ))}
                  {clashes.length > 3 && (
                    <p className="text-xs text-ink-muted pt-1">
                      + {clashes.length - 3} more conflict pairs.{" "}
                      <button onClick={() => setPane("clashes")} className="font-bold underline text-terracotta">
                        View all clashes in Guardian
                      </button>
                    </p>
                  )}
                </div>
              ) : (
                <EmptyState icon={CheckCircle2}>No venue/time overlaps are flagged across active festivals.</EmptyState>
              )}
            </div>
          </section>

          <section className="rounded-2xl border-2 border-black dark:border-white bg-card p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#fff]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] bg-saffron text-black">
                  <Trophy size={22} />
                </div>
                <div>
                  <span className="font-mono text-[10px] uppercase font-black tracking-widest text-terracotta">
                    Campus Standings
                  </span>
                  <h3 className="serif-heading text-2xl font-bold">
                    Leaderboard <span className="inline-block px-2.5 py-0.5 -rotate-1 bg-saffron text-black rounded border border-black shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]">Champions</span>
                  </h3>
                </div>
              </div>
              <span className="font-mono text-xs font-bold text-ink-muted">Top 5 Leaders</span>
            </div>

            <div className="mt-4 grid gap-2">
              {leaderboard.slice(0, 5).map((person, index) => (
                <div
                  key={person.user_id}
                  className="rounded-xl border border-line bg-surface/60 p-3 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full border-2 border-black dark:border-white flex items-center justify-center font-mono text-xs font-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] ${
                      index === 0 ? "bg-saffron text-black" : index === 1 ? "bg-slate-200 text-slate-800" : index === 2 ? "bg-amber-200 text-amber-900" : "bg-elevated text-foreground"
                    }`}>
                      #{index + 1}
                    </div>
                    <span className="font-bold text-sm text-ink dark:text-white">{person.display_name}</span>
                  </div>
                  <span className="inline-flex items-center gap-1 font-mono text-xs font-black text-terracotta bg-card px-2.5 py-1 rounded border border-line">
                    <Flame size={12} className="text-terracotta fill-terracotta/30" />
                    {person.points} pts
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 pt-4 border-t border-line">
              <p className="font-mono text-xs uppercase font-bold text-ink-muted mb-2">Award Official Campus Perk / Honor</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <select
                  value={award.user_id}
                  onChange={(event) => setAward({ ...award, user_id: event.target.value })}
                  className="h-10 rounded-xl border-2 border-black dark:border-white bg-elevated px-3 text-xs font-medium shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]"
                >
                  <option value="">Choose top participant</option>
                  {leaderboard.map((person) => (
                    <option key={person.user_id} value={person.user_id}>
                      {person.display_name} ({person.points} pts)
                    </option>
                  ))}
                </select>
                <Input
                  placeholder="Reward title (e.g. Star Performer)"
                  value={award.title}
                  onChange={(event) => setAward({ ...award, title: event.target.value })}
                  className="h-10 rounded-xl border-2 border-black dark:border-white text-xs shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]"
                />
                <Button
                  onClick={() => awardTop.mutate()}
                  disabled={awardTop.isPending}
                  className="h-10 font-bold text-xs border-2 border-black shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] gap-1.5"
                >
                  <Award size={14} /> Record Reward
                </Button>
              </div>
            </div>
          </section>
        </>
      )}
      {pane === "organisers" && (
        <section className="rounded-2xl border-2 border-black dark:border-white bg-card p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#fff]">
          <SectionTitle
            title="Organiser applications"
            badge={`${pending.length} Pending Review`}
          />
          <div className="mt-5 grid gap-4">
            {applications.map((application) => (
              <article
                key={application.user_id}
                className="rounded-xl border-2 border-black dark:border-white bg-elevated/40 p-5 shadow-[2.5px_2.5px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2.5px_2.5px_0px_0px_#fff]"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1.5 min-w-[280px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-block px-2 py-0.5 -rotate-1 font-mono text-[10px] font-black uppercase bg-saffron text-black rounded border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                        {application.org_type || "Student Club"}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 font-mono text-[10px] font-black uppercase px-2 py-0.5 rounded border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] ${
                          application.status === "approved"
                            ? "bg-emerald-600 text-white"
                            : application.status === "pending"
                              ? "bg-amber-100 text-amber-900"
                              : "bg-destructive text-white"
                        }`}
                      >
                        {application.status}
                      </span>
                    </div>

                    <h4 className="serif-heading text-lg font-bold text-ink dark:text-white">
                      {application.org_name} · <span className="text-terracotta">{application.position}</span>
                    </h4>

                    <p className="font-mono text-xs text-ink-muted">
                      Institution ID: <strong>{application.institutional_id ?? "Unspecified"}</strong>
                    </p>

                    <p className="mt-2 text-sm text-ink-body max-w-3xl leading-relaxed bg-card p-3 rounded-lg border border-line">
                      {application.description || "No charter provided."}
                    </p>
                  </div>

                  {application.status === "pending" && (
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        onClick={() => approve.mutate({ userId: application.user_id, status: "approved" })}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs border border-black shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]"
                      >
                        Approve Organiser
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => approve.mutate({ userId: application.user_id, status: "rejected" })}
                        className="text-destructive hover:bg-destructive/10 font-bold text-xs border border-black"
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {pane === "events" && (
        <div className="space-y-6">
          <EventForm
            form={form}
            setForm={setForm}
            submit={(published) => createEvent.mutate(published)}
            busy={createEvent.isPending}
          />
          <section className="rounded-2xl border-2 border-black dark:border-white bg-card p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#fff]">
            <SectionTitle title="All event schedule" badge={`${events.length} Events`} />
            <div className="mt-5 grid gap-3">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="rounded-xl border border-line bg-elevated/40 p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm hover:border-black dark:hover:border-white transition-all"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Link
                        to="/events/$eventId"
                        params={{ eventId: String(event.id) }}
                        className="serif-heading font-bold text-base hover:underline"
                      >
                        {event.name}
                      </Link>
                      <span
                        className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded border border-black ${
                          event.published ? "bg-emerald-600 text-white" : "bg-saffron text-black"
                        }`}
                      >
                        {event.published ? "Live" : "Draft"}
                      </span>
                    </div>
                    <p className="font-mono text-xs text-ink-muted">
                      {counts[event.id] ?? 0}/{event.maxSeats} passes reserved · {responseCounts[event.id] ?? 0} community reflections
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateEvent.mutate({ id: event.id, published: !event.published })}
                      className="font-bold text-xs"
                    >
                      {event.published ? "Unpublish" : "Publish"}
                    </Button>
                    <Link
                      to="/events/$eventId"
                      params={{ eventId: String(event.id) }}
                      className="btn btn-outline text-xs px-3 py-1.5 font-bold"
                    >
                      View
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
      {pane === "festivals" && (
        <section className="rounded-2xl border-2 border-black dark:border-white bg-card p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#fff]">
          <SectionTitle title="Create a festival" badge="Admin Studio" />
          <form
            onSubmit={(event) => {
              event.preventDefault();
              createFestival.mutate();
            }}
            className="mt-5 grid max-w-3xl gap-4 sm:grid-cols-2"
          >
            <Input
              placeholder="Festival name"
              value={festivalForm.name}
              onChange={(event) => setFestivalForm({ ...festivalForm, name: event.target.value })}
              required
              className="rounded-xl border-2 border-black dark:border-white shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]"
            />
            <Input
              placeholder="Theme (e.g. Cultural Confluence)"
              value={festivalForm.theme}
              onChange={(event) => setFestivalForm({ ...festivalForm, theme: event.target.value })}
              required
              className="rounded-xl border-2 border-black dark:border-white shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]"
            />
            <Input
              placeholder="Short tagline"
              value={festivalForm.tagline}
              onChange={(event) => setFestivalForm({ ...festivalForm, tagline: event.target.value })}
              required
              className="rounded-xl border-2 border-black dark:border-white shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] sm:col-span-2"
            />
            <label className="text-xs font-bold uppercase text-ink-muted grid gap-1">
              Start Date
              <Input
                type="date"
                value={festivalForm.start_date}
                onChange={(event) => setFestivalForm({ ...festivalForm, start_date: event.target.value })}
                required
                className="rounded-xl border-2 border-black dark:border-white shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]"
              />
            </label>
            <label className="text-xs font-bold uppercase text-ink-muted grid gap-1">
              End Date
              <Input
                type="date"
                value={festivalForm.end_date}
                onChange={(event) => setFestivalForm({ ...festivalForm, end_date: event.target.value })}
                required
                className="rounded-xl border-2 border-black dark:border-white shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]"
              />
            </label>
            <Textarea
              className="sm:col-span-2 rounded-xl border-2 border-black dark:border-white shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]"
              placeholder="Festival vision, themes, participating colleges, and atmosphere."
              value={festivalForm.description}
              onChange={(event) => setFestivalForm({ ...festivalForm, description: event.target.value })}
              required
            />
            <Button
              type="submit"
              disabled={createFestival.isPending}
              className="font-bold border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] gap-1.5 sm:col-span-2 justify-self-start"
            >
              <Flag size={15} /> Create Campus Festival
            </Button>
          </form>
        </section>
      )}

      {pane === "sponsors" && (
        <section className="rounded-2xl border-2 border-black dark:border-white bg-card p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#fff]">
          <SectionTitle title="Sponsor requests & partners" badge={`${sponsors.length} Sponsors`} />
          <div className="mt-5 grid gap-3">
            {sponsors.map((sponsor) => (
              <div
                key={sponsor.id}
                className="rounded-xl border-2 border-black dark:border-white bg-elevated/40 p-4 flex flex-wrap items-center justify-between gap-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-ink dark:text-white">{sponsor.name}</span>
                    <span className="inline-block px-2 py-0.5 -rotate-1 font-mono text-[10px] font-black uppercase bg-saffron text-black rounded border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                      {sponsor.tier}
                    </span>
                    <span
                      className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded border border-black ${
                        sponsor.status === "active" ? "bg-emerald-600 text-white" : "bg-amber-100 text-amber-900"
                      }`}
                    >
                      {sponsor.status}
                    </span>
                  </div>
                  <p className="font-mono text-xs text-ink-muted">
                    Sponsorship contribution: <strong>₹{sponsor.amount}</strong>
                  </p>
                </div>
                {(sponsor.status === "requested" || sponsor.status === "approved") && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => updateSponsor.mutate({ id: sponsor.id, status: "active" })}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs border border-black shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]"
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateSponsor.mutate({ id: sponsor.id, status: "rejected" })}
                      className="text-destructive font-bold text-xs border border-black"
                    >
                      Decline
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              upsertSponsor.mutate();
            }}
            className="mt-6 pt-5 border-t border-line grid gap-3 sm:grid-cols-4"
          >
            <Input
              placeholder="Sponsor / brand name"
              value={sponsorForm.name}
              onChange={(event) => setSponsorForm({ ...sponsorForm, name: event.target.value })}
              required
              className="rounded-xl border-2 border-black dark:border-white shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] text-xs"
            />
            <select
              value={sponsorForm.tier}
              onChange={(event) => setSponsorForm({ ...sponsorForm, tier: event.target.value })}
              className="h-10 rounded-xl border-2 border-black dark:border-white bg-elevated px-3 text-xs font-medium shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]"
            >
              <option>Gold</option>
              <option>Silver</option>
              <option>Bronze</option>
              <option>Platinum</option>
            </select>
            <Input
              aria-label="Sponsorship amount"
              type="number"
              min="0"
              value={sponsorForm.amount}
              onChange={(event) => setSponsorForm({ ...sponsorForm, amount: event.target.value })}
              placeholder="Amount in ₹"
              className="rounded-xl border-2 border-black dark:border-white shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] text-xs"
            />
            <Button
              type="submit"
              disabled={upsertSponsor.isPending}
              className="font-bold text-xs border-2 border-black shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]"
            >
              Add Sponsor
            </Button>
          </form>
        </section>
      )}
      {pane === "help" && (
        <section className="brutal-card p-5">
          <SectionTitle title="Help requests" />
          <div className="mt-4 grid gap-3">
            {help.map((item) => (
              <article key={item.id} className="border-b border-line py-3">
                <div className="flex flex-wrap justify-between gap-2">
                  <p className="font-bold">
                    {item.subject} · {item.category}
                  </p>
                  <span className="text-xs text-ink-muted">
                    {item.status}
                    {item.routed_to ? " · routed to event organiser" : " · administrator"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-ink-body">{item.message}</p>
                {item.status === "open" && !item.routed_to && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void answerHelp(item.id, helpAnswers[item.id] ?? "");
                    }}
                    className="mt-2 grid max-w-2xl gap-2"
                  >
                    <Textarea
                      required
                      maxLength={2000}
                      aria-label={`Reply to ${item.subject}`}
                      placeholder="Write a response"
                      value={helpAnswers[item.id] ?? ""}
                      onChange={(event) => setHelpAnswers({ ...helpAnswers, [item.id]: event.target.value })}
                    />
                    <Button type="submit" size="sm" variant="outline">
                      Reply &amp; resolve
                    </Button>
                  </form>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
      {pane === "clashes" && (
        <section className="rounded-2xl border-2 border-black dark:border-white bg-card p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#fff]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-full border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                clashes.length > 0
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200"
                  : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200"
              }`}>
                {clashes.length > 0 ? <AlertTriangle size={24} /> : <CheckCircle2 size={24} />}
              </div>
              <div>
                <span className="font-mono text-[10px] uppercase font-black tracking-widest text-terracotta">
                  Campus Venue &amp; Stage Guardian
                </span>
                <h3 className="serif-heading text-2xl font-bold">
                  {clashes.length > 0 ? (
                    <>Event Clash <span className="inline-block px-2.5 py-0.5 -rotate-1 bg-terracotta text-white rounded border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#fff]">Guardian</span></>
                  ) : (
                    <>All Campus Venues <span className="inline-block px-2.5 py-0.5 -rotate-1 bg-emerald-600 text-white rounded border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">Harmonized</span></>
                  )}
                </h3>
              </div>
            </div>
            <span className={`font-mono text-xs font-bold px-3 py-1.5 rounded-full border-2 border-black dark:border-white self-start sm:self-auto inline-flex items-center gap-1.5 ${
              clashes.length > 0
                ? "bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200"
                : "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200"
            }`}>
              {clashes.length > 0 ? (
                <>
                  <AlertTriangle size={13} className="shrink-0" />
                  <span>{clashes.length} Active Conflicts Detected</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={13} className="shrink-0 text-emerald-700" />
                  <span>0 Venue Overlaps</span>
                </>
              )}
            </span>
          </div>

          <div className="mt-6 space-y-4">
            {clashes.length > 0 ? (
              clashes.map((clash, idx) => (
                <div
                  key={`${clash.a_id}-${clash.b_id}-${idx}`}
                  className="rounded-xl border-2 border-black dark:border-white bg-elevated p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider bg-terracotta text-white px-2 py-0.5 rounded">
                        Venue Clash
                      </span>
                      <span className="font-mono text-xs text-ink-muted">
                        Venue: <strong>{clash.venue}</strong>
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="font-bold text-ink dark:text-white">{clash.a_name}</span>
                      <span className="text-ink-muted mx-2">overlaps with</span>
                      <span className="font-bold text-ink dark:text-white">{clash.b_name}</span>
                    </div>
                    <p className="text-xs text-ink-muted">
                      Both events are scheduled at "{clash.venue}" during the same time window.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      to="/events/$eventId"
                      params={{ eventId: String(clash.a_id) }}
                      className="btn btn-outline text-xs px-3 py-1.5 font-bold"
                    >
                      Inspect #{clash.a_id}
                    </Link>
                    <Link
                      to="/events/$eventId"
                      params={{ eventId: String(clash.b_id) }}
                      className="btn btn-outline text-xs px-3 py-1.5 font-bold"
                    >
                      Inspect #{clash.b_id}
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 bg-parchment/40 dark:bg-slate-800/40 rounded-xl border border-dashed border-line">
                <CheckCircle2 className="mx-auto text-emerald-600 mb-2" size={32} />
                <h4 className="font-bold text-base">All Venues &amp; Schedules Harmonized</h4>
                <p className="text-xs text-ink-muted max-w-md mx-auto mt-1">
                  No two events are sharing the same venue simultaneously. All collegiate festival slots are clear.
                </p>
              </div>
            )}
          </div>
        </section>
      )}
      {pane === "rewards" && (
        <>
          <section className="brutal-card p-5">
            <SectionTitle title="Voucher availability" />
            <div className="mt-4 grid gap-3">
              {vouchers.map((voucher) => {
                const issued = issuedVouchers[voucher.id] ?? 0;
                return (
                  <div key={voucher.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-3">
                    <div>
                      <p className="font-bold">{voucher.title}</p>
                      <p className="text-xs text-ink-muted">
                        Issued: {issued} · Remaining: {Math.max(0, voucher.stock - issued)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {onIssueVoucher && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs border-line hover:bg-terracotta hover:text-ivory"
                          disabled={voucher.stock - issued <= 0}
                          onClick={() => void onIssueVoucher(voucher.id)}
                        >
                          Issue to Maya
                        </Button>
                      )}
                      <label className="text-xs text-ink-muted">
                        Total stock
                        <Input
                          aria-label={`${voucher.title} total stock`}
                          type="number"
                          min={issued}
                          max="100000"
                          defaultValue={voucher.stock}
                          className="w-24 ml-1 inline-block"
                          onBlur={(event) => {
                            const value = Number(event.target.value);
                            if (value !== voucher.stock && Number.isInteger(value) && value >= issued) {
                              campaignUpdate.mutate({ id: voucher.id, stock: value });
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
          <section className="brutal-card p-5">
            <SectionTitle title="Recent Event Echoes" />
            <div className="mt-3 grid gap-3">
              {echoRecap.length ? (
                echoRecap.map((review) => (
                  <article key={review.id} className="border-b border-line py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-bold">
                        {events.find((event) => event.id === review.event_id)?.name ?? `Event ${review.event_id}`} · {review.rating}/5
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-elevated border border-line">
                          {review.visibility ?? "private"}
                        </span>
                        <span className={`font-mono text-[10px] uppercase px-2 py-0.5 rounded font-bold ${
                          review.moderation_status === "flagged"
                            ? "bg-destructive/15 text-destructive"
                            : review.moderation_status === "hidden"
                              ? "bg-ink/10 text-ink-muted"
                              : "bg-sage-soft text-sage"
                        }`}>
                          {review.moderation_status ?? "approved"}
                        </span>
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-ink-body">{review.comment}</p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {review.author_name} · {new Date(review.created_at).toLocaleDateString()}
                    </p>
                    <MyEchoMedia media={review.media} />
                    {review.liked_by_organiser && (
                      <p className="mt-1 text-xs text-terracotta">Liked by the event organiser</p>
                    )}
                    {onModerateEcho && (
                      <div className="mt-2.5 flex items-center gap-2 pt-2 border-t border-line/60">
                        <span className="text-[10px] font-mono uppercase text-ink-muted">Moderate:</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] px-2 text-sage hover:bg-sage-soft"
                          onClick={() => void onModerateEcho(review.id, "approved")}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] px-2 text-terracotta hover:bg-saffron-soft"
                          onClick={() => void onModerateEcho(review.id, "flagged")}
                        >
                          Flag
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] px-2 text-destructive hover:bg-destructive/10"
                          onClick={() => void onModerateEcho(review.id, "hidden")}
                        >
                          Hide
                        </Button>
                      </div>
                    )}
                  </article>
                ))
              ) : (
                <EmptyState>No Event Echoes have been shared yet.</EmptyState>
              )}
            </div>
          </section>
        </>
      )}
      {pane === "profile" && (
        <section className="brutal-card p-5">
          <SectionTitle title="Administrator profile" />
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            {[
              ["Office", adminProfile?.office],
              ["Designation", adminProfile?.designation],
              ["Staff ID", adminProfile?.staff_id],
              ["Access status", adminProfile?.status],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">{label}</dt>
                <dd className="mt-1 text-sm">{value || "—"}</dd>
              </div>
            ))}
          </dl>
          {onResetWorkspace && (
            <div className="mt-8 border-t border-line pt-5">
              <p className="text-xs font-bold uppercase tracking-wider text-destructive">Demo Workspace Operations</p>
              <p className="mt-1 text-xs text-ink-body">
                Reset all sample registrations, newly created events, organiser reviews, and voucher changes back to default demo seeds.
              </p>
              <Button
                variant="destructive"
                className="mt-3"
                onClick={() => {
                  if (window.confirm("Reset all demo data back to clean initial seeds?")) {
                    void onResetWorkspace();
                  }
                }}
              >
                Reset Demo Workspace
              </Button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
