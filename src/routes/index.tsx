import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { Calendar, MapPin, Activity, Star, Sparkles, Flag } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Faqs } from "@/components/Faqs";
import { Chatbot } from "@/components/Chatbot";
import { EventCard } from "@/components/EventCard";
import { DotField } from "@/components/DotField";
import { categories, events, festivals } from "@/data/catalog";
import { img } from "@/assets/rangora";
import { catImage } from "@/lib/category-images";
import { catById, fmtWhen, hiddenGems, matchedEvents } from "@/lib/catalog-helpers";
import { useProfile, useSeatCounts, useSession } from "@/lib/use-auth";
import { useBooking } from "@/lib/use-booking";
import { useCatalogEvents } from "@/lib/use-catalog";
import { z } from "zod";

const searchSchema = z.object({ q: z.string().optional() });

export const Route = createFileRoute("/")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Rangora — Find your kind of celebration" },
      { name: "description", content: "Discover campus festivals, workshops, hackathons and concerts. Book passes, collect badges and get events matched to you." },
      { property: "og:title", content: "Rangora — Find your kind of celebration" },
      { property: "og:description", content: "Campus festival discovery with live seat availability, badges, vouchers and personal event matches." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

type Tab = "gems" | "matched" | "pulse";

function Landing() {
  const { q } = Route.useSearch();
  const navigate = useNavigate();
  const { user, isDemo, demoRole } = useSession();
  const { data: me } = useProfile(user?.id);
  const { data: counts = {} } = useSeatCounts();
  const { events: catalogEvents } = useCatalogEvents();
  const booking = useBooking(user?.id);
  const [tab, setTab] = useState<Tab>("gems");
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [activeFestivalId, setActiveFestivalId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState(q ?? "");

  useEffect(() => { setSearchTerm(q ?? ""); }, [q]);

  const publicEvents = catalogEvents.filter((event) => event.published !== false);
  const normalizedSearch = searchTerm.trim().toLocaleLowerCase();
  let baseEvents = publicEvents;
  if (activeFestivalId) {
    baseEvents = baseEvents.filter((e) => e.festivalId === activeFestivalId);
  }
  const searchedEvents = normalizedSearch
    ? baseEvents.filter((event) => [event.name, event.subtitle, event.description, event.venue, catById(event.categoryId)?.name, festivals.find((festival) => festival.id === event.festivalId)?.name, ...(event.artists ?? [])]
        .some((value) => value?.toLocaleLowerCase().includes(normalizedSearch)))
    : baseEvents;
  const activeFestival = festivals.find((f) => f.id === activeFestivalId);
  const festEvents = activeFestivalId ? publicEvents.filter((e) => e.festivalId === activeFestivalId) : [];
  const featured = searchedEvents.filter((e) => e.featured).slice(0, 6);
  const matchingIds = new Set(searchedEvents.map((e) => e.id));
  const relatedEvents = publicEvents.filter((e) => !matchingIds.has(e.id)).slice(0, 6);

  const prefs = me?.profile?.preferences ?? [];
  const isParticipant = (!!user && me?.role === "participant") || (isDemo && demoRole === "participant");

  const shelf = useMemo(() => {
    if (tab === "gems") return hiddenGems(counts, 6, searchedEvents);
    if (tab === "pulse") return [...searchedEvents].sort((a, b) => (counts[b.id] ?? 0) / b.maxSeats - (counts[a.id] ?? 0) / a.maxSeats).slice(0, 6);
    return matchedEvents(prefs, 6, searchedEvents);
  }, [tab, counts, prefs, searchedEvents]);

  const catEvents = activeCat ? searchedEvents.filter((e) => catById(e.categoryId)?.slug === activeCat) : [];
  const act = (id: number, kind: "booked" | "planned") => booking.mutate({ eventId: id, kind });

  return (
    <div className="relative min-h-screen bg-ivory">
      <DotField fixed />
      <SiteHeader />

      {/* HERO */}
      <section className="relative overflow-hidden pb-12 pt-6 lg:pb-16 lg:pt-10">
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-6">
            <div className="space-y-6 lg:col-span-6 animate-rise">
              <div className="inline-flex items-center gap-2 border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#fff] px-3 py-1 text-xs font-black uppercase tracking-widest bg-saffron text-black rounded">
                <span className="inline-block w-2 h-2 rounded-full bg-terracotta animate-pulse" />
                <Flag size={13} className="stroke-[2.5]" />
                <span>Bengal Collegiate Fest Almanac · 2026</span>
              </div>
              <h1 className="hero-headline">Discover the pulse<br />of your <span className="inline-block px-2 py-0.5 -rotate-1 bg-terracotta text-white rounded shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_#fff]">campus.</span></h1>
              <p className="max-w-xl text-base font-medium leading-relaxed text-ink-body sm:text-lg">
                Find a festival worth remembering. Discover campus gatherings, book your place, collect badges, and share the moments that made it yours.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold font-mono uppercase rounded border border-ink/20 dark:border-white/20 bg-card">
                  <Calendar size={13} className="text-terracotta stroke-[2.5]" />
                  <span>38 Flagship Events</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold font-mono uppercase rounded border border-ink/20 dark:border-white/20 bg-card">
                  <MapPin size={13} className="text-sage stroke-[2.5]" />
                  <span>6 Campus Festivals</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold font-mono uppercase rounded border border-ink/20 dark:border-white/20 bg-card text-terracotta">
                  <Activity size={13} className="text-terracotta stroke-[2.5]" />
                  <span>Live Seat Pulse</span>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <a href="#featured-events-today" className="btn-hero-cta"><span>Find Celebrations</span><span aria-hidden="true">→</span></a>
              </div>
            </div>
            <div className="lg:col-span-6">
              <div className="hero-collage-stage" aria-label="Campus festival photo collage">
                <div className="collage-photo-frame collage-frame-left"><img src={img("cultural_dance.jpg")} alt="Students celebrating at a campus festival" /></div>
                <div className="collage-photo-frame collage-frame-top-mid"><img src={img("hero_festival.jpg")} alt="Outdoor main stage crowd" /></div>
                <div className="collage-photo-frame collage-frame-bottom-mid"><img src={img("music_concert.jpg")} alt="Live campus concert" /></div>
                <div className="collage-photo-frame collage-frame-right-pill"><img src={img("workshop_craft.jpg")} alt="Art and craft workshop" /></div>
                <div className="stay-active-stamp stay-active-bottom-left"><span>STAY</span><span>ACTIVE</span></div>
                <div className="stay-active-stamp stay-active-top-mid"><span>LIVE</span><span>PULSE</span></div>
                <div className="campus-fest-ribbon">CAMPUS FEST 2026</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE BAND */}
      <section className="feature-search-band" aria-label="Platform signature capabilities">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 divide-y divide-line sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
            {[
              ["Beyond the Hype", "Curated natural & cultural events", "#beyond-the-hype"],
              ["Seat Pulse", "Live event occupancy & availability indicators", "#beyond-the-hype"],
              ["Signature Engine", "Events matched to your preferences", "#beyond-the-hype"],
              ["Explore Categories", "Eight kinds of campus experience", "#categories"],
            ].map(([t, d, h]) => (
              <a key={t} href={h} className="feature-band-col block hover:opacity-90">
                <h2 className="font-sans text-base font-extrabold tracking-tight sm:text-lg">{t}</h2>
                <p className="mt-1 text-xs leading-snug text-ink-body">{d}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* SEARCH RESULTS OR FEATURED EVENTS */}
      {normalizedSearch ? (
        <section id="search-results" className="mx-auto max-w-7xl scroll-mt-24 px-4 pb-12 pt-10 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="font-mono text-xs uppercase tracking-widest text-terracotta font-bold">Campus Search Results</span>
              <h2 className="serif-heading mt-1 text-2xl sm:text-3xl">
                {searchedEvents.length} {searchedEvents.length === 1 ? "event" : "events"} matching <span className="inline-block px-2.5 py-0.5 -rotate-1 bg-saffron text-black rounded border-2 border-black dark:border-white shadow-[2.5px_2.5px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2.5px_2.5px_0px_0px_#fff]">“{searchTerm}”</span>
              </h2>
            </div>
            <button
              type="button"
              onClick={() => void navigate({ to: "/", search: { q: undefined } })}
              className="text-xs font-bold underline underline-offset-4 hover:opacity-80"
            >
              Clear search ×
            </button>
          </div>

          {searchedEvents.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {searchedEvents.map((e, i) => (
                <EventCard
                  key={e.id}
                  event={e}
                  index={i}
                  booked={counts[e.id] ?? 0}
                  tag={e.featured ? "Featured" : "Search match"}
                  quote={e.subtitle}
                  busy={booking.isPending}
                  onBook={isParticipant ? () => act(e.id, "booked") : undefined}
                  onPlan={isParticipant ? () => act(e.id, "planned") : undefined}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-ink-muted p-8 text-center bg-parchment">
              <p className="serif-heading text-xl">No campus events match “{searchTerm}”</p>
              <p className="mt-1 text-sm text-ink-body">
                Try searching by artist name, festival (e.g. Spic Macay, Techfest), category, or campus venue.
              </p>
              <button
                type="button"
                onClick={() => void navigate({ to: "/", search: { q: undefined } })}
                className="btn btn-primary mt-4"
              >
                Browse all {publicEvents.length} events
              </button>
            </div>
          )}

          {/* Related / Other Campus Events */}
          {relatedEvents.length > 0 && (
            <div className="mt-12 pt-8 border-t border-line">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <span className="font-mono text-xs uppercase tracking-widest text-ink-muted font-bold">Discover More</span>
                  <h3 className="serif-heading text-xl sm:text-2xl mt-1">
                    Other Campus <span className="inline-block px-2.5 py-0.5 rotate-1 bg-lime text-black rounded border-2 border-black dark:border-white shadow-[2.5px_2.5px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2.5px_2.5px_0px_0px_#fff]">Events</span> You May Like
                  </h3>
                </div>
                <a href="#categories" className="text-xs font-bold underline underline-offset-4 hover:opacity-80">
                  Browse by category →
                </a>
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {relatedEvents.map((e, i) => (
                  <EventCard
                    key={e.id}
                    event={e}
                    index={i}
                    booked={counts[e.id] ?? 0}
                    tag="Recommended"
                    quote={e.subtitle}
                    busy={booking.isPending}
                    onBook={isParticipant ? () => act(e.id, "booked") : undefined}
                    onPlan={isParticipant ? () => act(e.id, "planned") : undefined}
                  />
                ))}
              </div>
            </div>
          )}
        </section>
      ) : (
        /* FEATURED EVENTS */
        <section id="featured-events-today" className="mx-auto max-w-7xl scroll-mt-24 px-4 pb-12 pt-10 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="serif-heading text-2xl sm:text-3xl">
              Featured <span className="inline-block px-2.5 py-0.5 rotate-1 bg-saffron text-black rounded border-2 border-black dark:border-white shadow-[2.5px_2.5px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2.5px_2.5px_0px_0px_#fff]">Events</span>
            </h2>
            <a href="#categories" className="text-xs font-bold underline underline-offset-4 hover:opacity-80">
              Browse all {searchedEvents.length} campus events →
            </a>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {featured.map((e, i) => (
              <EventCard
                key={e.id}
                event={e}
                index={i}
                booked={counts[e.id] ?? 0}
                tag="Featured"
                quote={e.subtitle}
                busy={booking.isPending}
                onBook={isParticipant ? () => act(e.id, "booked") : undefined}
                onPlan={isParticipant ? () => act(e.id, "planned") : undefined}
              />
            ))}
          </div>
        </section>
      )}

      {/* BEYOND THE HYPE / SIGNATURE ENGINE */}
      <section id="beyond-the-hype" className="scroll-mt-24 border-t border-line py-12 relative z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border-2 border-black dark:border-white bg-parchment dark:bg-card p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#fff] sm:p-9">
            <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <span className="inline-block rounded-full border border-ink bg-terracotta px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary-foreground">Signature Engine · Beyond the Hype</span>
                <h2 className="serif-heading mt-3 text-3xl sm:text-4xl">
                  Underrated Workshops, Natural Gatherings &amp; Cultural <span className="inline-block px-2.5 py-0.5 rotate-1 bg-lime text-black rounded border-2 border-black dark:border-white shadow-[2.5px_2.5px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2.5px_2.5px_0px_0px_#fff]">Gems</span>
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-ink-body">Instead of only surfacing crowded concerts, Rangora balances high-demand headliners with intimate craft guilds, robotics labs, and acoustic sessions with open seats.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {([["gems", "Hidden Gems"], ["matched", "Matched to You"], ["pulse", "Campus Pulse"]] as const).map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setTab(k)}
                    className={`rounded-full border border-ink px-4 py-2 text-xs font-bold transition ${tab === k ? "bg-terracotta text-primary-foreground" : "bg-elevated text-ink"}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {tab === "matched" && !isParticipant ? (
              <MatchedPromo signedIn={!!user} />
            ) : tab === "matched" && prefs.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-ink-muted p-8 text-center">
                <p className="serif-heading text-xl">Tell us what you love</p>
                <p className="mt-1 text-sm text-ink-body">Pick your preferences in your profile and this shelf fills itself.</p>
                <Link to="/dashboard" className="btn btn-primary mt-4">Set my preferences</Link>
              </div>
            ) : (
              <div key={tab} className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {shelf.map((e, i) => (
                  <EventCard key={e.id} event={e} index={i} booked={counts[e.id] ?? 0}
                    tag={tab === "matched" ? "Matched to you" : tab === "pulse" ? "Campus pulse" : "Hidden gem"}
                    busy={booking.isPending} onBook={isParticipant ? () => act(e.id, "booked") : undefined} onPlan={isParticipant ? () => act(e.id, "planned") : undefined} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* FESTIVALS */}
      <section id="festival-highlights" className="mx-auto max-w-7xl scroll-mt-24 border-t border-line px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
          <div>
            <span className="font-mono text-xs uppercase font-extrabold tracking-widest text-terracotta">
              Umbrella Campus Celebrations
            </span>
            <h2 className="serif-heading mt-1 text-2xl sm:text-3xl font-bold">
              Major Campus <span className="inline-block px-2.5 py-0.5 -rotate-1 bg-terracotta text-white rounded border-2 border-black dark:border-white shadow-[2.5px_2.5px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2.5px_2.5px_0px_0px_#fff]">Festivals</span>
            </h2>
            <p className="mt-1 text-xs text-ink-muted max-w-xl">
              Each collegiate festival unites inter-departmental celebrations, headline concerts, theatre, and workshops. Click any festival card to explore its lineup.
            </p>
          </div>
          {activeFestivalId && (
            <button
              type="button"
              onClick={() => setActiveFestivalId(null)}
              className="btn btn-outline text-xs px-3.5 py-2 font-bold self-start sm:self-auto"
            >
              Clear festival filter ×
            </button>
          )}
        </div>
        
        <div className="no-scrollbar flex snap-x gap-5 overflow-x-auto pb-4">
          {festivals.map((f, i) => {
            const isSelected = activeFestivalId === f.id;
            const festCount = publicEvents.filter((e) => e.festivalId === f.id).length;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setActiveFestivalId(isSelected ? null : f.id)}
                className={`brutal-card animate-rise relative w-72 shrink-0 snap-start text-left cursor-pointer transition-all ${
                  isSelected
                    ? "ring-4 ring-terracotta border-terracotta shadow-[4px_4px_0px_0px_rgba(200,90,50,1)] scale-[1.02]"
                    : "hover:-translate-y-1"
                }`}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <img src={img(f.banner)} alt={f.name} className="h-40 w-full object-cover" loading="lazy" />
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-terracotta font-bold">
                      {f.start_date} → {f.end_date}
                    </p>
                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-elevated border border-line">
                      {festCount} events
                    </span>
                  </div>
                  <h3 className="serif-heading mt-1 text-lg leading-snug font-bold">{f.name}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-ink-body">{f.tagline}</p>
                  <p className="mt-3 text-[11px] font-bold text-terracotta underline">
                    {isSelected ? "Filter active (click to clear)" : "Click to view festival lineup →"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Festival Lineup Showcase */}
        {activeFestival && (
          <div className="mt-8 rounded-2xl border-2 border-black dark:border-white bg-card p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#fff]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs uppercase font-extrabold text-terracotta inline-flex items-center gap-1.5">
                    <Sparkles size={13} className="text-terracotta" />
                    <span>Active Festival Filter</span>
                  </span>
                  <span className="font-mono text-xs text-ink-muted">
                    {activeFestival.start_date} → {activeFestival.end_date}
                  </span>
                </div>
                <h3 className="serif-heading text-2xl font-bold mt-1">
                  {activeFestival.name}
                </h3>
                <p className="text-xs text-ink-muted mt-0.5 font-medium">{activeFestival.tagline}</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveFestivalId(null)}
                className="btn btn-outline text-xs px-3.5 py-2 font-bold self-start sm:self-auto"
              >
                Clear festival filter ×
              </button>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
              {festEvents.map((e, i) => (
                <EventCard
                  key={e.id}
                  event={e}
                  index={i}
                  booked={counts[e.id] ?? 0}
                  tag={fmtWhen(e.startAt).split(",")[0] ?? ""}
                  quote={e.subtitle}
                  busy={booking.isPending}
                  onBook={isParticipant ? () => act(e.id, "booked") : undefined}
                  onPlan={isParticipant ? () => act(e.id, "planned") : undefined}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* CATEGORIES */}
      <section id="categories" className="mx-auto max-w-7xl scroll-mt-24 px-4 pb-12 sm:px-6 lg:px-8">
        <h3 className="serif-heading mb-4 text-2xl">
          Explore by Experience <span className="inline-block px-2.5 py-0.5 -rotate-1 bg-cyan text-black rounded border-2 border-black dark:border-white shadow-[2.5px_2.5px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2.5px_2.5px_0px_0px_#fff]">Category</span>
        </h3>
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4 lg:grid-cols-8">
            {categories.map((c, i) => {
            const n = publicEvents.filter((e) => e.categoryId === c.id).length;
            const on = activeCat === c.slug;
            return (
              <button key={c.slug} type="button" onClick={() => setActiveCat(on ? null : c.slug)}
                className={`group brutal-card animate-rise relative aspect-[3/4] text-left ${on ? "ring-4 ring-terracotta" : ""}`}
                style={{ animationDelay: `${i * 60}ms` }}>
                <img src={catImage(c.slug)} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-110" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <p className="font-sans text-sm font-extrabold leading-tight text-ivory">{c.name}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-lime">{n} events</p>
                </div>
              </button>
            );
          })}
        </div>
        {activeCat && (
          <div className="mt-8">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <h4 className="serif-heading text-xl">{categories.find((c) => c.slug === activeCat)?.name}</h4>
                <p className="text-sm text-ink-body">{categories.find((c) => c.slug === activeCat)?.description}</p>
              </div>
              <button type="button" onClick={() => setActiveCat(null)} className="text-xs font-bold underline">Close</button>
            </div>
            <div key={activeCat} className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {catEvents.map((e, i) => (
                <EventCard key={e.id} event={e} index={i} booked={counts[e.id] ?? 0} tag={fmtWhen(e.startAt).split(",")[0] ?? ""} quote={e.subtitle}
                  busy={booking.isPending} onBook={isParticipant ? () => act(e.id, "booked") : undefined} onPlan={isParticipant ? () => act(e.id, "planned") : undefined} />
              ))}
            </div>
          </div>
        )}
      </section>

      <section id="festival-roles" className="border-y border-line bg-parchment/80 backdrop-blur-xs py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-7 max-w-2xl">
            <p className="font-mono text-xs uppercase tracking-widest text-terracotta">One campus, many ways to take part</p>
            <h2 className="serif-heading mt-2 text-3xl sm:text-4xl">
              Make the festival <span className="inline-block px-2.5 py-0.5 rotate-1 bg-terracotta text-white rounded border-2 border-black dark:border-white shadow-[2.5px_2.5px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2.5px_2.5px_0px_0px_#fff]">yours.</span>
            </h2>
            <p className="mt-2 text-sm text-ink-body">Join as a participant, bring an event to life, or help shape the whole campus calendar.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["Find your next favorite", "Book passes, follow your plan, and share an Event Echo after the last song."],
              ["Host something memorable", "Apply as an organiser. Once approved, create events, track seats, and award event badges."],
              ["Keep the campus in rhythm", "Administrators review organisers, shape festivals, and see the platform at a glance."],
            ].map(([title, copy], i) => (
              <article key={title} className="brutal-card p-6">
                <span className="font-mono text-xs font-bold text-terracotta">0{i + 1}</span>
                <h3 className="serif-heading mt-3 text-xl">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-body">{copy}</p>
                <Link to="/auth" search={{ mode: "signup" }} className="mt-5 inline-flex text-sm font-bold underline underline-offset-4">Create an account →</Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* EVENT PULSE SHOWCASE TEASER */}
      <section id="event-pulse-teaser" className="py-14 bg-ivory/80 backdrop-blur-xs border-b border-line">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
            <div className="max-w-xl">
              <span className="font-mono text-xs uppercase font-extrabold tracking-widest text-terracotta">
                Living Festival Memories
              </span>
              <h2 className="serif-heading mt-2 text-3xl sm:text-4xl font-bold">
                Event <span className="inline-block px-2.5 py-0.5 rotate-1 bg-pink text-white rounded border-2 border-black dark:border-white shadow-[2.5px_2.5px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2.5px_2.5px_0px_0px_#fff]">Pulse</span> Discovery
              </h2>
              <p className="mt-2 text-sm text-ink-body">
                Candid photographs, acoustic moments, and unvarnished attendee reflections from collegiate festivals across Bengal.
              </p>
            </div>
            <Link
              to="/pulse"
              className="inline-flex items-center gap-2 rounded-md bg-terracotta px-4 py-2.5 text-xs font-bold text-ivory hover:bg-terracotta-dark self-start md:self-auto"
            >
              Open Full Pulse Gallery →
            </Link>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                title: "Centering River Clay on Wheel",
                cat: "Hands-On Workshops",
                quote: "Loved centering local river clay on the wheel. Taking home a handmade terracotta vessel was magical!",
                author: "Maya Sen",
                event: "Mitti & Indigo: Wheel Pottery Studio",
                img: "/assets/echoes/pottery_wheel.svg",
                rating: 5,
              },
              {
                title: "Dusk Raga & Courtyard Sitar",
                cat: "Music & Sonic Arts",
                quote: "The acoustic sitar in the dusk courtyard gave everyone goosebumps! Unforgettable open-air evening.",
                author: "Aanya Sen",
                event: "Dusk Raga & Indie Folk Session",
                img: "/assets/echoes/raga_concert.svg",
                rating: 5,
              },
              {
                title: "Autonomous Lunar Rover Sprint",
                cat: "Tech & Build Sprints",
                quote: "Testing our pathfinding algorithm on the mock lunar gravel arena was intense. Calibrated LiDAR worked like a charm!",
                author: "Dev Patel",
                event: "Autonomous Rover Navigation Sprint",
                img: "/assets/echoes/robotics_sprint.svg",
                rating: 5,
              },
            ].map((card) => (
              <article key={card.title} className="brutal-card bg-paper overflow-hidden flex flex-col justify-between">
                <div className="aspect-16/10 bg-parchment overflow-hidden">
                  <img src={card.img} alt={card.title} className="h-full w-full object-cover" />
                </div>
                <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-[10px] uppercase font-bold text-terracotta">{card.cat}</span>
                      <div className="flex items-center gap-0.5 text-saffron" aria-label={`${card.rating} stars`}>
                        {Array.from({ length: card.rating }).map((_, i) => (
                          <Star key={i} size={12} className="fill-saffron text-saffron" />
                        ))}
                      </div>
                    </div>
                    <p className="serif-heading font-bold mt-1 text-base">{card.event}</p>
                    <p className="mt-2 text-xs italic text-ink-body bg-parchment/60 p-2.5 rounded border-l-2 border-terracotta">
                      "{card.quote}"
                    </p>
                  </div>
                  <div className="pt-2 border-t border-line flex items-center justify-between text-[11px] text-ink-muted">
                    <span className="font-bold text-ink">@{card.author}</span>
                    <Link to="/pulse" className="text-terracotta font-semibold hover:underline">View in Pulse →</Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <Faqs />
      <SiteFooter />
      <Chatbot />
    </div>
  );
}

/** Shown to visitors (and non-participants) instead of personal matches. */
function MatchedPromo({ signedIn }: { signedIn: boolean }) {
  const samples = ["music", "workshops", "technical"];
  return (
    <div className="grid items-center gap-8 md:grid-cols-2">
      <div className="animate-rise">
        <p className="font-mono text-xs uppercase tracking-widest text-terracotta">For participants</p>
        <h3 className="serif-heading mt-2 text-3xl">Your own festival, picked for you.</h3>
        <p className="mt-3 text-sm leading-relaxed text-ink-body">
          Tell Rangora what you love when you create your account — music, workshops, tech sprints, gaming and more. The Signature Engine then builds a personal shelf of events, badges to chase and vouchers to unlock.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          {signedIn ? (
            <Link to="/dashboard" className="btn btn-primary">Open my dashboard</Link>
          ) : (
            <>
              <Link to="/auth" search={{ mode: "signup" }} className="btn btn-primary">Create participant account →</Link>
              <Link to="/auth" search={{ mode: "login" }} className="btn btn-outline">Sign in</Link>
            </>
          )}
        </div>
      </div>
      <div className="relative h-72">
        {samples.map((s, i) => (
          <div key={s} className="brutal-card animate-float absolute w-48 bg-paper"
            style={{ left: `${i * 26}%`, top: `${[10, 30, 0][i]}%`, animationDelay: `${i * 0.8}s`, rotate: `${[-6, 3, 8][i]}deg` }}>
            <img src={catImage(s)} alt="" className="h-28 w-full object-cover" />
            <div className="p-3">
              <span className="text-[10px] font-extrabold uppercase text-terracotta">Matched to you</span>
              <p className="mt-0.5 text-xs font-bold">{categories.find((c) => c.slug === s)?.name}</p>
              <div className="mt-2 h-1.5 rounded-full bg-line"><div className="h-full rounded-full bg-sage" style={{ width: `${[40, 70, 25][i]}%` }} /></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
