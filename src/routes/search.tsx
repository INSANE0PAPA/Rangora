import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { z } from "zod";
import { Search, X, Clock, Trash2, ArrowLeft, Sparkles, Filter, Tag } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { EventCard } from "@/components/EventCard";
import { categories, festivals } from "@/data/catalog";
import { catById } from "@/lib/catalog-helpers";
import { useSeatCounts } from "@/lib/use-auth";
import { useCatalogEvents } from "@/lib/use-catalog";
import {
  getRecentSearches,
  saveRecentSearch,
  clearRecentSearches,
} from "@/lib/recent-searches";
import { Button } from "@/components/ui/button";

const searchParamSchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
});

export const Route = createFileRoute("/search")({
  validateSearch: searchParamSchema,
  head: () => ({
    meta: [
      { title: "Search Celebrations & Events | Rangora" },
      {
        name: "description",
        content:
          "Search campus festivals, workshops, hackathons, and concerts by name, artist, venue, or category on Rangora.",
      },
      { property: "og:title", content: "Search Celebrations & Events | Rangora" },
      {
        property: "og:description",
        content:
          "Discover campus festivals and events across West Bengal. Filter by category, artist, or venue with live seat availability.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q = "", category = "" } = Route.useSearch();
  const navigate = useNavigate();

  const [inputQuery, setInputQuery] = useState(q);
  const [activeCategory, setActiveCategory] = useState<string>(category);
  const [recentList, setRecentList] = useState<string[]>(() => getRecentSearches());

  const { data: seatCounts = {} } = useSeatCounts();
  const { events: catalogEvents } = useCatalogEvents();

  // Sync state with URL params
  useEffect(() => {
    setInputQuery(q);
  }, [q]);

  useEffect(() => {
    setActiveCategory(category);
  }, [category]);

  // Listen for storage changes in recent searches
  useEffect(() => {
    const handleUpdate = () => setRecentList(getRecentSearches());
    window.addEventListener("rangora:recent-searches-updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("rangora:recent-searches-updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  // Filter public events
  const publicEvents = useMemo(
    () => catalogEvents.filter((event) => event.published !== false),
    [catalogEvents]
  );

  // Search and Category filtering
  const filteredEvents = useMemo(() => {
    let result = publicEvents;

    // Filter by category slug or id if specified
    if (activeCategory && activeCategory !== "all") {
      result = result.filter((event) => {
        const cat = catById(event.categoryId);
        return (
          cat?.slug.toLowerCase() === activeCategory.toLowerCase() ||
          String(cat?.id) === activeCategory ||
          cat?.name.toLowerCase() === activeCategory.toLowerCase()
        );
      });
    }

    // Filter by search query if specified
    const term = inputQuery.trim().toLowerCase();
    if (term) {
      result = result.filter((event) => {
        const cat = catById(event.categoryId)?.name ?? "";
        const fest = festivals.find((f) => f.id === event.festivalId)?.name ?? "";
        const artists = event.artists ?? [];
        return (
          event.name.toLowerCase().includes(term) ||
          event.subtitle.toLowerCase().includes(term) ||
          event.description.toLowerCase().includes(term) ||
          event.venue.toLowerCase().includes(term) ||
          cat.toLowerCase().includes(term) ||
          fest.toLowerCase().includes(term) ||
          artists.some((a) => a.toLowerCase().includes(term))
        );
      });
    }

    return result;
  }, [publicEvents, inputQuery, activeCategory]);

  function handlePerformSearch(term: string) {
    const clean = term.trim();
    if (clean) {
      saveRecentSearch(clean);
      setRecentList(getRecentSearches());
    }
    void navigate({
      to: "/search",
      search: {
        q: clean || undefined,
        category: activeCategory || undefined,
      },
    });
  }

  function handleCategorySelect(catSlug: string) {
    const nextCat = activeCategory === catSlug ? "" : catSlug;
    setActiveCategory(nextCat);
    void navigate({
      to: "/search",
      search: {
        q: inputQuery.trim() || undefined,
        category: nextCat || undefined,
      },
    });
  }

  function handleClearAllRecent() {
    clearRecentSearches();
    setRecentList([]);
  }

  const selectedCategoryObj = categories.find(
    (c) => c.slug.toLowerCase() === activeCategory.toLowerCase()
  );

  return (
    <div className="min-h-screen bg-ivory text-ink flex flex-col justify-between">
      <SiteHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-muted hover:text-terracotta transition"
          >
            <ArrowLeft size={14} /> Back to Rangora Home
          </Link>
          <span className="text-xs text-ink-muted">/</span>
          <span className="text-xs font-bold text-ink">Search Celebrations</span>
        </div>

        {/* Search Header Banner */}
        <div className="bg-paper border-2 border-ink rounded-2xl p-6 sm:p-8 shadow-brutal mb-8">
          <div className="max-w-3xl">
            <span className="font-mono text-xs uppercase tracking-widest text-terracotta font-bold flex items-center gap-1.5">
              <Sparkles size={14} /> Campus Discovery
            </span>
            <h1 className="serif-heading text-3xl sm:text-4xl text-ink mt-2 leading-tight">
              Find Your Kind of Celebration
            </h1>
            <p className="text-sm text-ink-muted mt-2">
              Explore concerts, theatre, robotics hackathons, poetry slams, and creative workshops across campuses.
            </p>
          </div>

          {/* On-page Search Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handlePerformSearch(inputQuery);
            }}
            className="mt-6 flex flex-col sm:flex-row gap-2 max-w-2xl"
          >
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
              />
              <input
                type="search"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="Search by event title, guest, artist, college, or category…"
                className="w-full pl-10 pr-10 py-3 rounded-xl border-2 border-ink bg-ivory text-sm font-medium placeholder:text-ink-muted/70 focus:outline-none focus:ring-2 focus:ring-terracotta"
              />
              {inputQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setInputQuery("");
                    handlePerformSearch("");
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-ink-muted hover:text-ink"
                  aria-label="Clear search"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <Button
              type="submit"
              className="btn btn-primary py-3 px-6 text-sm font-bold shadow-sm"
            >
              Search
            </Button>
          </form>

          {/* Recent Searches Section */}
          {recentList.length > 0 && (
            <div className="mt-6 pt-5 border-t border-line">
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <span className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-ink-muted">
                  <Clock size={13} className="text-terracotta" /> Recent searches:
                </span>
                <button
                  type="button"
                  onClick={handleClearAllRecent}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-ink-muted hover:text-destructive transition"
                >
                  <Trash2 size={12} /> Clear recent
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentList.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => {
                      setInputQuery(term);
                      handlePerformSearch(term);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-parchment hover:bg-saffron-soft text-ink font-semibold border border-line transition shadow-xs"
                  >
                    <span>{term}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Category Filter Section */}
          <div className="mt-6 pt-5 border-t border-line">
            <span className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-ink-muted mb-3">
              <Filter size={13} className="text-sage" /> Browse & Filter by Category:
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleCategorySelect("")}
                className={`text-xs px-3.5 py-1.5 rounded-full font-bold border transition ${
                  !activeCategory
                    ? "bg-ink text-ivory border-ink shadow-sm"
                    : "bg-paper text-ink border-line hover:border-ink"
                }`}
              >
                All Categories
              </button>
              {categories.map((cat) => {
                const isSelected =
                  activeCategory.toLowerCase() === cat.slug.toLowerCase() ||
                  activeCategory === String(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategorySelect(cat.slug)}
                    className={`text-xs px-3.5 py-1.5 rounded-full font-bold border transition flex items-center gap-1.5 ${
                      isSelected
                        ? "bg-terracotta text-white border-terracotta shadow-sm"
                        : "bg-paper text-ink border-line hover:border-ink hover:bg-parchment"
                    }`}
                  >
                    <span>{cat.name}</span>
                    {isSelected && <X size={12} />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Results Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="serif-heading text-2xl text-ink">
              {filteredEvents.length}{" "}
              {filteredEvents.length === 1 ? "Celebration" : "Celebrations"} Found
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              {inputQuery && <span>Matching &ldquo;{inputQuery}&rdquo;</span>}
              {inputQuery && selectedCategoryObj && <span> in </span>}
              {selectedCategoryObj && (
                <span className="font-bold text-terracotta">
                  {selectedCategoryObj.name}
                </span>
              )}
              {!inputQuery && !selectedCategoryObj && (
                <span>Showing all published campus celebrations</span>
              )}
            </p>
          </div>

          {(inputQuery || activeCategory) && (
            <button
              type="button"
              onClick={() => {
                setInputQuery("");
                setActiveCategory("");
                void navigate({ to: "/search" });
              }}
              className="text-xs font-bold text-terracotta hover:underline inline-flex items-center gap-1"
            >
              Reset all filters
            </button>
          )}
        </div>

        {/* Events Grid */}
        {filteredEvents.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredEvents.map((ev) => (
              <EventCard
                key={ev.id}
                event={ev}
                tag={catById(ev.categoryId)?.name ?? "Featured"}
                booked={seatCounts[ev.id] ?? 0}
              />
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="text-center py-16 px-4 border-2 border-dashed border-line rounded-2xl bg-paper">
            <div className="w-14 h-14 mx-auto rounded-full bg-saffron-soft flex items-center justify-center text-terracotta mb-4 border border-saffron">
              <Search size={24} />
            </div>
            <h3 className="serif-heading text-xl text-ink font-bold">
              No campus celebrations match your search
            </h3>
            <p className="text-sm text-ink-muted max-w-md mx-auto mt-2">
              We couldn&apos;t find any events matching your criteria. Try searching for broader terms like &ldquo;Music&rdquo;, &ldquo;Dance&rdquo;, &ldquo;Robotics&rdquo;, or select a category below.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2 max-w-md mx-auto">
              {categories.slice(0, 5).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleCategorySelect(cat.slug)}
                  className="text-xs px-3 py-1.5 rounded-full bg-parchment hover:bg-saffron-soft border border-line text-ink font-semibold"
                >
                  Explore {cat.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
