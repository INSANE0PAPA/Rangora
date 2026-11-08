import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useEffect, useState, useRef, useMemo } from "react";
import { Moon, Sun, Search, X, Sparkles } from "lucide-react";
import { useSession, clearStoredDemoSession } from "@/lib/use-auth";
import { useCatalogEvents } from "@/lib/use-catalog";
import { categories } from "@/data/catalog";
import { catById, festById, fmtWhen } from "@/lib/catalog-helpers";
import { saveRecentSearch } from "@/lib/recent-searches";
import { img } from "@/assets/rangora";

export function SiteHeader({ hub }: { hub?: string }) {
  const { user, ready, isDemo, demoRole } = useSession();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const { events: allCatalogEvents } = useCatalogEvents();

  useEffect(() => {
    let preferred: "light" | "dark" = "light";
    try {
      const saved = window.localStorage.getItem("rangora_theme");
      preferred = saved === "dark" || saved === "light"
        ? saved
        : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } catch {
      preferred = "light";
    }
    setTheme(preferred);
    document.documentElement.dataset["theme"] = preferred;
    document.documentElement.classList.toggle("dark", preferred === "dark");
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset["theme"] = next;
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      window.localStorage.setItem("rangora_theme", next);
    } catch {
      // Theme remains available for this session if storage is blocked.
    }
  }

  // Filter events dynamically for the instant search dropdown
  const normalizedSearch = search.trim().toLowerCase();
  const matchingEvents = useMemo(() => {
    if (!normalizedSearch || normalizedSearch.length < 1) return [];
    return allCatalogEvents
      .filter((e) => e.published !== false)
      .filter((e) => {
        const cat = catById(e.categoryId)?.name ?? "";
        const fest = festById(e.festivalId)?.name ?? "";
        const artists = e.artists ?? [];
        return (
          e.name.toLowerCase().includes(normalizedSearch) ||
          e.subtitle.toLowerCase().includes(normalizedSearch) ||
          e.venue.toLowerCase().includes(normalizedSearch) ||
          cat.toLowerCase().includes(normalizedSearch) ||
          fest.toLowerCase().includes(normalizedSearch) ||
          artists.some((a) => a.toLowerCase().includes(normalizedSearch))
        );
      });
  }, [allCatalogEvents, normalizedSearch]);

  // Filter categories matching search
  const matchingCategories = useMemo(() => {
    if (!normalizedSearch || normalizedSearch.length < 1) return [];
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(normalizedSearch) ||
        c.slug.toLowerCase().includes(normalizedSearch)
    );
  }, [normalizedSearch]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSearchSubmit(e?: React.FormEvent, customQuery?: string, customCategory?: string) {
    if (e) e.preventDefault();
    const query = (customQuery !== undefined ? customQuery : search).trim();
    if (query) {
      saveRecentSearch(query);
    }
    setDropdownOpen(false);
    void navigate({
      to: "/search" as any,
      search: {
        q: query || undefined,
        category: customCategory || undefined,
      } as any,
    });
  }

  return (
    <header className="site-header">
      <div className="header-inner">
        <div className="flex items-center gap-3">
          <Link to="/" className="brand-wordmark" aria-label="Rangora Home">
            <span>RANGORA</span>
            <span className="brand-sparkle" aria-hidden="true">R</span>
          </Link>
          {hub && <span className="hub-label">{hub}</span>}
        </div>

        {/* Instant Search Bar with Live Autocomplete Dropdown */}
        <div ref={searchContainerRef} className="relative flex-1 max-w-md">
          <form
            className="header-search relative"
            role="search"
            onSubmit={handleSearchSubmit}
          >
            <label htmlFor="site-event-search" className="sr-only">
              Search campus events, artists, venues
            </label>
            <Search size={16} aria-hidden="true" className="shrink-0 text-ink-muted" />
            <input
              id="site-event-search"
              type="search"
              value={search}
              autoComplete="off"
              onFocus={() => {
                if (search.trim().length > 0) setDropdownOpen(true);
              }}
              onChange={(event) => {
                setSearch(event.target.value);
                setDropdownOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") setDropdownOpen(false);
              }}
              placeholder="Find events, artists, venues…"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setDropdownOpen(false);
                }}
                className="p-1 text-ink-muted hover:text-ink"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
            <Button
              variant="ghost"
              size="icon"
              type="submit"
              aria-label="Submit search"
            >
              <Search size={16} aria-hidden="true" />
            </Button>
          </form>

          {/* Autocomplete Dropdown Menu */}
          {dropdownOpen && normalizedSearch.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-2 z-50 overflow-hidden rounded-xl border-2 border-ink bg-paper shadow-2xl animate-rise">
              <div className="px-3.5 py-2 border-b border-line text-[11px] font-mono uppercase tracking-wider text-ink-muted flex items-center justify-between bg-parchment/60">
                <span>Matching campus events ({matchingEvents.length})</span>
                <span className="text-[10px]">Press Enter to open Search</span>
              </div>

              {/* Matching Category Quick Jumps */}
              {matchingCategories.length > 0 && (
                <div className="px-3 py-2 bg-saffron-soft/60 border-b border-line flex items-center gap-2 flex-wrap text-xs">
                  <span className="text-[10px] font-mono uppercase font-bold text-terracotta">Category:</span>
                  {matchingCategories.slice(0, 3).map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        saveRecentSearch(cat.name);
                        setDropdownOpen(false);
                        setSearch("");
                        void navigate({
                          to: "/search" as any,
                          search: { category: cat.slug } as any,
                        });
                      }}
                      className="px-2 py-0.5 rounded-full bg-paper border border-ink/25 text-xs font-bold hover:border-terracotta hover:text-terracotta transition shadow-xs"
                    >
                      {cat.name} ↵
                    </button>
                  ))}
                </div>
              )}

              {matchingEvents.length > 0 ? (
                <>
                  <div className="max-h-72 overflow-y-auto divide-y divide-line">
                    {matchingEvents.slice(0, 5).map((ev) => (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => {
                          saveRecentSearch(ev.name);
                          void navigate({
                            to: "/events/$eventId",
                            params: { eventId: String(ev.id) },
                          });
                          setDropdownOpen(false);
                          setSearch("");
                        }}
                        className="w-full flex items-center gap-3 p-3 text-left hover:bg-parchment transition duration-150 group"
                      >
                        <img
                          src={img(ev.poster)}
                          alt=""
                          className="w-11 h-11 object-cover rounded-md border border-ink shrink-0 group-hover:scale-105 transition-transform"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-sm text-ink truncate group-hover:text-terracotta">
                            {ev.name}
                          </p>
                          <p className="text-xs text-ink-muted truncate">
                            {catById(ev.categoryId)?.name ?? "Campus"} · {fmtWhen(ev.startAt).split(",")[0]} · {ev.venue}
                          </p>
                        </div>
                        <span className="font-mono text-xs font-bold text-terracotta shrink-0">
                          {ev.price > 0 ? `₹${ev.price}` : "Free"}
                        </span>
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSearchSubmit()}
                    className="w-full py-2.5 px-4 text-center text-xs font-bold text-terracotta bg-parchment hover:bg-parchment/80 border-t border-line transition block"
                  >
                    View all {matchingEvents.length} search results in dedicated Search page →
                  </button>
                </>
              ) : (
                <div className="p-5 text-center">
                  <p className="text-sm font-bold text-ink">No events match “{search}”</p>
                  <p className="text-xs text-ink-muted mt-1">
                    Press Enter to search platform or browse categories.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleSearchSubmit()}
                    className="btn btn-outline text-xs mt-3 px-3 py-1.5 inline-flex"
                  >
                    Open Search page for “{search}”
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 sm:gap-5">
          <nav className="hidden items-center gap-5 md:flex" aria-label="Primary">
            <Link to="/" hash="categories" className="nav-link-item">
              Categories
            </Link>
            <Link to="/pulse" className="nav-link-item">
              Event Pulse
            </Link>
            {ready && user && (
              <Link to="/dashboard" className="nav-link-item font-bold text-terracotta hover:underline">
                Dashboard
              </Link>
            )}
            <Link to="/" hash="faqs" className="nav-link-item">
              FAQs
            </Link>
          </nav>

          {/* Active Demo Role Indicator Badge */}
          {ready && isDemo && demoRole && (
            <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-terracotta bg-terracotta/10 px-3 py-1 text-xs font-bold text-terracotta">
              <Link to="/demo" className="hover:underline flex items-center gap-1.5" title="Active in Demo Workspace">
                <Sparkles size={13} className="text-terracotta" />
                <span>Demo: {user?.user_metadata?.["full_name"] ?? "Participant"} ({demoRole})</span>
              </Link>
              <button
                type="button"
                onClick={clearStoredDemoSession}
                title="Exit Demo Mode"
                className="ml-1 text-ink-muted hover:text-ink font-bold text-sm leading-none"
                aria-label="Exit demo session"
              >
                ×
              </button>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            type="button"
            suppressHydrationWarning
            onClick={toggleTheme}
            className="theme-toggle-btn"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            {theme === "dark" ? <Sun aria-hidden="true" size={16} /> : <Moon aria-hidden="true" size={16} />}
          </Button>

          {ready && user ? (
            <Link to="/dashboard" className="user-avatar-btn" aria-label="Open my dashboard">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="user-avatar-status-dot" />
            </Link>
          ) : (
            <Link to="/auth" search={{ mode: "login" }} className="btn-signin-pill">
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
