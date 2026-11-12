import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { categories, festivals } from "@/data/catalog";
import { img } from "@/assets/rangora";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Heart,
  Flag,
  Share2,
  Calendar,
  MapPin,
  CheckCircle2,
  Camera,
  RotateCcw,
  Star,
  Flame,
  Zap,
  Award,
} from "lucide-react";
import { toast } from "sonner";
import type { PulseEchoItem } from "@/lib/api.functions";

interface EventPulseGalleryProps {
  initialEchoes?: PulseEchoItem[];
  onReport?: (echoId: string) => Promise<void>;
  onModerate?: (echoId: string, status: "approved" | "flagged" | "hidden") => Promise<void>;
  isAdmin?: boolean;
}

export function EventPulseGallery({
  initialEchoes = [],
  onReport,
  onModerate,
  isAdmin = false,
}: EventPulseGalleryProps) {
  const [echoes, setEchoes] = useState<PulseEchoItem[]>(initialEchoes);
  const [selectedFestival, setSelectedFestival] = useState<number | "all">("all");
  const [selectedCategory, setSelectedCategory] = useState<number | "all">("all");
  const [minRating, setMinRating] = useState<number | "all">("all");
  const [mediaOnly, setMediaOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "rating" | "liked">("recent");

  // Lightbox & reactions state
  const [activeLightboxIndex, setActiveLightboxIndex] = useState<number | null>(null);
  const [pulseReactions, setPulseReactions] = useState<Record<string, {
    likes: number;
    liked: boolean;
    emojis: { fire: number; clap: number; heart: number; zap: number };
    userEmojis: { fire: boolean; clap: boolean; heart: boolean; zap: boolean };
    comments: Array<{ id: string; author: string; text: string; time: string }>;
  }>>({});
  const [pulseReplyText, setPulseReplyText] = useState("");

  function togglePulseLike(echoId: string) {
    setPulseReactions((prev) => {
      const cur = prev[echoId] ?? {
        likes: 5,
        liked: false,
        emojis: { fire: 3, clap: 4, heart: 6, zap: 2 },
        userEmojis: { fire: false, clap: false, heart: false, zap: false },
        comments: [],
      };
      return {
        ...prev,
        [echoId]: {
          ...cur,
          likes: cur.liked ? cur.likes - 1 : cur.likes + 1,
          liked: !cur.liked,
        },
      };
    });
  }

  function togglePulseEmoji(echoId: string, emoji: "fire" | "clap" | "heart" | "zap") {
    setPulseReactions((prev) => {
      const cur = prev[echoId] ?? {
        likes: 5,
        liked: false,
        emojis: { fire: 3, clap: 4, heart: 6, zap: 2 },
        userEmojis: { fire: false, clap: false, heart: false, zap: false },
        comments: [],
      };
      const active = cur.userEmojis[emoji];
      return {
        ...prev,
        [echoId]: {
          ...cur,
          emojis: {
            ...cur.emojis,
            [emoji]: active ? cur.emojis[emoji] - 1 : cur.emojis[emoji] + 1,
          },
          userEmojis: {
            ...cur.userEmojis,
            [emoji]: !active,
          },
        },
      };
    });
  }

  function addPulseReply(echoId: string) {
    if (!pulseReplyText.trim()) return;
    setPulseReactions((prev) => {
      const cur = prev[echoId] ?? {
        likes: 5,
        liked: false,
        emojis: { fire: 3, clap: 4, heart: 6, zap: 2 },
        userEmojis: { fire: false, clap: false, heart: false, zap: false },
        comments: [],
      };
      return {
        ...prev,
        [echoId]: {
          ...cur,
          comments: [
            ...cur.comments,
            {
              id: crypto.randomUUID(),
              author: "Campus Attendee",
              text: pulseReplyText.trim(),
              time: "Just now",
            },
          ],
        },
      };
    });
    setPulseReplyText("");
    toast.success("Reply added to reflection.");
  }

  // Sync when initialEchoes changes
  useEffect(() => {
    setEchoes(initialEchoes);
  }, [initialEchoes]);

  // Filtered and sorted echoes
  const filteredEchoes = useMemo(() => {
    return echoes
      .filter((item) => {
        // Enforce public visibility and approved moderation status for regular visitors
        if (!isAdmin) {
          if (item.visibility !== "public") return false;
          if (item.moderationStatus && item.moderationStatus !== "approved") return false;
        }

        if (selectedFestival !== "all" && item.festivalId !== selectedFestival) return false;
        if (selectedCategory !== "all" && item.categoryId !== selectedCategory) return false;
        if (minRating !== "all" && item.rating < minRating) return false;
        if (mediaOnly && (!item.media || item.media.length === 0)) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchComment = item.comment.toLowerCase().includes(q);
          const matchAuthor = item.authorName.toLowerCase().includes(q);
          const matchEvent = item.eventName.toLowerCase().includes(q);
          const matchVenue = item.venue.toLowerCase().includes(q);
          const matchTags = item.taggedFriends?.some((tag) => tag.toLowerCase().includes(q));
          if (!matchComment && !matchAuthor && !matchEvent && !matchVenue && !matchTags) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "rating") return b.rating - a.rating;
        if (sortBy === "liked") return Number(b.likedByOrganiser) - Number(a.likedByOrganiser);
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [echoes, selectedFestival, selectedCategory, minRating, mediaOnly, searchQuery, sortBy, isAdmin]);

  const activeFiltersCount =
    (selectedFestival !== "all" ? 1 : 0) +
    (selectedCategory !== "all" ? 1 : 0) +
    (minRating !== "all" ? 1 : 0) +
    (mediaOnly ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0);

  function resetFilters() {
    setSelectedFestival("all");
    setSelectedCategory("all");
    setMinRating("all");
    setMediaOnly(false);
    setSearchQuery("");
    setSortBy("recent");
  }

  // Keyboard navigation for Lightbox
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (activeLightboxIndex === null) return;
      if (e.key === "Escape") {
        setActiveLightboxIndex(null);
      } else if (e.key === "ArrowLeft") {
        setActiveLightboxIndex((prev) =>
          prev !== null && prev > 0 ? prev - 1 : filteredEchoes.length - 1
        );
      } else if (e.key === "ArrowRight") {
        setActiveLightboxIndex((prev) =>
          prev !== null && prev < filteredEchoes.length - 1 ? prev + 1 : 0
        );
      }
    },
    [activeLightboxIndex, filteredEchoes.length]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const activeEcho = activeLightboxIndex !== null ? filteredEchoes[activeLightboxIndex] : null;

  async function handleReport(echoId: string) {
    if (confirm("Flag this campus moment for administrator review?")) {
      try {
        if (onReport) {
          await onReport(echoId);
        }
        setEchoes((prev) =>
          prev.map((e) => (e.id === echoId ? { ...e, moderationStatus: "flagged" } : e))
        );
        toast.success("Thank you. This review has been submitted for administrative moderation.");
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Could not submit report.");
      }
    }
  }

  return (
    <div className="space-y-8">
      {/* Search & Filter Toolbar */}
      <section className="brutal-card p-5 bg-elevated shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" size={17} />
            <Input
              type="search"
              aria-label="Search campus moments"
              placeholder="Search by event, keyword, attendee, or friend…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 bg-background border-line text-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Quick Selectors & Sort */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Festival selector */}
            <select
              aria-label="Filter by festival"
              value={selectedFestival}
              onChange={(e) =>
                setSelectedFestival(e.target.value === "all" ? "all" : Number(e.target.value))
              }
              className="h-10 rounded-md border border-input bg-background px-3 text-xs font-semibold text-ink-body"
            >
              <option value="all">All Festivals</option>
              {festivals.map((fest) => (
                <option key={fest.id} value={fest.id}>
                  {fest.name}
                </option>
              ))}
            </select>

            {/* Rating selector */}
            <select
              aria-label="Filter by rating"
              value={minRating}
              onChange={(e) =>
                setMinRating(e.target.value === "all" ? "all" : Number(e.target.value))
              }
              className="h-10 rounded-md border border-input bg-background px-3 text-xs font-semibold text-ink-body"
            >
              <option value="all">Any Rating</option>
              <option value="5">5 Stars Only</option>
              <option value="4">4+ Stars</option>
              <option value="3">3+ Stars</option>
            </select>

            {/* Media toggle button */}
            <button
              type="button"
              onClick={() => setMediaOnly((prev) => !prev)}
              className={`h-10 flex items-center gap-1.5 px-3 rounded-md border text-xs font-semibold transition-colors ${
                mediaOnly
                  ? "bg-terracotta text-ivory border-terracotta"
                  : "bg-background text-ink-body border-input hover:bg-parchment"
              }`}
            >
              <Camera size={14} />
              Photos Only
            </button>

            {/* Sort order */}
            <select
              aria-label="Sort order"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "recent" | "rating" | "liked")}
              className="h-10 rounded-md border border-input bg-background px-3 text-xs font-semibold text-ink-body"
            >
              <option value="recent">Most Recent</option>
              <option value="rating">Highest Rating</option>
              <option value="liked">Organiser Picks</option>
            </select>

            {/* Reset button if filters active */}
            {activeFiltersCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="h-10 text-xs text-ink-muted hover:text-ink gap-1 px-2"
              >
                <RotateCcw size={13} />
                Reset ({activeFiltersCount})
              </Button>
            )}
          </div>
        </div>

        {/* Category Pills */}
        <div className="mt-4 pt-3 border-t border-line flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[10px] uppercase font-bold text-ink-muted mr-1">
            Category:
          </span>
          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              selectedCategory === "all"
                ? "bg-ink text-paper"
                : "bg-background border border-line text-ink-body hover:bg-parchment"
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-terracotta text-ivory shadow-xs"
                    : "bg-background border border-line text-ink-body hover:bg-parchment"
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: cat.accent || "#C85A32" }}
                />
                {cat.name}
              </button>
            );
          })}
        </div>
      </section>

      {/* Gallery Header Summary */}
      <div className="flex items-center justify-between text-xs text-ink-muted px-1">
        <p>
          Showing <strong className="text-ink">{filteredEchoes.length}</strong> living campus moments
          {activeFiltersCount > 0 && " with active filters"}
        </p>
        <span className="font-mono uppercase text-[11px] tracking-wider text-terracotta font-semibold">
          Bengal Festival Pulse · Verified Attendees
        </span>
      </div>

      {/* Masonry / Responsive Grid */}
      {filteredEchoes.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredEchoes.map((echo, index) => {
            const hasMedia = echo.media && echo.media.length > 0;
            const primaryMedia = hasMedia ? echo.media[0] : null;
            const mediaUrl = primaryMedia
              ? primaryMedia.path.startsWith("/") || primaryMedia.path.startsWith("http")
                ? primaryMedia.path
                : img(primaryMedia.name)
              : null;

            return (
              <article
                key={echo.id}
                className="brutal-card bg-paper flex flex-col justify-between overflow-hidden transition-transform duration-200 hover:-translate-y-1 hover:shadow-md border-[1.5px] border-line"
              >
                {/* Media Header / Preview */}
                {hasMedia && mediaUrl && (
                  <div
                    className="relative aspect-4/3 bg-parchment overflow-hidden cursor-pointer group"
                    onClick={() => setActiveLightboxIndex(index)}
                  >
                    <img
                      src={mediaUrl}
                      alt={echo.eventName}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                      <span className="text-ivory text-xs font-semibold flex items-center gap-1.5">
                        <Camera size={14} />
                        View full moment &amp; photos
                      </span>
                    </div>

                    {/* Organiser Pick Badge Overlay */}
                    {echo.likedByOrganiser && (
                      <span className="absolute top-2.5 left-2.5 rounded-full bg-saffron text-ink font-bold text-[10px] uppercase tracking-wider px-2.5 py-0.5 flex items-center gap-1 shadow-xs border border-ink/20">
                        <Heart size={11} className="fill-terracotta text-terracotta" />
                        Organiser Pick
                      </span>
                    )}

                    {/* Media count pill if multiple */}
                    {echo.media.length > 1 && (
                      <span className="absolute top-2.5 right-2.5 rounded-full bg-ink/75 text-ivory text-[10px] font-bold px-2 py-0.5 backdrop-blur-xs">
                        +{echo.media.length - 1} more
                      </span>
                    )}
                  </div>
                )}

                {/* Card Body */}
                <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                  <div>
                    {/* Tags & Rating Header */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] uppercase font-bold text-terracotta">
                        {echo.categoryName}
                      </span>
                      <div className="flex items-center gap-0.5 text-saffron text-xs font-bold" aria-label={`Rating: ${echo.rating} out of 5`}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            size={11}
                            className={i < echo.rating ? "fill-saffron text-saffron" : "text-ink/20"}
                          />
                        ))}
                        <span className="ml-1 text-[11px] text-ink font-mono">{echo.rating}.0</span>
                      </div>
                    </div>

                    {/* Event Name */}
                    <h3 className="serif-heading text-lg font-bold mt-1 leading-snug line-clamp-2">
                      <Link
                        to="/events/$eventId"
                        params={{ eventId: String(echo.eventId) }}
                        className="hover:text-terracotta transition-colors"
                      >
                        {echo.eventName}
                      </Link>
                    </h3>

                    {/* Venue & Festival meta */}
                    <p className="text-[11px] text-ink-muted flex items-center gap-1 mt-1">
                      <MapPin size={12} />
                      {echo.venue} · {echo.festivalName}
                    </p>

                    {/* Review Commentary Quote */}
                    <p className="mt-3 text-sm text-ink-body leading-relaxed italic line-clamp-4 bg-parchment/50 p-3 rounded-md border-l-2 border-terracotta">
                      "{echo.comment}"
                    </p>

                    {/* Tagged Friends */}
                    {echo.taggedFriends && echo.taggedFriends.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1 items-center">
                        <span className="text-[10px] text-ink-muted">With:</span>
                        {echo.taggedFriends.map((friend) => (
                          <span
                            key={friend}
                            className="text-[10px] font-medium bg-elevated px-1.5 py-0.5 rounded text-ink-body border border-line"
                          >
                            @{friend}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer Author & Actions */}
                  <div className="pt-3 border-t border-line flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-saffron-soft text-terracotta border border-terracotta/40 font-bold text-xs flex items-center justify-center font-mono">
                        {echo.authorName.charAt(0)}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-ink leading-none">{echo.authorName}</p>
                        <p className="text-[10px] text-ink-muted leading-tight mt-0.5">
                          {new Date(echo.createdAt).toLocaleDateString("en-IN", {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActiveLightboxIndex(index)}
                        className="h-8 text-xs font-semibold px-2 hover:bg-parchment text-terracotta"
                      >
                        Inspect
                      </Button>
                      <button
                        type="button"
                        onClick={() => handleReport(echo.id)}
                        title="Report inappropriate review"
                        aria-label="Report echo"
                        className="p-1.5 text-ink-muted hover:text-destructive rounded transition-colors"
                      >
                        <Flag size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Admin moderation pill if admin view */}
                  {isAdmin && (
                    <div className="mt-2 pt-2 border-t border-line flex items-center justify-between text-[11px]">
                      <span className="font-mono uppercase text-ink-muted">
                        Status: <strong>{echo.moderationStatus}</strong>
                      </span>
                      {onModerate && (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => onModerate(echo.id, "approved")}
                            className="px-2 py-0.5 text-[10px] bg-sage-soft text-sage font-bold rounded"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => onModerate(echo.id, "flagged")}
                            className="px-2 py-0.5 text-[10px] bg-saffron-soft text-terracotta font-bold rounded"
                          >
                            Flag
                          </button>
                          <button
                            type="button"
                            onClick={() => onModerate(echo.id, "hidden")}
                            className="px-2 py-0.5 text-[10px] bg-destructive/10 text-destructive font-bold rounded"
                          >
                            Hide
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="brutal-card p-12 text-center bg-paper">
          <p className="serif-heading text-2xl font-bold text-ink">No moments match these filters</p>
          <p className="mt-2 text-sm text-ink-muted max-w-md mx-auto">
            Try choosing a different festival, removing category restrictions, or resetting the search keywords.
          </p>
          <Button onClick={resetFilters} className="mt-5" variant="outline">
            Clear all filters
          </Button>
        </div>
      )}

      {/* =========================================================================
          ACCESSIBLE FULLSCREEN LIGHTBOX MODAL
          - Close button
          - Escape key listener
          - Keyboard left/right arrow navigation
          - High resolution media preview
          - Full un-truncated commentary and attendee details
         ========================================================================= */}
      {activeEcho && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Event Echo for ${activeEcho.eventName}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 backdrop-blur-sm p-4 sm:p-6"
          onClick={() => setActiveLightboxIndex(null)}
        >
          {/* Modal Container */}
          <div
            className="relative w-full max-w-4xl max-h-[90vh] bg-paper rounded-xl overflow-hidden border-2 border-line shadow-2xl flex flex-col md:flex-row"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setActiveLightboxIndex(null)}
              aria-label="Close lightbox"
              className="absolute top-3 right-3 z-20 p-2 rounded-full bg-ink/75 text-ivory hover:bg-ink transition-colors"
            >
              <X size={18} />
            </button>

            {/* Previous Button */}
            <button
              type="button"
              onClick={() =>
                setActiveLightboxIndex((prev) =>
                  prev !== null && prev > 0 ? prev - 1 : filteredEchoes.length - 1
                )
              }
              aria-label="Previous echo"
              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-ink/75 text-ivory hover:bg-ink transition-colors md:left-4"
            >
              <ChevronLeft size={20} />
            </button>

            {/* Next Button */}
            <button
              type="button"
              onClick={() =>
                setActiveLightboxIndex((prev) =>
                  prev !== null && prev < filteredEchoes.length - 1 ? prev + 1 : 0
                )
              }
              aria-label="Next echo"
              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-ink/75 text-ivory hover:bg-ink transition-colors md:right-[380px]"
            >
              <ChevronRight size={20} />
            </button>

            {/* Left Side: Media Display */}
            <div className="flex-1 bg-black flex items-center justify-center min-h-[300px] max-h-[50vh] md:max-h-[85vh] overflow-hidden">
              {activeEcho.media && activeEcho.media.length > 0 && activeEcho.media[0] ? (
                (() => {
                  const item = activeEcho.media[0];
                  if (!item) return null;
                  const url = item.path.startsWith("/") || item.path.startsWith("http")
                    ? item.path
                    : img(item.name);
                  return item.type?.startsWith("video/") ? (
                    <video
                      src={url}
                      controls
                      autoPlay
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <img
                      src={url}
                      alt={activeEcho.eventName}
                      className="max-h-full max-w-full object-contain"
                    />
                  );
                })()
              ) : (
                <div className="p-8 text-center text-ivory/70">
                  <Camera size={48} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-serif">Text-only Event Echo</p>
                </div>
              )}
            </div>

            {/* Right Side / Sidebar: Echo Details */}
            <div className="w-full md:w-96 p-6 overflow-y-auto max-h-[50vh] md:max-h-[85vh] flex flex-col justify-between gap-5 bg-paper">
              <div className="space-y-4">
                {/* Event Category & Organiser Pick */}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs uppercase font-extrabold text-terracotta">
                    {activeEcho.categoryName}
                  </span>
                  {activeEcho.likedByOrganiser && (
                    <span className="rounded-full bg-saffron text-ink font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 flex items-center gap-1 border border-ink/20">
                      <Heart size={10} className="fill-terracotta text-terracotta" />
                      Organiser Pick
                    </span>
                  )}
                </div>

                {/* Event Title */}
                <div>
                  <h2 className="serif-heading text-xl font-bold leading-tight">
                    {activeEcho.eventName}
                  </h2>
                  <p className="text-xs text-ink-muted mt-1 flex items-center gap-1">
                    <MapPin size={12} />
                    {activeEcho.venue} · {activeEcho.festivalName}
                  </p>
                </div>

                {/* Star Rating */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5 text-saffron text-base font-bold">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={14}
                        className={i < activeEcho.rating ? "fill-saffron text-saffron" : "text-ink/20"}
                      />
                    ))}
                  </div>
                  <span className="font-mono text-xs font-bold text-ink-body">
                    {activeEcho.rating}.0 out of 5
                  </span>
                </div>

                {/* Full Un-truncated Commentary */}
                <div className="bg-parchment p-4 rounded-lg border-l-4 border-terracotta">
                  <p className="text-xs font-mono uppercase font-bold text-ink-muted mb-1">
                    Attendee Reflection
                  </p>
                  <p className="text-sm leading-relaxed text-ink-body whitespace-pre-wrap">
                    {activeEcho.comment}
                  </p>
                </div>

                {/* Tagged Friends */}
                {activeEcho.taggedFriends && activeEcho.taggedFriends.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-ink-muted uppercase font-mono">
                      Campus Friends Tagged
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {activeEcho.taggedFriends.map((f) => (
                        <span
                          key={f}
                          className="text-xs font-medium bg-elevated px-2 py-0.5 rounded-full border border-line text-ink"
                        >
                          @{f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {/* Live Reactions Bar */}
                <div className="pt-3 border-t border-line flex flex-wrap items-center gap-1.5">
                  {(() => {
                    const rx = pulseReactions[activeEcho.id] ?? {
                      likes: 5,
                      liked: false,
                      emojis: { fire: 3, clap: 4, heart: 6, zap: 2 },
                      userEmojis: { fire: false, clap: false, heart: false, zap: false },
                      comments: [],
                    };
                    return (
                      <>
                        <button
                          type="button"
                          onClick={() => togglePulseLike(activeEcho.id)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border transition-all ${
                            rx.liked
                              ? "bg-terracotta text-white border-terracotta"
                              : "bg-elevated hover:bg-parchment border-line"
                          }`}
                        >
                          <Heart size={12} className={rx.liked ? "fill-white" : ""} />
                          <span>{rx.likes}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => togglePulseEmoji(activeEcho.id, "fire")}
                          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold border transition-all ${
                            rx.userEmojis.fire ? "bg-amber-400 text-black border-black" : "bg-elevated hover:bg-parchment border-line"
                          }`}
                        >
                          <Flame size={12} className="text-amber-800 shrink-0" />
                          <span>{rx.emojis.fire}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => togglePulseEmoji(activeEcho.id, "clap")}
                          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold border transition-all ${
                            rx.userEmojis.clap ? "bg-emerald-400 text-black border-black" : "bg-elevated hover:bg-parchment border-line"
                          }`}
                        >
                          <Award size={12} className="text-emerald-800 shrink-0" />
                          <span>{rx.emojis.clap}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => togglePulseEmoji(activeEcho.id, "heart")}
                          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold border transition-all ${
                            rx.userEmojis.heart ? "bg-pink-400 text-white border-black" : "bg-elevated hover:bg-parchment border-line"
                          }`}
                        >
                          <Heart size={12} className="text-pink-600 fill-pink-600 shrink-0" />
                          <span>{rx.emojis.heart}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => togglePulseEmoji(activeEcho.id, "zap")}
                          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold border transition-all ${
                            rx.userEmojis.zap ? "bg-cyan text-black border-black" : "bg-elevated hover:bg-parchment border-line"
                          }`}
                        >
                          <Zap size={12} className="text-cyan-800 fill-cyan-800 shrink-0" />
                          <span>{rx.emojis.zap}</span>
                        </button>
                      </>
                    );
                  })()}
                </div>

                {/* Comments & Replies */}
                <div className="pt-3 border-t border-line space-y-2">
                  <p className="text-xs font-bold uppercase font-mono text-ink-muted">
                    Community Comments ({((pulseReactions[activeEcho.id]?.comments) ?? []).length})
                  </p>
                  <div className="space-y-1.5 max-h-28 overflow-y-auto">
                    {((pulseReactions[activeEcho.id]?.comments) ?? []).map((c) => (
                      <div key={c.id} className="p-2 rounded bg-elevated text-xs border border-line">
                        <div className="flex items-center justify-between font-bold">
                          <span>{c.author}</span>
                          <span className="text-[10px] text-ink-muted">{c.time}</span>
                        </div>
                        <p className="mt-0.5 text-ink-body">{c.text}</p>
                      </div>
                    ))}
                    {((pulseReactions[activeEcho.id]?.comments) ?? []).length === 0 && (
                      <p className="text-[11px] text-ink-muted italic">No comments yet. Be first to react!</p>
                    )}
                  </div>
                  <div className="flex gap-1.5 pt-1">
                    <Input
                      placeholder="Comment on this moment…"
                      value={pulseReplyText}
                      onChange={(e) => setPulseReplyText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addPulseReply(activeEcho.id); } }}
                      className="text-xs h-8 bg-background"
                    />
                    <Button size="sm" onClick={() => addPulseReply(activeEcho.id)} className="h-8 text-xs px-2.5 font-bold bg-terracotta text-white">
                      Reply
                    </Button>
                  </div>
                </div>
              </div>

              {/* Author Info & Actions Footer */}
              <div className="pt-4 border-t border-line space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-full bg-saffron-soft text-terracotta border border-terracotta/40 font-bold text-sm flex items-center justify-center font-mono">
                      {activeEcho.authorName.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-ink">{activeEcho.authorName}</p>
                      <p className="text-xs text-ink-muted">
                        Verified Attendee ·{" "}
                        {new Date(activeEcho.createdAt).toLocaleDateString("en-IN", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => handleReport(activeEcho.id)}
                    className="text-xs text-ink-muted hover:text-destructive flex items-center gap-1 transition-colors"
                  >
                    <Flag size={12} />
                    Report moment
                  </button>
                  <span className="text-[11px] font-mono text-ink-muted">
                    Moment {(activeLightboxIndex ?? 0) + 1} of {filteredEchoes.length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
