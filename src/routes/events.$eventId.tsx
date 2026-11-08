import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CalendarDays, MapPin, Star, Sparkles, User, Heart, MessageSquare, X, Flame, AlertTriangle, CheckCircle2, Flag, Zap, Award } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { DotField } from "@/components/DotField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { img } from "@/assets/rangora";
import { supabase } from "@/integrations/supabase/client";
import { useBooking } from "@/lib/use-booking";
import { useProfile, useSeatCounts, useSession, setStoredDemoSession } from "@/lib/use-auth";
import { categories, festivals } from "@/data/catalog";
import { fmtWhen, pulse } from "@/lib/catalog-helpers";
import { canBookAsRole, canManageEvents, canSubmitEventReview } from "@/lib/role-rules";
import { fetchEventDetail } from "@/lib/api.functions";
import { useCatalogEvents } from "@/lib/use-catalog";
import { checkParticipantBookingConflict, type ConflictResult } from "@/lib/event-conflicts";
import { BadgeSvg } from "@/components/BadgeSvg";
import type { Database, Json } from "@/integrations/supabase/types";

type EventRow = {
  id: number;
  name: string;
  subtitle: string;
  description: string;
  venue: string;
  start_at: string;
  end_at: string;
  price: number;
  max_seats: number;
  category_id: number;
  festival_id: number;
  poster: string;
  artists: string[];
  terms: string;
  organiser_id: string | null;
  organiser_name: string | null;
  published: boolean;
  booked_seats: number;
  badges: Array<{ id: string; title: string; description: string; emoji: string; points: number }>;
  reviews: Array<{
    id: string;
    userId: string;
    authorName: string;
    rating: number;
    comment: string;
    media: any;
    taggedFriends: string[];
    likedByOrganiser: boolean;
    createdAt: string;
  }>;
};

type ReviewRow = Database["public"]["Tables"]["reviews"]["Row"];
type MediaItem = { path: string; name: string; type: string };

function parseMedia(value: Json): MediaItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) return [];
    const path = item["path"];
    const name = item["name"];
    const type = item["type"];
    if (typeof path !== "string" || typeof name !== "string" || typeof type !== "string") return [];
    return [{ path, name, type }];
  });
}

export const Route = createFileRoute("/events/$eventId")({
  head: () => ({
    meta: [
      { title: "Campus event details | Rangora" },
      { name: "description", content: "Event descriptions, invited artists, terms, Seat Pulse, and participant Event Echo on Rangora." },
      { property: "og:title", content: "Campus event details | Rangora" },
      { property: "og:description", content: "Explore the full event details and community reviews on Rangora." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EventDetail,
});

function EventDetail() {
  const { eventId: eventIdParam } = Route.useParams();
  const eventId = Number(eventIdParam);
  const { user, isDemo, demoRole } = useSession();
  const { data: me } = useProfile(user?.id);
  const { data: seatCounts = {} } = useSeatCounts();
  const queryClient = useQueryClient();
  const booking = useBooking(user?.id);
  const [editMode, setEditMode] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewText, setReviewText] = useState("");
  const [taggedFriends, setTaggedFriends] = useState("");
  const [rating, setRating] = useState("5");
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [editor, setEditor] = useState({ name: "", subtitle: "", description: "", venue: "", start_at: "", end_at: "", price: "0", max_seats: "30", artists: "", terms: "" });
  const { events: allCatalogEvents } = useCatalogEvents();
  const [clashModal, setClashModal] = useState<ConflictResult | null>(null);
  const [selectedRatingFilter, setSelectedRatingFilter] = useState<number | "all">("all");
  const [activeModalReview, setActiveModalReview] = useState<ReviewRow | null>(null);
  const [reviewReactions, setReviewReactions] = useState<Record<string, {
    likes: number;
    liked: boolean;
    emojis: { fire: number; clap: number; heart: number; zap: number };
    userEmojis: { fire: boolean; clap: boolean; heart: boolean; zap: boolean };
    comments: Array<{ id: string; author: string; text: string; time: string }>;
  }>>({});
  const [replyText, setReplyText] = useState("");

  const allUserBookings = useQuery({
    queryKey: ["user-all-booked-registrations", user?.id, isDemo],
    enabled: Boolean(user?.id || isDemo),
    queryFn: async () => {
      if (isDemo) {
        try {
          const { getDemoState } = await import("@/lib/demo.functions");
          const state = await getDemoState();
          return (state.registrations || []).filter((r: any) => r.kind === "booked");
        } catch {
          return [];
        }
      }
      if (!user?.id) return [];
      const { data } = await supabase.from("registrations").select("event_id,kind").eq("user_id", user.id).eq("kind", "booked");
      return data ?? [];
    },
  });

  function handleParticipantBooking() {
    if (event && allUserBookings.data && allUserBookings.data.length > 0) {
      const bookedEventIds = new Set(allUserBookings.data.map((r: any) => r.event_id));
      const bookedEvents = allCatalogEvents.filter((e) => bookedEventIds.has(e.id) && e.id !== eventId);
      const clash = checkParticipantBookingConflict(
        bookedEvents.map((e) => ({
          id: e.id,
          name: e.name,
          venue: e.venue,
          startAt: e.startAt,
          endAt: e.endAt,
        })),
        {
          id: event.id,
          name: event.name,
          venue: event.venue,
          startAt: event.start_at,
          endAt: event.end_at,
        }
      );
      if (clash.hasConflict) {
        setClashModal(clash);
        return;
      }
    }
    booking.mutate({ eventId, kind: "booked" });
  }

  function toggleReaction(reviewId: string, emoji: "fire" | "clap" | "heart" | "zap") {
    setReviewReactions((prev) => {
      const current = prev[reviewId] ?? {
        likes: 4,
        liked: false,
        emojis: { fire: 2, clap: 3, heart: 5, zap: 1 },
        userEmojis: { fire: false, clap: false, heart: false, zap: false },
        comments: [],
      };
      const isActive = current.userEmojis[emoji];
      return {
        ...prev,
        [reviewId]: {
          ...current,
          emojis: {
            ...current.emojis,
            [emoji]: isActive ? current.emojis[emoji] - 1 : current.emojis[emoji] + 1,
          },
          userEmojis: {
            ...current.userEmojis,
            [emoji]: !isActive,
          },
        },
      };
    });
  }

  function toggleLike(reviewId: string) {
    setReviewReactions((prev) => {
      const current = prev[reviewId] ?? {
        likes: 4,
        liked: false,
        emojis: { fire: 2, clap: 3, heart: 5, zap: 1 },
        userEmojis: { fire: false, clap: false, heart: false, zap: false },
        comments: [],
      };
      const isLiked = current.liked;
      return {
        ...prev,
        [reviewId]: {
          ...current,
          likes: isLiked ? current.likes - 1 : current.likes + 1,
          liked: !isLiked,
        },
      };
    });
  }

  function addReply(reviewId: string) {
    if (!replyText.trim()) return;
    const authorName = me?.profile?.full_name || (isDemo ? "Maya Sen (Participant)" : "Attendee");
    setReviewReactions((prev) => {
      const current = prev[reviewId] ?? {
        likes: 4,
        liked: false,
        emojis: { fire: 2, clap: 3, heart: 5, zap: 1 },
        userEmojis: { fire: false, clap: false, heart: false, zap: false },
        comments: [],
      };
      return {
        ...prev,
        [reviewId]: {
          ...current,
          comments: [
            ...current.comments,
            {
              id: crypto.randomUUID(),
              author: authorName,
              text: replyText.trim(),
              time: "Just now",
            },
          ],
        },
      };
    });
    setReplyText("");
    toast.success("Reply added to reflection.");
  }

  const eventQuery = useQuery({
    queryKey: ["rangora-event", eventId, isDemo],
    enabled: Number.isInteger(eventId) && eventId > 0,
    queryFn: async () => {
      const data = (await fetchEventDetail({ data: { eventId, isDemo: Boolean(isDemo) } })) as any;
      if (!data) return null;
      return {
        id: data.id,
        name: data.name,
        subtitle: data.subtitle,
        description: data.description,
        venue: data.venue,
        start_at: data.startAt,
        end_at: data.endAt,
        price: data.price,
        max_seats: data.maxSeats,
        category_id: data.categoryId,
        festival_id: data.festivalId,
        poster: data.poster,
        artists: data.artists,
        terms: data.terms,
        organiser_id: data.organiserId,
        organiser_name: data.organiserName,
        published: data.published,
        booked_seats: data.bookedSeats,
        badges: data.badges,
        reviews: data.reviews,
      } as EventRow;
    },
  });
  const event = eventQuery.data;
  const organizerProfile = useQuery({
    queryKey: ["organiser-application", user?.id],
    enabled: Boolean(user?.id && me?.role === "organizer"),
    queryFn: async () => (await supabase.from("organiser_profiles").select("status").eq("user_id", user?.id ?? "").maybeSingle()).data,
  });
  const manager = canManageEvents([me?.role ?? ""], organizerProfile.data?.status);
  const ownsEvent = Boolean(event && user?.id && (me?.role === "admin" || event.organiser_id === user.id));
  const canEdit = manager && ownsEvent;
  const isParticipant = canBookAsRole([me?.role ?? ""]) || (isDemo && demoRole === "participant");

  const registrations = useQuery({
    queryKey: ["event-registration", user?.id, eventId],
    enabled: Boolean(user?.id && isParticipant && event),
    queryFn: async () => (await supabase.from("registrations").select("id,kind").eq("user_id", user?.id ?? "").eq("event_id", eventId)).data ?? [],
  });
  const attendanceQuery = useQuery({
    queryKey: ["event-attendance", user?.id, eventId],
    enabled: Boolean(user?.id && isParticipant && event),
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("attendance")
        .select("id")
        .eq("user_id", user?.id ?? "")
        .eq("event_id", eventId)
        .maybeSingle();
      return data;
    },
  });
  const reviews = useQuery({
    queryKey: ["event-reviews", eventId],
    enabled: Boolean(event?.published),
    queryFn: async () => {
      const { data, error } = await supabase.from("reviews").select("*").eq("event_id", eventId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as ReviewRow[];
    },
  });
  const badges = useQuery({
    queryKey: ["event-badges", eventId],
    enabled: Boolean(event),
    queryFn: async () => (await supabase.from("event_badges").select("id,title,description,emoji,points").eq("event_id", eventId).order("created_at")).data ?? [],
  });

  const editEvent = useMutation({
    mutationFn: async () => {
      if (!event || !canEdit) throw new Error("You cannot edit this event.");
      const start = new Date(editor.start_at);
      const end = new Date(editor.end_at);
      const price = Number(editor.price);
      const seats = Number(editor.max_seats);
      if (!editor.name.trim() || !editor.subtitle.trim() || !editor.venue.trim() || !editor.description.trim() || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start || !Number.isFinite(price) || price < 0 || !Number.isInteger(seats) || seats < 1 || seats > 10000) throw new Error("Check the event details and times.");
      const { error } = await supabase.from("events").update({
        name: editor.name.trim(), subtitle: editor.subtitle.trim(), description: editor.description.trim(), venue: editor.venue.trim(),
        start_at: start.toISOString(), end_at: end.toISOString(), price, max_seats: seats,
        artists: editor.artists.split("\n").map((artist) => artist.trim()).filter(Boolean).slice(0, 40), terms: editor.terms.trim(),
      }).eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: async () => { toast.success("Event details updated."); setEditMode(false); await queryClient.invalidateQueries(); },
    onError: (error) => toast.error(error.message.includes("CLASH") ? "This time overlaps another event you manage." : error.message),
  });

  const publishEvent = useMutation({
    mutationFn: async (published: boolean) => {
      if (!canEdit) throw new Error("You cannot change this event.");
      const { error } = await supabase.from("events").update({ published }).eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: async () => { toast.success("Publishing status updated."); await queryClient.invalidateQueries(); },
    onError: (error) => toast.error(error.message),
  });

  const submitReview = useMutation({
    mutationFn: async () => {
      const hasBooking = registrations.data?.some((r) => r.kind === "booked") ?? false;
      const isEnded = Boolean(event && new Date(event.end_at).getTime() < Date.now());
      const isVerified = Boolean(attendanceQuery.data);

      if (!isDemo && (!user?.id || !event || !canSubmitEventReview(hasBooking, isEnded, isVerified))) {
        throw new Error("Event Echo opens only after an event concludes and attendance is verified by an organiser.");
      }
      if (!reviewText.trim() || reviewText.length > 1500 || mediaFiles.length > 4 || mediaFiles.some((file) => file.size > 15 * 1024 * 1024 || !/^(image\/(jpeg|png|webp)|video\/mp4)$/.test(file.type))) throw new Error("Share a note and up to four JPG, PNG, WEBP, or MP4 files under 15 MB each.");

      if (isDemo) {
        const { performDemoAction } = await import("@/lib/demo.functions");
        await performDemoAction({
          data: {
            action: "submitEcho",
            eventId,
            rating: Number(rating),
            comment: reviewText.trim(),
            taggedFriends: taggedFriends.split(",").map((friend) => friend.trim()).filter(Boolean),
            media: [],
            visibility: "campus",
            publicConsent: true,
          },
        });
        return;
      }

      if (!user?.id) throw new Error("Please sign in to share your Event Echo.");

      const media: MediaItem[] = [];
      for (const file of mediaFiles) {
        const path = `${eventId}/${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error } = await supabase.storage.from("rangora-event-echo").upload(path, file, { upsert: false, contentType: file.type });
        if (error) throw error;
        media.push({ path, name: file.name, type: file.type });
      }
      const friendTags = [...new Set(taggedFriends.split(",").map((friend) => friend.trim()).filter(Boolean))].slice(0, 20);
      const { error } = await supabase.from("reviews").insert({ event_id: eventId, user_id: user.id, rating: Number(rating), comment: reviewText.trim(), media, tagged_friends: friendTags });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Your Event Echo is live.");
      setReviewText("");
      setTaggedFriends("");
      setMediaFiles([]);
      setReviewOpen(false);
      await queryClient.invalidateQueries();
    },
    onError: (error) => toast.error(error.message),
  });

  const likeReview = useMutation({
    mutationFn: async (reviewId: string) => {
      if (!canEdit && !isDemo) throw new Error("Only this event's organiser or an administrator can like an Event Echo.");
      if (isDemo) {
        const { performDemoAction } = await import("@/lib/demo.functions");
        await performDemoAction({
          data: {
            action: "toggleEchoLike",
            echoId: reviewId,
          },
        });
        return;
      }
      const { error } = await supabase.rpc("toggle_review_like", { _rid: reviewId });
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["event-reviews", eventId] });
      await queryClient.invalidateQueries({ queryKey: ["rangora-event", eventId] });
    },
    onError: (error) => toast.error(error.message),
  });

  const pulseState = event ? pulse(seatCounts[event.id] ?? 0, event.max_seats) : null;
  const artistNames: string[] = useMemo(() => {
    if (event && Array.isArray(event.artists) && event.artists.length > 0) {
      const valid = event.artists.filter((artist): artist is string => typeof artist === "string" && artist.trim().length > 0);
      if (valid.length > 0) return valid;
    }
    if (event?.category_id && DEFAULT_CATEGORY_GUESTS[event.category_id]) {
      return DEFAULT_CATEGORY_GUESTS[event.category_id] ?? [];
    }
    return DEFAULT_CATEGORY_GUESTS[1] ?? [];
  }, [event]);

  const displayReviews: ReviewRow[] = useMemo(() => {
    if (reviews.data && reviews.data.length > 0) return reviews.data;
    if (event?.reviews && Array.isArray(event.reviews)) {
      return event.reviews.map((r: any) => ({
        id: String(r.id),
        event_id: r.eventId ?? r.event_id ?? eventId,
        user_id: r.userId ?? r.user_id ?? "d3300000-0000-0000-0000-000000000001",
        author_name: r.authorName ?? r.author_name ?? "Maya Sen",
        rating: Number(r.rating ?? 5),
        comment: r.comment ?? "",
        media: r.media ?? [],
        tagged_friends: r.taggedFriends ?? r.tagged_friends ?? [],
        liked_by_organiser: Boolean(r.likedByOrganiser ?? r.liked_by_organiser),
        created_at: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
      }));
    }
    return [];
  }, [reviews.data, event?.reviews, eventId]);

  const displayBadges = useMemo(() => {
    if (badges.data && badges.data.length > 0) return badges.data;
    if (event?.badges && Array.isArray(event.badges)) return event.badges;
    return [];
  }, [badges.data, event?.badges]);

  const filteredReviews = useMemo(() => {
    if (selectedRatingFilter === "all") return displayReviews;
    return displayReviews.filter((r) => r.rating === selectedRatingFilter);
  }, [displayReviews, selectedRatingFilter]);

  const avgRating = useMemo(() => {
    if (!displayReviews.length) return "5.0";
    return (displayReviews.reduce((sum, r) => sum + r.rating, 0) / displayReviews.length).toFixed(1);
  }, [displayReviews]);

  function beginEdit() {
    if (!event) return;
    const localTime = (date: string) => { const d = new Date(date); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
    setEditor({ name: event.name, subtitle: event.subtitle, description: event.description, venue: event.venue, start_at: localTime(event.start_at), end_at: localTime(event.end_at), price: String(event.price), max_seats: String(event.max_seats), artists: artistNames.join("\n"), terms: event.terms });
    setEditMode(true);
  }

  if (!Number.isInteger(eventId) || eventId < 1) return <EventMessage title="Event not found" message="This event link is not valid." />;
  if (eventQuery.isLoading) {
    return (
      <div className="relative min-h-screen bg-ivory">
        <DotField fixed />
        <SiteHeader />
        <p className="relative z-10 p-10 text-center text-sm text-ink-muted">Loading event details…</p>
      </div>
    );
  }
  if (!event) return <EventMessage title="Event not found" message="It may have been moved, or it is not available to your account." />;

  const category = categories.find((item) => item.id === event.category_id);
  const booked = seatCounts[event.id] ?? 0;
  const isSoldOut = (pulseState?.left ?? 0) <= 0 || (event.booked_seats ?? booked) >= event.max_seats;
  const mayReview = isDemo || (isParticipant && Boolean(user?.id));

  return (
    <div className="relative min-h-screen bg-ivory">
      <DotField fixed />
      <SiteHeader />
      <main className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Link to="/" hash="featured-events-today" className="inline-flex items-center gap-2 text-sm font-bold underline underline-offset-4"><ArrowLeft size={16} /> Back to events</Link>
      <article className="mt-6 grid overflow-hidden rounded-xl border border-ink bg-paper lg:grid-cols-[0.95fr_1.05fr]">
        <div className="min-h-72 bg-parchment lg:min-h-[550px]"><img src={img(event.poster)} alt={event.name} className="h-full min-h-72 w-full object-cover lg:min-h-[550px]" /></div>
        <div className="p-5 sm:p-8 lg:p-10">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#fff] px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider bg-saffron text-black rounded">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-terracotta animate-pulse" />
              {category?.name ?? "Campus Experience"}{!event.published ? " · Draft" : ""}
            </span>
            {event.festival_id && (
              <span className="font-mono text-[10px] uppercase font-bold tracking-wider bg-card text-foreground px-2 py-0.5 rounded border border-ink/20 dark:border-white/20 inline-flex items-center gap-1">
                <Flag size={11} className="text-terracotta" />
                <span>{festivals.find((f) => f.id === event.festival_id)?.name ?? "Campus Festival"}</span>
              </span>
            )}
          </div>
          {!editMode ? <>
            <h1 className="serif-heading mt-3 text-3xl sm:text-4xl">{event.name}</h1>
            <p className="mt-2 text-base font-semibold text-ink-body">{event.subtitle}</p>
            {event.organiser_name && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-ink-muted">
                <User size={13} className="text-terracotta" />
                Hosted by {event.organiser_name}
              </p>
            )}
            <p className="mt-6 whitespace-pre-line text-sm leading-7 text-ink-body">{event.description}</p>
            <div className="mt-6 grid gap-3 border-y border-line py-5 sm:grid-cols-2">
              <p className="flex items-start gap-2 text-sm"><CalendarDays size={17} className="mt-0.5 shrink-0 text-terracotta" />{fmtWhen(event.start_at)}<br />Ends {fmtWhen(event.end_at)}</p>
              <p className="flex items-start gap-2 text-sm"><MapPin size={17} className="mt-0.5 shrink-0 text-terracotta" />{event.venue}</p>
            </div>
            {/* Booking & Capacity Enforcement */}
            {isSoldOut ? (
              <div className="mt-6 rounded-xl border-2 border-destructive/40 bg-destructive/10 p-5">
                <div className="flex items-center gap-2 font-bold text-sm text-destructive">
                  <span className="h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />
                  EVENTS CLOSED · ALL {event.max_seats} SEATS FILLED
                </div>
                <p className="mt-1 text-xs text-destructive/90 leading-relaxed">
                  This campus event has reached full capacity. In accordance with safety policies, bookings are closed and no additional entries are permitted.
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <Button disabled className="bg-ink-muted/30 text-ink-muted cursor-not-allowed border border-line">
                    Event Closed (Sold Out)
                  </Button>
                  <span className="font-mono text-xs text-ink-muted">0 seats remaining</span>
                </div>
              </div>
            ) : (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-mono text-xs uppercase tracking-wider text-ink-muted">
                    {event.price > 0 ? `₹${event.price} per pass` : "Free admission"}
                  </p>
                  <div className="mt-2">
                    <div className={`seat-pulse-wrap ${pulseState?.cls}`}>
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="flex items-center gap-1.5">
                          <span className="pulse-dot" /> {pulseState?.label} · {pulseState?.left} of {event.max_seats} open
                        </span>
                        <span className="font-mono text-[10px] text-ink-muted">
                          {event.booked_seats ?? (seatCounts[event.id] ?? 0)}/{event.max_seats}
                        </span>
                      </div>
                      <div className="seat-pulse-bar-track mt-1">
                        <div
                          className="seat-pulse-bar-fill"
                          style={{ width: `${Math.max(4, (pulseState?.ratio ?? 0) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {isParticipant && event.published ? (
                    <>
                      <Button
                        disabled={booking.isPending}
                        onClick={handleParticipantBooking}
                        className="btn btn-primary min-h-11 px-6 font-bold"
                      >
                        {booking.isPending ? "Reserving pass…" : `Book Pass · ${event.price > 0 ? `₹${event.price}` : "Free"}`}
                      </Button>
                      <Button
                        variant="outline"
                        disabled={booking.isPending}
                        onClick={() => booking.mutate({ eventId, kind: "planned" })}
                        className="min-h-11 px-4 font-bold"
                      >
                        + Add to Plan
                      </Button>
                    </>
                  ) : !user ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to="/auth"
                        search={{ mode: "login" }}
                        className="btn btn-primary text-xs px-4 py-2.5 font-bold"
                      >
                        Sign In to Book Pass
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setStoredDemoSession("participant");
                          handleParticipantBooking();
                        }}
                        className="btn btn-outline border-terracotta text-terracotta text-xs px-3.5 py-2.5 font-bold hover:bg-terracotta/10"
                      >
                        Book as Demo Participant
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-ink-muted">
                      Organiser and Admin accounts cannot book participant passes. Please sign in with a Participant account to book.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* BookMyShow Style Artists & Special Guests with Circular PFPs */}
            {artistNames.length > 0 && (
              <section className="mt-8 border-t border-line pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-terracotta font-bold">
                      Special Guests &amp; Cast
                    </span>
                    <h2 className="serif-heading text-xl sm:text-2xl mt-0.5">
                      Artists &amp; Invited <span className="inline-block px-2.5 py-0.5 -rotate-1 bg-saffron text-black rounded border-2 border-black dark:border-white shadow-[2.5px_2.5px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2.5px_2.5px_0px_0px_#fff]">Guests</span>
                    </h2>
                  </div>
                  <span className="text-xs text-ink-muted font-bold">{artistNames.length} guests</span>
                </div>

                <div className="no-scrollbar flex gap-5 overflow-x-auto pb-4 pt-1">
                  {artistNames.map((artist, idx) => (
                    <ArtistProfileCard key={artist} name={artist} index={idx} />
                  ))}
                </div>
              </section>
            )}
            {event.terms.trim() && (
              <section className="mt-7 border-t border-line pt-5">
                <h2 className="serif-heading text-xl">
                  Participation <span className="inline-block px-2.5 py-0.5 rotate-1 bg-terracotta text-white rounded border-2 border-black dark:border-white shadow-[2.5px_2.5px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2.5px_2.5px_0px_0px_#fff]">Guidelines</span> &amp; Terms
                </h2>
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-ink-body">{event.terms}</p>
              </section>
            )}
            {displayBadges.length > 0 && (
              <section className="mt-7 border-t border-line pt-5">
                <div className="flex items-center gap-2">
                  <Sparkles size={18} className="text-terracotta" />
                  <h2 className="serif-heading text-xl">
                    Collectible Event <span className="inline-block px-2.5 py-0.5 -rotate-1 bg-lime text-black rounded border-2 border-black dark:border-white shadow-[2.5px_2.5px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2.5px_2.5px_0px_0px_#fff]">Badges</span>
                  </h2>
                </div>
                <p className="text-xs text-ink-muted mt-1">Earned upon confirmed event attendance and check-in.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {displayBadges.map((badge: any) => (
                    <div key={badge.id} className="brutal-card p-3 flex items-center gap-3">
                      <BadgeSvg badge={badge} className="w-14 h-14" />
                      <div>
                        <p className="font-bold text-sm">{badge.title}</p>
                        <p className="text-xs text-ink-muted mt-0.5">{badge.description}</p>
                        <span className="font-mono text-[10px] font-bold text-terracotta mt-1 inline-block">+{badge.points} PTS</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </> : <section>
            <h1 className="serif-heading text-3xl">Edit event details</h1>
            <form onSubmit={(submitEvent) => { submitEvent.preventDefault(); editEvent.mutate(); }} className="mt-5 grid gap-3">
              <Input required aria-label="Event name" placeholder="Event name" value={editor.name} onChange={(e) => setEditor({ ...editor, name: e.target.value })} />
              <Input required aria-label="Subtitle" placeholder="Short subtitle" value={editor.subtitle} onChange={(e) => setEditor({ ...editor, subtitle: e.target.value })} />
              <Input required aria-label="Venue" placeholder="Venue" value={editor.venue} onChange={(e) => setEditor({ ...editor, venue: e.target.value })} />
              <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-xs font-bold">Starts<Input required type="datetime-local" value={editor.start_at} onChange={(e) => setEditor({ ...editor, start_at: e.target.value })} /></label><label className="grid gap-1 text-xs font-bold">Ends<Input required type="datetime-local" value={editor.end_at} onChange={(e) => setEditor({ ...editor, end_at: e.target.value })} /></label></div>
              <div className="grid gap-3 sm:grid-cols-2"><Input aria-label="Ticket price" type="number" min="0" value={editor.price} onChange={(e) => setEditor({ ...editor, price: e.target.value })} /><Input aria-label="Seat capacity" type="number" min="1" max="10000" value={editor.max_seats} onChange={(e) => setEditor({ ...editor, max_seats: e.target.value })} /></div>
              <Textarea required aria-label="Full event description" placeholder="Full event description" value={editor.description} onChange={(e) => setEditor({ ...editor, description: e.target.value })} />
              <Textarea aria-label="Invited artists" placeholder="Invited artists & guests (Name (Role) | PhotoURL) — one per line" value={editor.artists} onChange={(e) => setEditor({ ...editor, artists: e.target.value })} />
              <Textarea aria-label="Terms and conditions" placeholder="Terms and conditions (optional)" value={editor.terms} onChange={(e) => setEditor({ ...editor, terms: e.target.value })} />
              <div className="flex gap-2"><Button type="submit" disabled={editEvent.isPending}>Save changes</Button><Button type="button" variant="outline" onClick={() => setEditMode(false)}>Cancel</Button></div>
            </form>
          </section>}
          {canEdit && !editMode && <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-5"><Button variant="outline" onClick={beginEdit}>Edit event</Button><Button variant="outline" onClick={() => publishEvent.mutate(!event.published)}>{event.published ? "Unpublish" : "Publish event"}</Button></div>}
        </div>
      </article>

      {event.published && (
        <section className="mt-12 rounded-2xl border-2 border-black dark:border-white bg-card p-6 sm:p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#fff] relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-line pb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs uppercase font-extrabold tracking-widest text-terracotta">
                  Community Reflections
                </span>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-saffron text-black border border-black shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] inline-flex items-center gap-1">
                  <Star size={11} className="fill-black text-black" />
                  <span>{avgRating} / 5.0</span>
                </span>
              </div>
              <h2 className="serif-heading mt-1 text-3xl font-bold">
                Event <span className="inline-block px-2.5 py-0.5 rotate-1 bg-pink text-white rounded border-2 border-black dark:border-white shadow-[2.5px_2.5px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2.5px_2.5px_0px_0px_#fff]">Echo</span>
              </h2>
              <p className="mt-1 text-xs text-ink-muted">
                Attendee photographs, acoustics, and candid reviews from verified campus participants.
              </p>
            </div>
            
            {/* Rating Filter Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedRatingFilter("all")}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 border-black dark:border-white transition-all ${
                  selectedRatingFilter === "all"
                    ? "bg-terracotta text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                    : "bg-elevated hover:bg-parchment"
                }`}
              >
                All ({displayReviews.length})
              </button>
              {[5, 4, 3].map((star) => {
                const count = displayReviews.filter((r) => r.rating === star).length;
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setSelectedRatingFilter(selectedRatingFilter === star ? "all" : star)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 border-black dark:border-white transition-all inline-flex items-center gap-1 ${
                      selectedRatingFilter === star
                        ? "bg-saffron text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                        : "bg-elevated hover:bg-parchment"
                    }`}
                  >
                    <span>{star}</span>
                    <Star size={11} className="fill-current text-current" />
                    <span>({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Share an Event Echo button & form */}
          {mayReview && (
            <div className="mt-6 border-b border-line pb-6">
              <Button
                variant="outline"
                onClick={() => setReviewOpen((open) => !open)}
                className="font-bold border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] inline-flex items-center gap-1.5"
              >
                {reviewOpen ? "Close Review Form" : (
                  <>
                    <Sparkles size={14} />
                    <span>Share Your Event Echo</span>
                  </>
                )}
              </Button>
              {reviewOpen && (
                <form
                  onSubmit={(submitEvent) => {
                    submitEvent.preventDefault();
                    submitReview.mutate();
                  }}
                  className="mt-5 grid max-w-2xl gap-4 p-5 rounded-xl border border-line bg-elevated"
                >
                  <label className="grid gap-1 text-xs font-bold uppercase text-ink-muted">
                    Your rating
                    <select
                      value={rating}
                      onChange={(e) => setRating(e.target.value)}
                      className="h-10 rounded-md border border-input bg-card px-3 text-sm font-semibold"
                    >
                      {[5, 4, 3, 2, 1].map((value) => (
                        <option key={value} value={value}>
                          {value} of 5 Stars
                        </option>
                      ))}
                    </select>
                  </label>
                  <Textarea
                    required
                    maxLength={1500}
                    placeholder="How was the event? Describe the acoustics, crowd, and campus vibe..."
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    className="bg-card"
                  />
                  <Input
                    aria-label="Tag friends"
                    maxLength={480}
                    placeholder="Tag friends who joined (names, comma-separated)"
                    value={taggedFriends}
                    onChange={(e) => setTaggedFriends(e.target.value)}
                    className="bg-card"
                  />
                  <label className="grid gap-1 text-xs font-bold uppercase text-ink-muted">
                    Photos or a short video
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,video/mp4"
                      multiple
                      onChange={(e) => setMediaFiles(Array.from(e.target.files ?? []).slice(0, 4))}
                      className="text-sm normal-case"
                    />
                    <span className="font-normal normal-case">
                      Up to four JPG, PNG, WEBP, or MP4 files, 15 MB each.
                    </span>
                  </label>
                  <Button type="submit" disabled={submitReview.isPending} className="font-bold bg-terracotta text-white">
                    {submitReview.isPending ? "Posting…" : "Post Event Echo"}
                  </Button>
                </form>
              )}
            </div>
          )}

          {/* Review Cards Grid */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {filteredReviews.map((review) => {
              const rx = reviewReactions[review.id] ?? {
                likes: 3,
                liked: false,
                emojis: { fire: 2, clap: 2, heart: 3, zap: 1 },
                userEmojis: { fire: false, clap: false, heart: false, zap: false },
                comments: [],
              };
              const files = parseMedia(review.media);
              return (
                <article
                  key={review.id}
                  onClick={() => setActiveModalReview(review)}
                  className="rounded-xl border-2 border-black dark:border-white bg-elevated p-5 flex flex-col justify-between gap-4 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[4px_4px_0px_0px_#fff]"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-saffron text-black font-extrabold flex items-center justify-center border border-black text-xs font-mono">
                          {review.author_name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-sm leading-tight">{review.author_name}</p>
                          <p className="text-[10px] text-ink-muted">
                            {new Date(review.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                          </p>
                        </div>
                      </div>
                      <span className="text-saffron font-bold text-xs flex items-center gap-1" aria-label={`${review.rating} of 5 stars`}>
                        <Star size={13} fill="currentColor" /> {review.rating}.0
                      </span>
                    </div>

                    <p className="mt-3 text-sm leading-relaxed text-ink-body dark:text-slate-200 line-clamp-3 italic">
                      "{review.comment}"
                    </p>

                    {review.tagged_friends?.length > 0 && (
                      <p className="mt-2 text-[11px] text-ink-muted">
                        With {review.tagged_friends.map((f) => `@${f}`).join(", ")}
                      </p>
                    )}

                    {files.length > 0 && (
                      <div className="mt-3 rounded-lg overflow-hidden border border-line aspect-video max-h-36 bg-black">
                        <ReviewMedia file={files[0]!} />
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-line flex items-center justify-between text-xs">
                    <span className="text-[11px] font-bold text-terracotta underline flex items-center gap-1">
                      Inspect &amp; React →
                    </span>
                    <div className="flex items-center gap-2 text-ink-muted text-[11px]">
                      <span className="flex items-center gap-0.5">
                        <Heart size={12} className={rx.liked ? "fill-terracotta text-terracotta" : ""} /> {rx.likes}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <MessageSquare size={11} />
                        <span>{rx.comments.length}</span>
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}

            {filteredReviews.length === 0 && (
              <div className="col-span-full py-12 text-center border-2 border-dashed border-line rounded-xl">
                <p className="text-sm font-bold text-ink-body">No reflections found for this rating.</p>
                <button
                  type="button"
                  onClick={() => setSelectedRatingFilter("all")}
                  className="mt-2 text-xs font-bold text-terracotta underline"
                >
                  Show all reflections
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Interactive Review Modal */}
      {activeModalReview && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setActiveModalReview(null)}
        >
          <div
            className="relative w-full max-w-2xl max-h-[90vh] bg-card rounded-2xl border-2 border-black dark:border-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_#fff] overflow-y-auto p-6 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActiveModalReview(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full border border-black dark:border-white bg-elevated hover:bg-terracotta hover:text-white transition-colors"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-saffron text-black font-extrabold flex items-center justify-center border-2 border-black font-mono">
                {activeModalReview.author_name.charAt(0)}
              </div>
              <div>
                <h4 className="font-bold text-base text-ink dark:text-white leading-tight">
                  {activeModalReview.author_name}
                </h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-ink-muted">
                    {new Date(activeModalReview.created_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                  <span className="text-saffron font-bold text-xs flex items-center gap-0.5">
                    <Star size={13} fill="currentColor" /> {activeModalReview.rating}.0 / 5.0
                  </span>
                </div>
              </div>
            </div>

            {parseMedia(activeModalReview.media).length > 0 && (
              <div className="mt-4 rounded-xl overflow-hidden border-2 border-black dark:border-white bg-black">
                {parseMedia(activeModalReview.media).map((f) => (
                  <ReviewMedia key={f.path} file={f} />
                ))}
              </div>
            )}

            <p className="mt-4 text-sm leading-relaxed text-ink-body dark:text-slate-200 bg-parchment/60 dark:bg-slate-800/60 p-4 rounded-xl border-l-4 border-terracotta italic whitespace-pre-line">
              "{activeModalReview.comment}"
            </p>

            {activeModalReview.tagged_friends?.length > 0 && (
              <p className="mt-3 text-xs text-ink-muted">
                With {activeModalReview.tagged_friends.map((f) => `@${f}`).join(", ")}
              </p>
            )}

            <div className="mt-6 pt-4 border-t border-line flex flex-wrap items-center gap-2">
              {(() => {
                const rx = reviewReactions[activeModalReview.id] ?? {
                  likes: 3,
                  liked: false,
                  emojis: { fire: 2, clap: 3, heart: 4, zap: 1 },
                  userEmojis: { fire: false, clap: false, heart: false, zap: false },
                  comments: [],
                };
                return (
                  <>
                    <button
                      type="button"
                      onClick={() => toggleLike(activeModalReview.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border-2 border-black dark:border-white transition-all ${
                        rx.liked
                          ? "bg-terracotta text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                          : "bg-elevated hover:bg-parchment"
                      }`}
                    >
                      <Heart size={14} className={rx.liked ? "fill-white" : ""} />
                      <span>{rx.likes} Likes</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleReaction(activeModalReview.id, "fire")}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-bold border-2 border-black dark:border-white transition-all ${
                        rx.userEmojis.fire ? "bg-amber-400 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" : "bg-elevated hover:bg-parchment"
                      }`}
                    >
                      <Flame size={13} className="text-amber-800 shrink-0" />
                      <span>{rx.emojis.fire}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleReaction(activeModalReview.id, "clap")}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-bold border-2 border-black dark:border-white transition-all ${
                        rx.userEmojis.clap ? "bg-emerald-400 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" : "bg-elevated hover:bg-parchment"
                      }`}
                    >
                      <Award size={13} className="text-emerald-800 shrink-0" />
                      <span>{rx.emojis.clap}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleReaction(activeModalReview.id, "heart")}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-bold border-2 border-black dark:border-white transition-all ${
                        rx.userEmojis.heart ? "bg-pink-400 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" : "bg-elevated hover:bg-parchment"
                      }`}
                    >
                      <Heart size={13} className="text-pink-600 fill-pink-600 shrink-0" />
                      <span>{rx.emojis.heart}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleReaction(activeModalReview.id, "zap")}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-bold border-2 border-black dark:border-white transition-all ${
                        rx.userEmojis.zap ? "bg-cyan text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" : "bg-elevated hover:bg-parchment"
                      }`}
                    >
                      <Zap size={13} className="text-cyan-800 fill-cyan-800 shrink-0" />
                      <span>{rx.emojis.zap}</span>
                    </button>
                  </>
                );
              })()}
            </div>

            <div className="mt-6 pt-4 border-t border-line">
              <h5 className="font-bold text-xs uppercase tracking-wider text-ink-muted flex items-center gap-1.5 mb-3">
                <MessageSquare size={13} /> Community Replies ({((reviewReactions[activeModalReview.id]?.comments) ?? []).length})
              </h5>
              
              <div className="space-y-2 mb-4">
                {((reviewReactions[activeModalReview.id]?.comments) ?? []).map((c) => (
                  <div key={c.id} className="p-2.5 rounded-lg bg-elevated text-xs border border-line">
                    <div className="flex items-center justify-between font-bold">
                      <span>{c.author}</span>
                      <span className="text-[10px] text-ink-muted">{c.time}</span>
                    </div>
                    <p className="mt-1 text-ink-body dark:text-slate-300">{c.text}</p>
                  </div>
                ))}
                {((reviewReactions[activeModalReview.id]?.comments) ?? []).length === 0 && (
                  <p className="text-xs text-ink-muted italic">No replies yet. Be the first to join the conversation!</p>
                )}
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Share a thought or reply to this reflection…"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addReply(activeModalReview.id); } }}
                  className="text-xs h-9 bg-background"
                />
                <Button size="sm" onClick={() => addReply(activeModalReview.id)} className="h-9 text-xs px-3 font-bold bg-terracotta text-white">
                  Post
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clash Guardian Participant Modal */}
      {clashModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setClashModal(null)}
        >
          <div
            className="relative w-full max-w-lg bg-card rounded-2xl border-2 border-black dark:border-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_#fff] p-6 sm:p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <AlertTriangle size={24} />
              </div>
              <div>
                <span className="font-mono text-[10px] uppercase font-black tracking-widest text-terracotta">
                  Platform Safety Guardian
                </span>
                <h3 className="serif-heading text-xl font-bold">Schedule Clash Detected</h3>
              </div>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-ink-body dark:text-slate-300 bg-amber-50 dark:bg-amber-950/30 p-3.5 rounded-xl border border-amber-300 dark:border-amber-800">
              {clashModal.reason}
            </p>

            <p className="mt-3 text-[11px] text-ink-muted">
              Because both campus gatherings take place during the same time window, you will need to choose which one to attend in person. You may still reserve this pass if you plan to split your time.
            </p>

            <div className="mt-6 flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-3 pt-3 border-t border-line">
              <Button
                variant="outline"
                onClick={() => setClashModal(null)}
                className="text-xs font-bold"
              >
                Keep Existing Pass Only (Cancel)
              </Button>
              <Button
                onClick={() => {
                  setClashModal(null);
                  booking.mutate({ eventId, kind: "booked" });
                }}
                className="text-xs font-bold bg-terracotta text-white hover:bg-terracotta/90 border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                Proceed &amp; Reserve Pass Anyway
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
    </div>
  );
}

function ReviewCard({ review, canLike, canViewMedia, onLike, likedPending }: { review: ReviewRow; canLike: boolean; canViewMedia: boolean; onLike: () => void; likedPending: boolean }) {
  const files = parseMedia(review.media);
  return <article className="border-b border-line pb-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-bold">{review.author_name}</p><p className="text-xs text-ink-muted">{new Date(review.created_at).toLocaleDateString()}</p></div><p className="flex items-center gap-1 text-saffron" aria-label={`${review.rating} out of 5 stars`}><Star size={15} fill="currentColor" />{review.rating}/5</p></div>
    <p className="mt-3 whitespace-pre-line text-sm leading-6 text-ink-body">{review.comment}</p>
    {review.tagged_friends.length > 0 && <p className="mt-2 text-xs text-ink-muted">With {review.tagged_friends.join(", ")}</p>}
    {files.length > 0 && canViewMedia && <div className="mt-3 flex flex-wrap gap-3">{files.map((file) => <ReviewMedia key={file.path} file={file} />)}</div>}
    {files.length > 0 && !canViewMedia && <p className="mt-2 text-xs text-ink-muted">This moment’s photo or video is shared with its author and event team.</p>}
    {canLike && <Button variant="ghost" size="sm" className="mt-2" disabled={likedPending} onClick={onLike}>{review.liked_by_organiser ? "Liked by organiser" : "Like this moment"}</Button>}
    {review.liked_by_organiser && !canLike && <p className="mt-2 text-xs font-bold text-terracotta">Liked by the organiser</p>}
  </article>;
}

function ReviewMedia({ file }: { file: MediaItem }) {
  const isStatic = file.path.startsWith("/") || file.path.startsWith("http");
  const { data: url } = useQuery({
    queryKey: ["review-media-url", file.path],
    enabled: !isStatic,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("rangora-event-echo").createSignedUrl(file.path, 1800);
      if (error) throw error;
      return data.signedUrl;
    },
  });
  const finalUrl = isStatic ? file.path : url;
  if (!finalUrl) return <div className="flex h-24 w-32 items-center justify-center bg-parchment text-xs text-ink-muted">Loading media…</div>;
  return file.type.startsWith("video/") ? <video src={finalUrl} controls className="max-h-64 w-full max-w-sm rounded-md" aria-label={file.name} /> : <img src={finalUrl} alt={file.name} loading="lazy" className="h-36 max-w-64 rounded-md object-cover" />;
}

function EventMessage({ title, message }: { title: string; message: string }) {
  return (
    <div className="relative min-h-screen bg-ivory">
      <DotField fixed />
      <SiteHeader />
      <main className="relative z-10 mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="serif-heading text-3xl">{title}</h1>
        <p className="mt-3 text-sm text-ink-body">{message}</p>
        <Link to="/" className="btn btn-primary mt-6 inline-flex">Return to Rangora</Link>
      </main>
    </div>
  );
}

const DEFAULT_CATEGORY_GUESTS: Record<number, string[]> = {
  1: [
    "Pt. Debashish Bhattacharya (Slide Guitar Maestro)",
    "Ananya Roy (Classical Vocalist)",
    "Subhankar Sen (Cajon & Percussion)",
    "Tanmoy Mukherjee (Sound Engineer)",
  ],
  2: [
    "Smt. Tanusree Shankar (Choreographer & Movement Mentor)",
    "Purulia Chhau Troupe (Folk Dance Troupe)",
    "Dr. Arindam Mukherjee (Stage Director)",
    "Shreya Ghoshal (Guest Vocalist)",
  ],
  3: [
    "Prof. Niloy Ganguly (Keynote Professor & AI Lab Head)",
    "Debayan Das (Autonomous Robotics Lead)",
    "Dr. Arundhati Roy (Computer Systems Researcher)",
    "Vikram Malhotra (Hardware Architect)",
  ],
  4: [
    "Shri Radheshyam Pal (Master Terracotta Artisan)",
    "Debjani Basu (Textile & Indigo Researcher)",
    "Subrata Mondal (Woodblock Engraver)",
    "Kavita Sen (Ceramics Studio Lead)",
  ],
  5: [
    "Aryan 'Kronten' Sharma (Headliner Tournament Caster)",
    "Rohit Verma (Collegiate Esports Director)",
    "Megha Sengupta (Blitz Chess National Arbiter)",
    "Kabir Dey (Indie Game Designer)",
  ],
  6: [
    "Prof. Manas Ray (Cultural Historian & Film Scholar)",
    "Srijit Mukherji (Guest Film Director)",
    "Dr. Alokananda Das (Campus Heritage Architect)",
    "Ratan Paul (Master Puppeteer)",
  ],
  7: [
    "Coach Bimal Ghosh (Varsity Athletics Director)",
    "Sneha Mukherjee (National Table Tennis Seed)",
    "Rahul Bose (Campus Basketball Coach)",
    "Pooja Dey (Cross-Country Marathoner)",
  ],
  8: [
    "Prof. Soumitra Dutta (Dean & Angel Investor)",
    "Rhea Sen (Early-Stage Venture Partner)",
    "Arjun Singhania (Tech Founder & YC Alum)",
    "Dr. Partha Sarathi (Incubation Director)",
  ],
};

const ARTIST_PALETTES = [
  { bg: "#FBF8EE", border: "#C85A32", text: "#C85A32" },
  { bg: "#FBF8EE", border: "#2B6E63", text: "#2B6E63" },
  { bg: "#FBF8EE", border: "#E29D38", text: "#E29D38" },
  { bg: "#FBF8EE", border: "#23211D", text: "#23211D" },
];

const GUEST_ROLES = [
  "Special Guest",
  "Headliner Artist",
  "Keynote Speaker",
  "Guest Mentor",
  "Performing Artist",
  "Master Artisan",
];

function parseGuestInfo(raw: string, index: number) {
  let clean = raw.trim();
  let role = GUEST_ROLES[index % GUEST_ROLES.length] ?? "Special Guest";
  let photoUrl = "";

  // Check if pipe exists: "Name (Role) | PhotoURL"
  if (clean.includes("|")) {
    const parts = clean.split("|").map((p) => p.trim());
    clean = parts[0] ?? "";
    photoUrl = parts[1] ?? "";
  }

  // Check if role is in parentheses: "Dr. Radhakrishnan (Guest Professor)"
  const roleMatch = clean.match(/\(([^)]+)\)/);
  if (roleMatch && roleMatch[1]) {
    role = roleMatch[1].trim();
    clean = clean.replace(/\([^)]+\)/, "").trim();
  } else if (clean.includes(" - ")) {
    const dashParts = clean.split(" - ").map((p) => p.trim());
    clean = dashParts[0] ?? "";
    if (dashParts[1]) role = dashParts[1].trim();
  }

  return { name: clean, role, photoUrl };
}

function ArtistProfileCard({ name: rawName, index }: { name: string; index: number }) {
  const { name, role, photoUrl } = useMemo(() => parseGuestInfo(rawName, index), [rawName, index]);
  const [imgError, setImgError] = useState(false);

  const borderColors = [
    "border-terracotta dark:border-[#FF5722]",
    "border-saffron dark:border-[#F5A201]",
    "border-sage dark:border-[#3CE6FC]",
    "border-pink-600 dark:border-[#FF3B81]",
    "border-lime-600 dark:border-[#D6FD52]",
  ];
  const ringClass = borderColors[index % borderColors.length] ?? "border-terracotta";

  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  const hasPhoto = Boolean(photoUrl && !imgError);

  return (
    <div className="flex flex-col items-center text-center w-28 sm:w-32 shrink-0 group">
      <div
        className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 p-1 bg-parchment dark:bg-slate-800 shadow-md transition-transform duration-300 group-hover:scale-105 relative overflow-hidden ${ringClass}`}
      >
        {hasPhoto ? (
          <img
            src={photoUrl}
            alt={name}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover rounded-full"
          />
        ) : (
          /* BookMyShow Empty Avatar Silhouette */
          <div
            className="w-full h-full rounded-full flex flex-col items-center justify-center relative select-none bg-stone-100 dark:bg-slate-700/80"
          >
            <svg
              className="w-12 h-12 text-stone-400 dark:text-slate-300 transition-transform duration-300 group-hover:scale-110"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-label="Empty avatar silhouette"
            >
              <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
            </svg>
            {initials && (
              <span className="absolute bottom-1 right-1 font-mono text-[9px] font-bold bg-terracotta text-white px-1.5 py-0.2 rounded shadow-xs">
                {initials}
              </span>
            )}
          </div>
        )}
      </div>

      <p className="mt-2.5 font-bold text-xs sm:text-sm text-foreground dark:text-white line-clamp-1 w-full group-hover:text-terracotta transition-colors">
        {name}
      </p>
      <span className="text-[10px] sm:text-[11px] font-medium text-ink-muted dark:text-slate-300 line-clamp-1 w-full mt-0.5">
        {role}
      </span>
    </div>
  );
}
