import type { REvent } from "@/data/catalog";
import { img } from "@/assets/rangora";
import { catById, fmtWhen, pulse } from "@/lib/catalog-helpers";
import { Link, useNavigate } from "@tanstack/react-router";
import { MapPin, Calendar } from "lucide-react";

type Props = {
  event: REvent;
  booked: number;
  tag?: string;
  quote?: string;
  index?: number;
  onBook?: (() => void) | undefined;
  onPlan?: (() => void) | undefined;
  busy?: boolean;
};

/**
 * Editorial campus event card:
 * - Entire card area is clickable, directly navigating to the full event description page
 * - Clear capacity enforcement: when seats are filled, displays "Event Closed · Sold Out"
 * - Action buttons ("Details", "Book Pass", "+ Plan") preserve independent click actions
 */
export function EventCard({
  event,
  booked,
  tag = "Hidden gem",
  quote,
  index = 0,
  onBook,
  onPlan,
  busy,
}: Props) {
  const navigate = useNavigate();
  const p = pulse(booked, event.maxSeats);
  const cat = catById(event.categoryId);
  const isSoldOut = p.left === 0 || booked >= event.maxSeats;

  function handleCardClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    // Prevent double navigation if clicking directly on a button or link
    if (target.closest("button") || target.closest("a")) return;
    void navigate({ to: "/events/$eventId", params: { eventId: String(event.id) } });
  }

  function handleBookClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (isSoldOut) return;
    if (onBook) {
      onBook();
    } else {
      void navigate({ to: "/events/$eventId", params: { eventId: String(event.id) } });
    }
  }

  function handlePlanClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (isSoldOut) return;
    if (onPlan) {
      onPlan();
    } else {
      void navigate({ to: "/events/$eventId", params: { eventId: String(event.id) } });
    }
  }

  return (
    <article
      onClick={handleCardClick}
      className="event-card animate-rise h-full cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl group"
      style={{ animationDelay: `${index * 80}ms` }}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          void navigate({ to: "/events/$eventId", params: { eventId: String(event.id) } });
        }
      }}
      aria-label={`View full event description for ${event.name}`}
    >
      <div className="event-card-media relative overflow-hidden">
        <Link
          to="/events/$eventId"
          params={{ eventId: String(event.id) }}
          aria-label={`View details for ${event.name}`}
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={img(event.poster)}
            alt={event.name}
            loading="lazy"
            className="transition-transform duration-500 group-hover:scale-105"
          />
        </Link>
        <span
          className={`event-tag absolute left-3 top-3 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide backdrop-blur-md shadow-md z-10 ${
            isSoldOut
              ? "bg-destructive text-white border border-destructive"
              : "bg-paper/95 text-ink border border-ink/30"
          }`}
        >
          {isSoldOut ? "Closed · Full" : tag}
        </span>
        <span className="event-price absolute right-3 top-3 rounded-md px-2.5 py-1 text-xs font-black shadow-md bg-ink text-ivory border border-ivory/25 tracking-wide z-10">
          {event.price > 0 ? `₹${event.price}` : "FREE"}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
            {cat?.name ?? "Campus"}
          </span>
          {isSoldOut && (
            <span className="font-mono text-[10px] font-bold uppercase text-destructive tracking-wider">
              Event Closed
            </span>
          )}
        </div>

        <h3 className="serif-heading mt-1 text-xl leading-snug group-hover:text-terracotta transition-colors">
          <Link
            to="/events/$eventId"
            params={{ eventId: String(event.id) }}
            onClick={(e) => e.stopPropagation()}
          >
            {event.name}
          </Link>
        </h3>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1">
            <MapPin size={12} className="text-terracotta shrink-0" />
            <span>{event.venue}</span>
          </span>
          <span className="inline-flex items-center gap-1 font-mono text-[11px]">
            <Calendar size={12} className="text-sage shrink-0" />
            <span>{fmtWhen(event.startAt)}</span>
          </span>
        </div>

        <p className="mt-3 text-xs italic leading-relaxed text-ink-body line-clamp-2">
          “{quote ?? `Intimate session (${p.left} of ${event.maxSeats} places open) — worth discovering before word spreads.`}”
        </p>

        <div className="mt-auto pt-4">
          <div className={`seat-pulse-wrap ${p.cls}`}>
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="flex items-center gap-1.5">
                <span className={`pulse-dot ${isSoldOut ? "!bg-destructive" : ""}`} />
                {isSoldOut ? "Event Closed · Sold Out" : `${p.label} · ${p.left} of ${event.maxSeats} open`}
              </span>
              <span className="font-mono text-[10px] text-ink-muted">
                {booked}/{event.maxSeats}
              </span>
            </div>
            <div className="seat-pulse-bar-track mt-1">
              <div
                className={`seat-pulse-bar-fill ${isSoldOut ? "!bg-destructive" : ""}`}
                style={{ width: `${Math.max(4, p.ratio * 100)}%` }}
              />
            </div>
          </div>

          <div
            className="mt-3 flex gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              disabled={busy || isSoldOut}
              onClick={handleBookClick}
              className={`btn flex-1 text-xs py-1.5 ${
                isSoldOut
                  ? "bg-ink-muted/30 text-ink-muted cursor-not-allowed border border-line"
                  : "btn-primary"
              }`}
            >
              {isSoldOut ? "Event Closed" : "Book Pass"}
            </button>

            {!isSoldOut && (
              <button
                type="button"
                disabled={busy}
                onClick={handlePlanClick}
                className="btn btn-outline text-xs px-3 py-1.5"
              >
                + Plan
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
