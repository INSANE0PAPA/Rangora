/**
 * ============================================================================
 * RANGORA — Frontend Application Controller (static/js/app.js)
 * Connects the 3 primary Flask templates (index.html, auth.html, dashboard.html)
 * to the Python Flask + Neon PostgreSQL backend in backend.py.
 * ============================================================================
 */

(function () {
  "use strict";

  const state = {
    allEvents: [],
    festivals: [],
    categories: [],
    venues: [],
    beyondTheHype: { hidden_gems: [], interest_matches: [], trending: [] },
    registeredEventIds: new Set(),
    activeHypeTab: "hidden_gems",
    activeCategory: "all",
    searchQuery: "",
    selectedFestival: "all",
    selectedVenue: "all",
    selectedAvailability: "all",
    modalEvent: null,
    dashboardData: null,
    heroSlideIndex: 0,
    activeOauthProvider: "google",
  };

  // --------------------------------------------------------------------------
  // UTILITIES & TOAST NOTIFICATIONS
  // --------------------------------------------------------------------------
  function showToast(message, type = "info") {
    const container = document.getElementById("toastContainer");
    if (!container) return;
    const card = document.createElement("div");
    card.className = `toast-card ${type === "success" ? "toast-success" : type === "error" ? "toast-error" : ""}`;
    card.textContent = message;
    container.appendChild(card);
    setTimeout(() => {
      card.remove();
    }, 4500);
  }

  function formatDateTime(isoStr) {
    if (!isoStr) return "";
    try {
      const dt = new Date(isoStr);
      return dt.toLocaleString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (_e) {
      return String(isoStr).slice(0, 16).replace("T", " ");
    }
  }

  function formatPrice(val) {
    const num = Number(val || 0);
    return num === 0 ? "Free Entry" : `₹${num.toFixed(0)}`;
  }

  function renderSeatPulseHTML(pulse) {
    if (!pulse) return "";
    const toneClass = `pulse-${pulse.tone || "available"}`;
    return `
      <div class="seat-pulse-wrap ${toneClass}">
        <div class="flex items-center justify-between text-xs font-semibold">
          <span class="inline-flex items-center gap-1.5">
            <span class="pulse-dot"></span>
            <span>${pulse.label}</span>
          </span>
          <span class="font-mono text-[11px] text-[#47384F]">${pulse.confirmed}/${pulse.capacity} booked</span>
        </div>
        <div class="seat-pulse-bar-track">
          <div class="seat-pulse-bar-fill" style="width: ${Math.min(100, pulse.fill_percent)}%"></div>
        </div>
      </div>
    `;
  }

  // --------------------------------------------------------------------------
  // PAGE 1: LANDING PAGE LOGIC
  // --------------------------------------------------------------------------
  async function initLandingPage() {
    try {
      const res = await fetch("/api/events");
      const data = await res.json();
      if (!data.ok) {
        showToast(data.error || "Could not load events from backend.", "error");
        return;
      }
      state.allEvents = data.events || [];
      state.festivals = data.festivals || [];
      state.categories = data.categories || [];
      state.venues = data.venues || [];
      state.beyondTheHype = data.beyond_the_hype || { hidden_gems: [], interest_matches: [], trending: [] };
      state.registeredEventIds = new Set(data.registered_event_ids || []);

      initHeroBubbleEffect();
      renderHeroSpotlight();
      renderCategoryShowcaseGrid();
      renderFestivalsRail();
      renderBeyondTheHype();
      renderCategoryPills();
      renderCategoryFilterRail();
      initFaqAccordion();
      populateFilterSelects();
      renderCatalogEvents();
      bindLandingListeners();
    } catch (err) {
      showToast("Network error while contacting backend.py.", "error");
    }
  }

  function initHeroBubbleEffect() {
    const heroSection = document.getElementById("heroInteractiveSection");
    const container = document.getElementById("heroBubbleContainer");
    if (!heroSection || !container) return;

    // Graceful check for prefers-reduced-motion
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let lastSpawnTime = 0;
    let lastX = 0;
    let lastY = 0;

    function spawnBubble(clientX, clientY) {
      const now = performance.now();
      if (now - lastSpawnTime < 35) return; // throttle: max 1 spawn per 35ms

      const rect = heroSection.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      // Require some movement
      const dist = Math.hypot(x - lastX, y - lastY);
      if (dist < 8) return;

      lastSpawnTime = now;
      lastX = x;
      lastY = y;

      // Cap maximum simultaneous bubbles in DOM to 32 for high performance
      if (container.children.length > 32) {
        container.firstElementChild?.remove();
      }

      const bubble = document.createElement("div");
      bubble.className = "hero-bubble";

      // Small jitter around cursor
      const offsetX = (Math.random() - 0.5) * 24;
      const offsetY = (Math.random() - 0.5) * 16;
      const posX = x + offsetX;
      const posY = y + offsetY;

      // Size variation: 12px to 32px
      const size = Math.floor(Math.random() * 20) + 12;
      // Drift X: -40px to +40px
      const driftX = (Math.random() - 0.5) * 80;
      // Float duration: 1.6s to 2.4s
      const duration = (Math.random() * 0.8 + 1.6).toFixed(2);

      bubble.style.width = `${size}px`;
      bubble.style.height = `${size}px`;
      bubble.style.left = `${posX}px`;
      bubble.style.top = `${posY}px`;
      bubble.style.setProperty("--drift-x", `${driftX.toFixed(1)}px`);
      bubble.style.animationDuration = `${duration}s`;

      // 25% chance of elegant pop near the end of life
      const willPop = Math.random() < 0.25;
      if (willPop) {
        const popTime = Math.max(800, (duration * 1000) - 400);
        setTimeout(() => {
          bubble.classList.add("pop");
        }, popTime);
      }

      container.appendChild(bubble);

      // Clean up DOM after animation completes
      setTimeout(() => {
        bubble.remove();
      }, duration * 1000 + 100);
    }

    // Pointer / mousemove inside hero section only
    heroSection.addEventListener("pointermove", (e) => {
      spawnBubble(e.clientX, e.clientY);
    }, { passive: true });

    // Touchmove for mobile devices
    heroSection.addEventListener("touchmove", (e) => {
      if (e.touches && e.touches.length > 0) {
        spawnBubble(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });
  }

  function getSpotlightEvents() {
    const pub = state.allEvents.filter((e) => e.status === "published");
    const feat = pub.filter((e) => e.is_featured);
    return (feat.length >= 3 ? feat : pub).slice(0, 4);
  }

  function renderHeroSpotlight() {
    const slides = getSpotlightEvents();
    if (!slides.length) return;
    if (state.heroSlideIndex >= slides.length) state.heroSlideIndex = 0;
    if (state.heroSlideIndex < 0) state.heroSlideIndex = slides.length - 1;

    const current = slides[state.heroSlideIndex];
    const imgEl = document.getElementById("heroSpotlightImg");
    const badgeEl = document.getElementById("heroSpotlightBadge");
    const festEl = document.getElementById("heroSpotlightFestival");
    const dateEl = document.getElementById("heroSpotlightDate");
    const venueEl = document.getElementById("heroSpotlightVenue");
    const titleEl = document.getElementById("heroSpotlightTitle");
    const descEl = document.getElementById("heroSpotlightDesc");
    const priceEl = document.getElementById("heroSpotlightPrice");
    const pulseEl = document.getElementById("heroSpotlightPulse");
    const promoEl = document.getElementById("heroSpotlightPromoTag");
    const bookBtn = document.getElementById("heroSpotlightBookBtn");

    if (imgEl) imgEl.src = current.poster_path || "/static/images/hero_festival.jpg";
    if (badgeEl) badgeEl.textContent = `${current.category_name} Spotlight`;
    if (festEl) festEl.textContent = current.festival_name;
    if (dateEl) dateEl.textContent = formatDateTime(current.start_at);
    if (venueEl) venueEl.textContent = current.venue_name || "Campus Main Stage";
    if (titleEl) titleEl.textContent = current.event_name;
    if (descEl) descEl.textContent = current.subtitle || current.description;
    if (priceEl) priceEl.textContent = formatPrice(current.ticket_price);
    if (pulseEl && current.seat_pulse) {
      pulseEl.textContent = `● ${current.seat_pulse.label} (${current.seat_pulse.confirmed}/${current.seat_pulse.capacity})`;
    }
    if (promoEl) {
      const hasPassReward = current.is_featured || (current.ticket_price === 0);
      promoEl.classList.toggle("hidden", !hasPassReward);
      if (hasPassReward) {
        promoEl.textContent = current.ticket_price === 0 ? "Free Entry · Stamp Eligible" : "Pass Reward Eligible";
      }
    }
    if (bookBtn) {
      bookBtn.setAttribute("data-open-event", String(current.event_id));
    }

    // Carousel Dots Indicator
    const dotsContainer = document.getElementById("spotlightDots");
    if (dotsContainer) {
      dotsContainer.innerHTML = slides
        .map(
          (_, idx) => `
          <button
            type="button"
            data-spotlight-dot="${idx}"
            class="transition-all rounded-full ${
              idx === state.heroSlideIndex
                ? "w-5 h-2 bg-[#B8336A]"
                : "w-2 h-2 bg-[#CEBFA8] hover:bg-[#76667E]"
            }"
            aria-label="Go to spotlight slide ${idx + 1}"
          ></button>
        `
        )
        .join("");
      dotsContainer.querySelectorAll("[data-spotlight-dot]").forEach((btn) => {
        btn.addEventListener("click", () => {
          state.heroSlideIndex = Number(btn.getAttribute("data-spotlight-dot") || 0);
          renderHeroSpotlight();
        });
      });
    }

    // Floating On-Image Carousel Controls
    const prevOnCard = document.getElementById("spotlightCardPrevBtn");
    const nextOnCard = document.getElementById("spotlightCardNextBtn");
    if (prevOnCard && !prevOnCard.dataset.bound) {
      prevOnCard.dataset.bound = "true";
      prevOnCard.addEventListener("click", (e) => {
        e.stopPropagation();
        state.heroSlideIndex -= 1;
        renderHeroSpotlight();
      });
    }
    if (nextOnCard && !nextOnCard.dataset.bound) {
      nextOnCard.dataset.bound = "true";
      nextOnCard.addEventListener("click", (e) => {
        e.stopPropagation();
        state.heroSlideIndex += 1;
        renderHeroSpotlight();
      });
    }

    // Touch Swipe Support on Spotlight Card
    const spotCard = document.getElementById("heroSpotlightCard");
    if (spotCard && !spotCard.dataset.swipeBound) {
      spotCard.dataset.swipeBound = "true";
      let touchStartX = 0;
      spotCard.addEventListener("touchstart", (e) => {
        if (e.changedTouches && e.changedTouches.length) {
          touchStartX = e.changedTouches[0].screenX;
        }
      }, { passive: true });
      spotCard.addEventListener("touchend", (e) => {
        if (e.changedTouches && e.changedTouches.length) {
          const touchEndX = e.changedTouches[0].screenX;
          const diff = touchStartX - touchEndX;
          if (Math.abs(diff) > 40) {
            if (diff > 0) state.heroSlideIndex += 1;
            else state.heroSlideIndex -= 1;
            renderHeroSpotlight();
          }
        }
      }, { passive: true });
    }

    const miniRow = document.getElementById("heroMiniCardsRow");
    if (miniRow) {
      miniRow.innerHTML = slides
        .slice(0, 3)
        .map(
          (ev, idx) => `
          <button
            type="button"
            data-hero-idx="${idx}"
            class="hero-mini-card text-left p-3 rounded-2xl border transition ${
              idx === state.heroSlideIndex
                ? "bg-[#23162B] text-white border-[#C85A32] shadow-md"
                : "bg-white text-[#23162B] border-[#E4D9C8] hover:border-[#C85A32]"
            }"
          >
            <span class="block text-[10px] font-mono uppercase tracking-wider ${
              idx === state.heroSlideIndex ? "text-[#FDF3E1]" : "text-[#C85A32]"
            }">${ev.category_name}</span>
            <strong class="block text-xs serif-heading truncate mt-0.5">${ev.event_name}</strong>
            <span class="block text-[10px] ${
              idx === state.heroSlideIndex ? "text-[#E4D9C8]" : "text-[#76667E]"
            } mt-0.5">${formatPrice(ev.ticket_price)}</span>
          </button>
        `
        )
        .join("");

      miniRow.querySelectorAll(".hero-mini-card").forEach((btn) => {
        btn.addEventListener("click", () => {
          state.heroSlideIndex = Number(btn.getAttribute("data-hero-idx") || 0);
          renderHeroSpotlight();
        });
      });
    }
  }

  function renderCategoryFilterRail() {
    const rail = document.getElementById("categoryFilterRail");
    if (!rail) return;

    const categories = [
      { slug: "all", name: "All Experiences" },
      ...state.categories.map((c) => ({ slug: c.slug, name: c.category_name })),
    ];

    rail.innerHTML = categories
      .map(
        (cat) => `
        <button
          type="button"
          data-rail-cat="${cat.slug}"
          class="cat-rail-btn px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition border ${
            state.activeCategory === cat.slug
              ? "active bg-[#B8336A] text-white border-[#B8336A] shadow-sm"
              : "bg-[#FAF6F0] text-[#47384F] hover:bg-[#F3ECE1] border-[#E4D9C8]"
          }"
        >
          ${cat.name}
        </button>
      `
      )
      .join("");

    rail.querySelectorAll(".cat-rail-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.activeCategory = btn.getAttribute("data-rail-cat") || "all";
        renderCategoryFilterRail();
        renderCategoryPills();
        renderCatalogEvents();
        document.getElementById("discover-events")?.scrollIntoView({ behavior: "smooth" });
      });
    });

    const leftBtn = document.getElementById("catRailScrollLeftBtn");
    const rightBtn = document.getElementById("catRailScrollRightBtn");
    if (leftBtn && !leftBtn.dataset.bound) {
      leftBtn.dataset.bound = "true";
      leftBtn.addEventListener("click", () => {
        rail.scrollBy({ left: -260, behavior: "smooth" });
      });
    }
    if (rightBtn && !rightBtn.dataset.bound) {
      rightBtn.dataset.bound = "true";
      rightBtn.addEventListener("click", () => {
        rail.scrollBy({ left: 260, behavior: "smooth" });
      });
    }
  }

  function initFaqAccordion() {
    document.querySelectorAll(".faq-item").forEach((item) => {
      const btn = item.querySelector(".faq-question-btn");
      const panel = item.querySelector(".faq-answer-panel");
      if (!btn || !panel || btn.dataset.bound) return;
      btn.dataset.bound = "true";
      btn.addEventListener("click", () => {
        const isCurrentlyOpen = !panel.classList.contains("hidden");
        document.querySelectorAll(".faq-item").forEach((other) => {
          if (other !== item) {
            other.classList.remove("active");
            other.querySelector(".faq-answer-panel")?.classList.add("hidden");
          }
        });
        item.classList.toggle("active", !isCurrentlyOpen);
        panel.classList.toggle("hidden", isCurrentlyOpen);
      });
    });
  }

  function getCategorySVGIcon(slug) {
    const s = String(slug || '').toLowerCase();
    if (s.includes('tech')) {
      return `<svg class="w-6 h-6 text-[#2B6E63]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M3 9h2m-2 6h2m16-6h2m-2 6h2M7 5h10a2 2 0 012 2v10a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2zm4 4h2v6h-2z"/></svg>`;
    }
    if (s.includes('cult')) {
      return `<svg class="w-6 h-6 text-[#8C2D4B]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18zm-3-10a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm9 0a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm-7 4c1 1.5 3 1.5 4 0"/></svg>`;
    }
    if (s.includes('music')) {
      return `<svg class="w-6 h-6 text-[#C85A32]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12 0c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/></svg>`;
    }
    if (s.includes('game') || s.includes('esport')) {
      return `<svg class="w-6 h-6 text-[#C85A32]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 11h4m-2-2v4m7-1h.01m3-2h.01M5 7h14a3 3 0 013 3v4a3 3 0 01-3 3l-2.5 3.5a1.5 1.5 0 01-2.5-1.2V17H10v2.3a1.5 1.5 0 01-2.5 1.2L5 17a3 3 0 01-3-3v-4a3 3 0 013-3z"/></svg>`;
    }
    if (s.includes('workshop')) {
      return `<svg class="w-6 h-6 text-[#D48C28]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>`;
    }
    if (s.includes('sport')) {
      return `<svg class="w-6 h-6 text-[#2B6E63]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-2 0-3 1-3 3 0 2 2 3 3 3s3-1 3-3c0-2-1-3-3-3zm0 0V4m-6 4a6 6 0 0012 0M6 8a6 6 0 0112 0m-9 9l3 3 3-3m-3 3v-6"/></svg>`;
    }
    if (s.includes('comm')) {
      return `<svg class="w-6 h-6 text-[#23162B]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>`;
    }
    if (s.includes('entrepreneur')) {
      return `<svg class="w-6 h-6 text-[#D48C28]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>`;
    }
    return `<svg class="w-6 h-6 text-[#C85A32]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>`;
  }

  function renderCategoryShowcaseGrid() {
    const grid = document.getElementById("categoryShowcaseGrid");
    if (!grid) return;
    grid.innerHTML = state.categories
      .map((c) => {
        const count = state.allEvents.filter((e) => e.category_slug === c.slug).length;
        const iconSvg = getCategorySVGIcon(c.slug);
        return `
          <button
            type="button"
            data-showcase-cat="${c.slug}"
            class="cat-showcase-card text-left p-4 rounded-2xl bg-white border border-[#E4D9C8] hover:border-[#C85A32] hover:shadow-md transition flex flex-col justify-between"
          >
            <div class="mb-3.5 p-2.5 rounded-xl bg-[#FAF6F0] w-fit border border-[#E4D9C8]">${iconSvg}</div>
            <div>
              <h3 class="text-sm serif-heading text-[#23162B]">${c.category_name}</h3>
              <p class="text-[11px] text-[#76667E] mt-0.5">${count} experiences</p>
            </div>
          </button>
        `;
      })
      .join("");

    grid.querySelectorAll(".cat-showcase-card").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.activeCategory = btn.getAttribute("data-showcase-cat") || "all";
        renderCategoryPills();
        renderCatalogEvents();
        document.getElementById("discover-events")?.scrollIntoView({ behavior: "smooth" });
      });
    });
  }

  function renderFestivalsRail() {
    const grid = document.getElementById("festivalsGrid");
    if (!grid) return;
    const pubFestivals = state.festivals.filter((f) => f.status === "published").slice(0, 3);
    grid.innerHTML = pubFestivals
      .map(
        (f) => `
      <article class="bg-white rounded-2xl border border-[#CEBFA8] overflow-hidden shadow-sm flex flex-col justify-between">
        <div class="relative h-44 bg-[#23162B]">
          <img src="${f.banner_path || "/static/images/hero_festival.jpg"}" alt="${f.name}" class="w-full h-full object-cover" />
          <div class="absolute top-3 left-3 px-3 py-1 rounded-full bg-[#23162B]/85 text-[#FDF3E1] text-[11px] font-mono">
            ${f.start_date} &rarr; ${f.end_date}
          </div>
        </div>
        <div class="p-5 flex-1 flex flex-col justify-between">
          <div>
            <span class="text-[11px] font-bold uppercase tracking-widest text-[#C85A32]">${f.theme || "Campus Celebration"}</span>
            <h3 class="text-xl serif-heading mt-1 mb-2">${f.name}</h3>
            <p class="text-xs text-[#47384F] leading-relaxed">${f.description || ""}</p>
          </div>
          <div class="pt-4 mt-4 border-t border-[#E4D9C8] flex items-center justify-between">
            <span class="text-xs font-semibold text-[#2B6E63]">Active Lineup</span>
            <button type="button" data-filter-fest="${f.festival_id}" class="fest-jump-btn text-xs font-bold text-[#23162B] underline underline-offset-4 hover:text-[#C85A32]">
              Filter Events &rarr;
            </button>
          </div>
        </div>
      </article>
    `
      )
      .join("");

    grid.querySelectorAll(".fest-jump-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const fid = btn.getAttribute("data-filter-fest");
        const sel = document.getElementById("filterFestivalSelect");
        if (sel) sel.value = fid;
        state.selectedFestival = fid;
        renderCatalogEvents();
        document.getElementById("discover-events")?.scrollIntoView({ behavior: "smooth" });
      });
    });
  }

  function renderBeyondTheHype() {
    const grid = document.getElementById("beyondHypeGrid");
    if (!grid) return;
    const shelf = state.beyondTheHype[state.activeHypeTab] || [];
    if (!shelf.length) {
      grid.innerHTML = `<p class="text-sm text-[#E4D9C8] col-span-3">No recommendations in this shelf right now.</p>`;
      return;
    }
    grid.innerHTML = shelf
      .map(
        (ev) => `
      <article class="bg-[#FAF6F0] text-[#23162B] rounded-2xl p-5 border border-[#CEBFA8] flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between gap-2 mb-3">
            <span class="px-2.5 py-1 rounded-full bg-[#FBECE6] text-[#C85A32] text-[11px] font-bold uppercase tracking-wider">
              ${ev.recommendation_badge || "Curated"}
            </span>
            <span class="text-xs font-mono font-semibold text-[#47384F]">${formatPrice(ev.ticket_price)}</span>
          </div>
          <h3 class="text-xl serif-heading mb-1">${ev.event_name}</h3>
          <p class="text-xs text-[#76667E] mb-3">${ev.festival_name} · ${ev.venue_name}</p>
          <p class="text-xs bg-[#F3ECE1] p-3 rounded-xl border border-[#E4D9C8] text-[#47384F] italic mb-4">
            “${ev.recommendation_reason}”
          </p>
        </div>
        <div>
          ${renderSeatPulseHTML(ev.seat_pulse)}
          <div class="flex items-center justify-between mt-4 pt-3 border-t border-[#E4D9C8]">
            <span class="text-xs text-[#47384F] font-medium">${formatDateTime(ev.start_at)}</span>
            <button type="button" data-open-event="${ev.event_id}" class="open-event-btn btn btn-plum text-xs py-1.5 px-3.5">
              View &amp; Book
            </button>
          </div>
        </div>
      </article>
    `
      )
      .join("");

    bindOpenEventButtons(grid);
  }

  function renderCategoryPills() {
    const bar = document.getElementById("categoryFilterBar");
    if (!bar) return;
    const pillsHTML = [
      `<button type="button" data-cat="all" class="cat-pill px-4 py-1.5 rounded-full text-xs font-semibold ${
        state.activeCategory === "all" ? "bg-[#23162B] text-white" : "bg-white text-[#47384F] border border-[#CEBFA8]"
      }">All Categories</button>`,
      ...state.categories.map(
        (c) => `
        <button type="button" data-cat="${c.slug}" class="cat-pill px-4 py-1.5 rounded-full text-xs font-semibold ${
          state.activeCategory === c.slug ? "bg-[#C85A32] text-white" : "bg-white text-[#47384F] border border-[#CEBFA8]"
        }">
          ${c.category_name}
        </button>
      `
      ),
    ].join("");
    bar.innerHTML = pillsHTML;

    bar.querySelectorAll(".cat-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.activeCategory = btn.getAttribute("data-cat") || "all";
        renderCategoryPills();
        renderCatalogEvents();
      });
    });
  }

  function populateFilterSelects() {
    const festSel = document.getElementById("filterFestivalSelect");
    if (festSel) {
      festSel.innerHTML =
        `<option value="all">All Festivals</option>` +
        state.festivals.map((f) => `<option value="${f.festival_id}">${f.name}</option>`).join("");
    }
    const venueSel = document.getElementById("filterVenueSelect");
    if (venueSel) {
      venueSel.innerHTML =
        `<option value="all">All Campus Venues</option>` +
        state.venues.map((v) => `<option value="${v.venue_id}">${v.venue_name} (Cap ${v.capacity})</option>`).join("");
    }
  }

  function renderCatalogEvents() {
    const grid = document.getElementById("eventsCatalogGrid");
    const countLabel = document.getElementById("eventCountLabel");
    if (!grid) return;

    const q = state.searchQuery.toLowerCase();
    const filtered = state.allEvents.filter((ev) => {
      if (state.activeCategory !== "all" && ev.category_slug !== state.activeCategory) return false;
      if (state.selectedFestival !== "all" && String(ev.festival_id) !== String(state.selectedFestival)) return false;
      if (state.selectedVenue !== "all" && String(ev.venue_id) !== String(state.selectedVenue)) return false;
      if (state.selectedAvailability === "open" && (!ev.seat_pulse || !ev.seat_pulse.can_register)) return false;
      if (state.selectedAvailability === "free" && Number(ev.ticket_price) > 0) return false;
      if (q) {
        const hay = `${ev.event_name} ${ev.subtitle || ""} ${ev.description} ${ev.festival_name} ${ev.venue_name} ${ev.category_name}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (countLabel) countLabel.textContent = String(filtered.length);

    if (!filtered.length) {
      grid.innerHTML = `
        <div class="col-span-full bg-white p-10 rounded-2xl border border-[#E4D9C8] text-center">
          <h3 class="text-xl serif-heading mb-2">No matching festival experiences found</h3>
          <p class="text-xs text-[#76667E] mb-4">Try clearing your keyword filter or switching back to All Categories.</p>
          <button id="resetFiltersBtn" type="button" class="btn btn-outline text-xs">Reset All Filters</button>
        </div>
      `;
      document.getElementById("resetFiltersBtn")?.addEventListener("click", () => {
        state.activeCategory = "all";
        state.searchQuery = "";
        state.selectedFestival = "all";
        state.selectedVenue = "all";
        state.selectedAvailability = "all";
        const sInput = document.getElementById("filterSearchInput");
        if (sInput) sInput.value = "";
        renderCategoryPills();
        populateFilterSelects();
        renderCatalogEvents();
      });
      return;
    }

    grid.innerHTML = filtered
      .map((ev) => {
        const isRegistered = state.registeredEventIds.has(Number(ev.event_id));
        return `
        <article class="event-card">
          <div class="event-card-media">
            <img src="${ev.poster_path || "/static/images/hero_festival.jpg"}" alt="${ev.event_name}" />
            <div class="absolute top-3 left-3 flex flex-wrap gap-1.5">
              <span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#23162B]/90 text-white">
                ${ev.category_name}
              </span>
              ${
                ev.is_featured
                  ? `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#C85A32] text-white">Featured</span>`
                  : ""
              }
            </div>
            <div class="absolute bottom-3 right-3 px-3 py-1 rounded-full bg-white/95 text-[#23162B] text-xs font-mono font-bold shadow">
              ${formatPrice(ev.ticket_price)}
            </div>
          </div>

          <div class="p-5 flex-1 flex flex-col justify-between">
            <div>
              <p class="text-[11px] font-bold uppercase tracking-wider text-[#C85A32] mb-1">${ev.festival_name}</p>
              <h3 class="text-xl serif-heading mb-1.5">${ev.event_name}</h3>
              <p class="text-xs text-[#47384F] line-clamp-2 mb-3">${ev.subtitle || ev.description}</p>

              <div class="space-y-1 text-xs text-[#47384F] mb-3">
                <div><strong>When:</strong> ${formatDateTime(ev.start_at)}</div>
                <div><strong>Where:</strong> ${ev.venue_name}</div>
              </div>
            </div>

            <div>
              ${renderSeatPulseHTML(ev.seat_pulse)}
              <div class="ticket-divider"></div>
              <div class="flex items-center justify-between gap-2">
                ${
                  isRegistered
                    ? `<span class="text-xs font-bold text-[#2B6E63]">✓ Registered in My Passes</span>`
                    : `<span class="text-xs text-[#76667E]">${ev.seat_pulse.can_register ? "Instant confirmation" : "Closed"}</span>`
                }
                <button type="button" data-open-event="${ev.event_id}" class="open-event-btn btn ${
                  isRegistered ? "btn-outline" : "btn-primary"
                } text-xs py-2 px-4">
                  ${isRegistered ? "View Pass Details" : ev.seat_pulse.can_register ? "View & Register" : "View Details"}
                </button>
              </div>
            </div>
          </div>
        </article>
      `;
      })
      .join("");

    bindOpenEventButtons(grid);
  }

  function bindOpenEventButtons(container) {
    container.querySelectorAll(".open-event-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const eid = Number(btn.getAttribute("data-open-event"));
        const ev = state.allEvents.find((x) => Number(x.event_id) === eid);
        if (ev) openEventModal(ev);
      });
    });
  }

  function openEventModal(ev) {
    state.modalEvent = ev;
    const modal = document.getElementById("eventDetailModal");
    if (!modal) return;

    document.getElementById("modalFestivalBadge").textContent = ev.festival_name;
    document.getElementById("modalEventTitle").textContent = ev.event_name;
    document.getElementById("modalEventImage").src = ev.poster_path || "/static/images/hero_festival.jpg";
    document.getElementById("modalEventDescription").textContent = ev.description;
    document.getElementById("modalEventCategory").textContent = ev.category_name;
    document.getElementById("modalEventVenue").textContent = `${ev.venue_name} (${ev.venue_location})`;
    document.getElementById("modalEventTime").textContent = formatDateTime(ev.start_at);
    document.getElementById("modalEventPrice").textContent = formatPrice(ev.ticket_price);
    document.getElementById("modalSeatPulseBox").innerHTML = renderSeatPulseHTML(ev.seat_pulse);

    const regBtn = document.getElementById("modalRegisterBtn");
    const isRegistered = state.registeredEventIds.has(Number(ev.event_id));
    if (regBtn) {
      if (isRegistered) {
        regBtn.textContent = "Already Registered ✓";
        regBtn.disabled = true;
      } else if (!ev.seat_pulse.can_register) {
        regBtn.textContent = "Registration Closed / Full";
        regBtn.disabled = true;
      } else {
        regBtn.textContent = "Confirm Registration";
        regBtn.disabled = false;
      }
    }

    modal.classList.remove("hidden");
  }

  function bindLandingListeners() {
    document.querySelectorAll(".hype-tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.activeHypeTab = btn.getAttribute("data-hype-tab") || "hidden_gems";
        document.querySelectorAll(".hype-tab-btn").forEach((b) => {
          b.className =
            b === btn
              ? "hype-tab-btn px-4 py-2 rounded-full text-xs font-semibold bg-[#C85A32] text-white transition"
              : "hype-tab-btn px-4 py-2 rounded-full text-xs font-semibold bg-white/10 text-[#FAF6F0] hover:bg-white/20 transition";
        });
        renderBeyondTheHype();
      });
    });

    const filterSearch = document.getElementById("filterSearchInput");
    const headerInput = document.getElementById("headerSearchInput");
    const headerClear = document.getElementById("headerSearchClearBtn");
    const headerDrop = document.getElementById("headerSearchDropdown");

    function updateHeaderDropdown(query) {
      if (!headerDrop) return;
      if (!query) {
        headerDrop.classList.add("hidden");
        return;
      }
      const q = query.toLowerCase();
      const matches = state.allEvents
        .filter((ev) =>
          `${ev.event_name} ${ev.subtitle || ""} ${ev.festival_name} ${ev.venue_name} ${ev.category_name}`
            .toLowerCase()
            .includes(q)
        )
        .slice(0, 5);

      if (!matches.length) {
        headerDrop.innerHTML = `<div class="p-4 text-xs text-[#76667E]">No matching experiences for "${query}".</div>`;
      } else {
        headerDrop.innerHTML = matches
          .map(
            (ev) => `
            <button
              type="button"
              data-drop-event="${ev.event_id}"
              class="drop-event-item w-full text-left px-4 py-3 hover:bg-[#F3ECE1] border-b border-[#E4D9C8] last:border-none flex items-center justify-between gap-3"
            >
              <div class="min-w-0">
                <span class="text-[10px] font-bold uppercase tracking-wider text-[#C85A32] block">${ev.category_name} · ${ev.festival_name}</span>
                <strong class="text-xs serif-heading text-[#23162B] block truncate">${ev.event_name}</strong>
                <span class="text-[11px] text-[#76667E]">${formatDateTime(ev.start_at)} · ${ev.venue_name}</span>
              </div>
              <span class="text-xs font-mono font-bold text-[#23162B] shrink-0">${formatPrice(ev.ticket_price)}</span>
            </button>
          `
          )
          .join("");
        headerDrop.querySelectorAll(".drop-event-item").forEach((item) => {
          item.addEventListener("click", () => {
            const eid = Number(item.getAttribute("data-drop-event"));
            const ev = state.allEvents.find((x) => Number(x.event_id) === eid);
            headerDrop.classList.add("hidden");
            if (ev) openEventModal(ev);
          });
        });
      }
      headerDrop.classList.remove("hidden");
    }

    headerInput?.addEventListener("input", (e) => {
      const val = e.target.value.trim();
      state.searchQuery = val;
      if (filterSearch) filterSearch.value = val;
      headerClear?.classList.toggle("hidden", !val);
      renderCatalogEvents();
      updateHeaderDropdown(val);
    });

    headerInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        headerDrop?.classList.add("hidden");
        document.getElementById("discover-events")?.scrollIntoView({ behavior: "smooth" });
      }
    });

    headerClear?.addEventListener("click", () => {
      if (headerInput) headerInput.value = "";
      if (filterSearch) filterSearch.value = "";
      state.searchQuery = "";
      headerClear.classList.add("hidden");
      headerDrop?.classList.add("hidden");
      renderCatalogEvents();
    });

    document.addEventListener("click", (e) => {
      if (headerDrop && !e.target.closest(".header-search-wrap")) {
        headerDrop.classList.add("hidden");
      }
    });

    document.getElementById("heroPrevSlideBtn")?.addEventListener("click", () => {
      state.heroSlideIndex -= 1;
      renderHeroSpotlight();
    });

    document.getElementById("heroNextSlideBtn")?.addEventListener("click", () => {
      state.heroSlideIndex += 1;
      renderHeroSpotlight();
    });

    document.getElementById("heroSpotlightBookBtn")?.addEventListener("click", (e) => {
      const eid = Number(e.currentTarget.getAttribute("data-open-event"));
      const ev = state.allEvents.find((x) => Number(x.event_id) === eid);
      if (ev) openEventModal(ev);
    });

    document.querySelectorAll(".strip-cat-link, .vibe-chip").forEach((el) => {
      el.addEventListener("click", () => {
        const cat = el.getAttribute("data-strip-cat") || el.getAttribute("data-vibe-cat");
        const isFree = el.getAttribute("data-vibe-free") === "true";
        if (isFree) {
          state.selectedAvailability = "free";
          const avSel = document.getElementById("filterAvailabilitySelect");
          if (avSel) avSel.value = "free";
        } else if (cat) {
          state.activeCategory = cat;
          renderCategoryPills();
        }
        renderCatalogEvents();
        document.getElementById("discover-events")?.scrollIntoView({ behavior: "smooth" });
      });
    });

    document.querySelectorAll(".category-card[data-category-slug]").forEach((card) => {
      card.addEventListener("click", () => {
        const cat = card.getAttribute("data-category-slug");
        if (cat) {
          state.activeCategory = cat;
          renderCategoryPills();
          renderCatalogEvents();
          document.getElementById("discover-events")?.scrollIntoView({ behavior: "smooth" });
        }
      });
    });

    document.querySelectorAll("[data-strip-scroll]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetId = btn.getAttribute("data-strip-scroll") || "discover-events";
        document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth" });
      });
    });

    document.querySelectorAll("[data-open-help]").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.getElementById("helpSupportModal")?.classList.remove("hidden");
      });
    });

    document.getElementById("closeHelpModalBtn")?.addEventListener("click", () => {
      document.getElementById("helpSupportModal")?.classList.add("hidden");
    });

    filterSearch?.addEventListener("input", (e) => {
      state.searchQuery = e.target.value.trim();
      renderCatalogEvents();
    });

    document.getElementById("filterFestivalSelect")?.addEventListener("change", (e) => {
      state.selectedFestival = e.target.value;
      renderCatalogEvents();
    });

    document.getElementById("filterVenueSelect")?.addEventListener("change", (e) => {
      state.selectedVenue = e.target.value;
      renderCatalogEvents();
    });

    document.getElementById("filterAvailabilitySelect")?.addEventListener("change", (e) => {
      state.selectedAvailability = e.target.value;
      renderCatalogEvents();
    });

    document.getElementById("closeEventModalBtn")?.addEventListener("click", () => {
      document.getElementById("eventDetailModal")?.classList.add("hidden");
    });

    document.getElementById("modalRegisterBtn")?.addEventListener("click", async () => {
      if (!state.modalEvent) return;
      const isAuth = document.body.getAttribute("data-authenticated") === "true";
      if (!isAuth) {
        showToast("Please sign in to complete your event registration.", "info");
        setTimeout(() => {
          window.location.href = "/auth";
        }, 700);
        return;
      }

      const tier = document.getElementById("modalTicketTier")?.value || "General Pass";
      const btn = document.getElementById("modalRegisterBtn");
      btn.disabled = true;
      btn.textContent = "Booking in Neon...";

      try {
        const res = await fetch(`/api/events/${state.modalEvent.event_id}/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticket_tier: tier }),
        });
        const payload = await res.json();
        if (!res.ok || !payload.ok) {
          showToast(payload.error || "Registration rejected.", "error");
          btn.disabled = false;
          btn.textContent = "Confirm Registration";
          return;
        }
        showToast(`${payload.message} (Pass ${payload.ticket_code})`, "success");
        document.getElementById("eventDetailModal")?.classList.add("hidden");
        await initLandingPage();
      } catch (_err) {
        showToast("Error communicating with backend.", "error");
        btn.disabled = false;
      }
    });

    document.getElementById("modalAddToPlanBtn")?.addEventListener("click", async () => {
      if (!state.modalEvent) return;
      const isAuth = document.body.getAttribute("data-authenticated") === "true";
      if (!isAuth) {
        window.location.href = "/auth";
        return;
      }
      const res = await fetch("/api/itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: state.modalEvent.event_id }),
      });
      const payload = await res.json();
      if (res.ok && payload.ok) {
        showToast(payload.message, "success");
      } else {
        showToast(payload.error || "Could not add to plan.", "error");
      }
    });
  }

  // --------------------------------------------------------------------------
  // PAGE 2: AUTHENTICATION PAGE LOGIC
  // --------------------------------------------------------------------------
  function initAuthPage() {
    const tabLogin = document.getElementById("tabLoginBtn");
    const tabSignup = document.getElementById("tabSignupBtn");
    const tabOtp = document.getElementById("tabOtpBtn");
    const loginForm = document.getElementById("loginForm");
    const signupForm = document.getElementById("signupForm");
    const otpForm = document.getElementById("otpForm");
    const feedback = document.getElementById("authFeedbackBox");

    function setAuthTab(mode) {
      loginForm?.classList.toggle("hidden", mode !== "login");
      signupForm?.classList.toggle("hidden", mode !== "signup");
      otpForm?.classList.toggle("hidden", mode !== "otp");

      const activeCls = "px-5 py-2 rounded-full text-xs font-bold bg-[#23162B] text-white transition";
      const idleCls = "px-5 py-2 rounded-full text-xs font-bold text-[#47384F] hover:text-[#23162B] transition";
      if (tabLogin) tabLogin.className = mode === "login" ? activeCls : idleCls;
      if (tabSignup) tabSignup.className = mode === "signup" ? activeCls : idleCls;
      if (tabOtp) tabOtp.className = mode === "otp" ? activeCls : idleCls;
      feedback?.classList.add("hidden");
    }

    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get("mode");
    if (window.location.hash === "#signup" || modeParam === "signup") {
      setAuthTab("signup");
    } else if (modeParam === "otp") {
      setAuthTab("otp");
    } else {
      setAuthTab("login");
    }

    tabLogin?.addEventListener("click", () => setAuthTab("login"));
    tabSignup?.addEventListener("click", () => setAuthTab("signup"));
    tabOtp?.addEventListener("click", () => setAuthTab("otp"));

    document.getElementById("switchToSignupLink")?.addEventListener("click", () => setAuthTab("signup"));
    document.getElementById("switchToLoginLink")?.addEventListener("click", () => setAuthTab("login"));

    document.querySelectorAll(".pw-toggle-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetId = btn.getAttribute("data-toggle-pw");
        const input = document.getElementById(targetId);
        if (!input) return;
        input.type = input.type === "password" ? "text" : "password";
        btn.textContent = input.type === "password" ? "Show" : "Hide";
      });
    });

    // 1-Click Localhost Demo Accounts (Instant Sign-In)
    document.querySelectorAll(".demo-fill-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const role = btn.getAttribute("data-demo-role") || "participant";
        try {
          const res = await fetch("/api/auth/switch-role", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role }),
          });
          const data = await res.json();
          if (res.ok && data.ok) {
            showToast(data.message, "success");
            setTimeout(() => {
              window.location.href = data.redirect || "/dashboard";
            }, 350);
          } else {
            showToast(data.error || "Role switching is restricted outside local demonstration mode.", "error");
          }
        } catch (_e) {
          showToast("Could not switch demo account.", "error");
        }
      });
    });

    // Social OAuth Sign-In (Google, GitHub, Apple) + Localhost Account Chooser Modal
    const oauthModal = document.getElementById("oauthAccountModal");
    const oauthTitle = document.getElementById("oauthModalTitle");

    function openOauthChooser(provider) {
      state.activeOauthProvider = provider || "google";
      const label = state.activeOauthProvider.charAt(0).toUpperCase() + state.activeOauthProvider.slice(1);
      if (oauthTitle) oauthTitle.textContent = `Continue with ${label}`;

      // If live Supabase project URL + Anon Key are configured on body, attempt Supabase OAuth
      const supaUrl = document.body.getAttribute("data-supabase-url") || "";
      const supaKey = document.body.getAttribute("data-supabase-key") || "";
      if (supaUrl && supaKey && window.supabase) {
        try {
          const client = window.supabase.createClient(supaUrl, supaKey);
          client.auth.signInWithOAuth({
            provider: state.activeOauthProvider,
            options: { redirectTo: window.location.origin + "/auth" },
          });
          return;
        } catch (_e) {
          // Fall back to Localhost OAuth Bridge Modal
        }
      }
      oauthModal?.classList.remove("hidden");
    }

    if (params.get("oauth")) {
      openOauthChooser(params.get("oauth"));
    }

    document.querySelectorAll(".oauth-trigger-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        openOauthChooser(btn.getAttribute("data-oauth-provider") || "google");
      });
    });

    document.getElementById("closeOauthModalBtn")?.addEventListener("click", () => {
      oauthModal?.classList.add("hidden");
    });

    async function completeOauthSignIn(email, full_name) {
      try {
        const res = await fetch("/api/auth/oauth-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: state.activeOauthProvider,
            email,
            full_name,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          showToast(data.error || "OAuth sign-in failed.", "error");
          return;
        }
        oauthModal?.classList.add("hidden");
        showToast(data.message, "success");
        setTimeout(() => {
          window.location.href = data.redirect || "/dashboard";
        }, 400);
      } catch (_e) {
        showToast("Network error during OAuth sign-in.", "error");
      }
    }

    document.querySelectorAll(".oauth-account-pick").forEach((btn) => {
      btn.addEventListener("click", () => {
        const email = btn.getAttribute("data-oauth-email") || "";
        const name = btn.getAttribute("data-oauth-name") || "";
        completeOauthSignIn(email, name);
      });
    });

    document.getElementById("customOauthForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("customOauthName")?.value.trim() || "";
      const email = document.getElementById("customOauthEmail")?.value.trim() || "";
      completeOauthSignIn(email, name);
    });

    // Passwordless Mobile / Email OTP Flow
    const otpStepBox = document.getElementById("otpCodeStepBox");
    const sendOtpBtn = document.getElementById("sendOtpBtn");
    const verifyOtpBtn = document.getElementById("verifyOtpBtn");

    otpForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const identifier = document.getElementById("otpIdentifier")?.value.trim() || "";
      if (!identifier) return;
      try {
        const res = await fetch("/api/auth/send-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          showToast(data.error || "Could not send OTP.", "error");
          return;
        }
        otpStepBox?.classList.remove("hidden");
        const codeInput = document.getElementById("otpCodeInput");
        if (codeInput && data.demo_otp) codeInput.value = data.demo_otp;
        if (sendOtpBtn) sendOtpBtn.textContent = "Resend 6-Digit OTP Code";
        showToast(data.message, "success");
      } catch (_e) {
        showToast("Error sending OTP.", "error");
      }
    });

    verifyOtpBtn?.addEventListener("click", async () => {
      const identifier = document.getElementById("otpIdentifier")?.value.trim() || "";
      const code = document.getElementById("otpCodeInput")?.value.trim() || "";
      try {
        const res = await fetch("/api/auth/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier, code }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          showToast(data.error || "Invalid OTP code.", "error");
          return;
        }
        showToast(data.message, "success");
        setTimeout(() => {
          window.location.href = data.redirect || "/dashboard";
        }, 400);
      } catch (_e) {
        showToast("OTP verification failed.", "error");
      }
    });

    // Email & Password Login
    loginForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("loginEmail").value.trim();
      const password = document.getElementById("loginPassword").value;
      const submitBtn = document.getElementById("loginSubmitBtn");
      submitBtn.disabled = true;
      submitBtn.textContent = "Signing in...";

      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          if (feedback) {
            feedback.textContent = data.error || "Sign-in failed.";
            feedback.className = "mb-5 p-3.5 rounded-xl text-xs font-medium border border-[#B9382C] bg-[#FDECEB] text-[#B9382C]";
          }
          submitBtn.disabled = false;
          submitBtn.textContent = "Sign In to Rangora";
          return;
        }
        window.location.href = data.redirect || "/dashboard";
      } catch (_err) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Sign In to Rangora";
      }
    });

    // Email & Password Sign Up
    signupForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const full_name = document.getElementById("signupName").value.trim();
      const email = document.getElementById("signupEmail").value.trim();
      const password = document.getElementById("signupPassword").value;
      const confirm_password = document.getElementById("signupConfirm").value;
      const submitBtn = document.getElementById("signupSubmitBtn");
      submitBtn.disabled = true;
      submitBtn.textContent = "Creating account...";

      try {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ full_name, email, password, confirm_password }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          if (feedback) {
            feedback.textContent = data.error || "Could not create account.";
            feedback.className = "mb-5 p-3.5 rounded-xl text-xs font-medium border border-[#B9382C] bg-[#FDECEB] text-[#B9382C]";
          }
          submitBtn.disabled = false;
          submitBtn.textContent = "Create Account";
          return;
        }
        window.location.href = data.redirect || "/dashboard";
      } catch (_err) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Create Account";
      }
    });
  }

  // --------------------------------------------------------------------------
  // PAGE 3: ROLE-BASED DASHBOARD LOGIC
  // --------------------------------------------------------------------------
  async function initDashboardPage() {
    const role = document.body.getAttribute("data-user-role") || "participant";
    let defaultTab = role === "participant" ? "p-overview" : role === "organizer" ? "o-events" : "a-overview";
    if (window.location.hash === "#profile") {
      defaultTab = "u-profile";
    }

    bindDashboardShellListeners(defaultTab);
    bindProfileSettingsListeners();
    await refreshDashboardData();
  }

  function switchDashboardTab(tabId) {
    document.querySelectorAll(".dash-panel").forEach((panel) => {
      panel.classList.toggle("hidden", panel.id !== `panel-${tabId}`);
    });
    document.querySelectorAll(".dash-nav-btn").forEach((btn) => {
      const active = btn.getAttribute("data-dash-tab") === tabId;
      btn.className = active
        ? "dash-nav-btn w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-[#23162B] text-white"
        : "dash-nav-btn w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold text-[#47384F] hover:bg-[#F3ECE1]";
    });
  }

  function bindDashboardShellListeners(defaultTab) {
    switchDashboardTab(defaultTab);

    document.querySelectorAll(".dash-nav-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        switchDashboardTab(btn.getAttribute("data-dash-tab"));
      });
    });

    document.querySelectorAll("[data-switch-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        switchDashboardTab(btn.getAttribute("data-switch-tab"));
      });
    });

    document.getElementById("logoutBtn")?.addEventListener("click", async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/";
    });

    // Organizer No-Clash Guardian Check Button
    document.getElementById("runGuardianCheckBtn")?.addEventListener("click", async () => {
      const payload = collectOrganizerEventForm();
      const res = await fetch("/api/organizer/check-clash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.guardian) renderGuardianReport(data.guardian);
    });

    // Organizer Create Event Submit
    document.getElementById("createEventForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = collectOrganizerEventForm();
      const posterInput = document.getElementById("orgPosterFile");
      if (posterInput && posterInput.files && posterInput.files[0]) {
        const formData = new FormData();
        formData.append("file", posterInput.files[0]);
        try {
          const uploadRes = await fetch("/api/media/upload", {
            method: "POST",
            body: formData,
          });
          const uploadData = await uploadRes.json();
          if (uploadRes.ok && uploadData.ok) {
            payload.poster_path = uploadData.poster_path;
            if (uploadData.supabase_configured) {
              showToast("Poster uploaded to Supabase Storage and linked to Neon.", "success");
            } else {
              showToast(uploadData.message || "Using bundled image as fallback.", "info");
            }
          } else {
            showToast(uploadData.error || "Poster upload failed. Proceeding with fallback image.", "error");
          }
        } catch (_uploadErr) {
          console.warn("Upload error:", _uploadErr);
        }
      }
      const res = await fetch("/api/organizer/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.guardian) renderGuardianReport(data.guardian);
      if (!res.ok || !data.ok) {
        showToast(data.error || "No-Clash Guardian blocked event creation.", "error");
        return;
      }
      showToast(data.message, "success");
      await refreshDashboardData();
      switchDashboardTab("o-events");
    });

    // Admin Forms
    document.getElementById("adminFestivalForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const res = await fetch("/api/admin/festivals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: document.getElementById("admFestName").value,
          theme: document.getElementById("admFestTheme").value,
          start_date: document.getElementById("admFestStart").value,
          end_date: document.getElementById("admFestEnd").value,
          budget: Number(document.getElementById("admFestBudget").value || 0),
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(data.message, "success");
        await refreshDashboardData();
      } else {
        showToast(data.error || "Could not create festival.", "error");
      }
    });

    document.getElementById("adminVenueForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const res = await fetch("/api/admin/venues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venue_name: document.getElementById("admVenueName").value,
          location: document.getElementById("admVenueLocation").value,
          venue_type: document.getElementById("admVenueType").value,
          capacity: Number(document.getElementById("admVenueCap").value || 0),
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(data.message, "success");
        await refreshDashboardData();
      } else {
        showToast(data.error || "Could not add venue.", "error");
      }
    });

    document.getElementById("adminSponsorshipForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const res = await fetch("/api/admin/sponsorships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sponsor_name: document.getElementById("spName").value,
          industry: document.getElementById("spIndustry").value,
          festival_id: Number(document.getElementById("spFestivalId").value),
          contribution_amount: Number(document.getElementById("spAmount").value),
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(data.message, "success");
        await refreshDashboardData();
      } else {
        showToast(data.error || "Could not record sponsorship.", "error");
      }
    });
  }

  function collectOrganizerEventForm() {
    return {
      festival_id: Number(document.getElementById("orgFestivalId")?.value || 0),
      category_id: Number(document.getElementById("orgCategoryId")?.value || 0),
      venue_id: Number(document.getElementById("orgVenueId")?.value || 0),
      event_name: document.getElementById("orgEventName")?.value || "",
      subtitle: document.getElementById("orgEventSubtitle")?.value || "",
      description: document.getElementById("orgEventDesc")?.value || "",
      start_at: (document.getElementById("orgStartAt")?.value || "") + ":00+05:30",
      end_at: (document.getElementById("orgEndAt")?.value || "") + ":00+05:30",
      ticket_price: Number(document.getElementById("orgTicketPrice")?.value || 0),
      max_seats: Number(document.getElementById("orgMaxSeats")?.value || 0),
    };
  }

  function renderGuardianReport(guardian) {
    const box = document.getElementById("guardianResultBox");
    if (!box) return;
    box.classList.remove("hidden");
    if (guardian.passed && guardian.issue_count === 0) {
      box.className = "mb-6 p-4 rounded-2xl border border-[#2B6E63] bg-[#E5F2EF] text-[#23162B]";
      box.innerHTML = `<strong class="block text-xs uppercase tracking-wider text-[#2B6E63]">✓ No-Clash Guardian Passed</strong><p class="text-xs mt-1">${guardian.summary}</p>`;
    } else {
      box.className = "mb-6 p-4 rounded-2xl border border-[#B9382C] bg-[#FDECEB] text-[#23162B]";
      box.innerHTML = `
        <strong class="block text-xs uppercase tracking-wider text-[#B9382C]">⚠ ${guardian.summary}</strong>
        <div class="space-y-2 mt-2">
          ${guardian.issues
            .map(
              (iss) => `
            <div class="bg-white/80 p-3 rounded-xl border border-[#B9382C]/30 text-xs">
              <strong class="text-[#B9382C] block">${iss.title}</strong>
              <p class="text-[#47384F] mt-0.5">${iss.detail}</p>
              <p class="text-[#2B6E63] font-semibold mt-1">Fix: ${iss.suggestion}</p>
            </div>
          `
            )
            .join("")}
        </div>
      `;
    }
  }

  async function refreshDashboardData() {
    try {
      const res = await fetch("/api/dashboard/summary");
      const data = await res.json();
      if (!data.ok) return;
      state.dashboardData = data;

      // Overview sidebar stats
      document.getElementById("statTotalFestivals").textContent = String(data.overview_stats.total_festivals);
      document.getElementById("statTotalEvents").textContent = String(data.overview_stats.total_published_events);
      document.getElementById("statTotalRegistrations").textContent = String(data.overview_stats.total_confirmed_registrations);

      renderProfileSettings(data);
      renderParticipantDashboard(data);
      renderOrganizerDashboard(data);
      renderAdminDashboard(data);
    } catch (_err) {
      showToast("Could not refresh dashboard data.", "error");
    }
  }

  function updateAvatarDOMElements(avatarUrl) {
    const circles = [
      document.getElementById("headerProfileIconBtn"),
      document.querySelector('[data-switch-tab="u-profile"].user-avatar-btn'),
      document.getElementById("profilePreviewCircle"),
    ];
    circles.forEach((circle, idx) => {
      if (!circle) return;
      const isLarge = idx === 2;
      const dotHTML = idx === 0 ? `<span class="user-avatar-status-dot"></span>` : "";
      if (avatarUrl) {
        circle.innerHTML = `<img src="${avatarUrl}" alt="User profile photo" class="w-full h-full object-cover rounded-full" />${dotHTML}`;
      } else {
        const sizeCls = isLarge ? "w-9 h-9" : "w-5 h-5";
        circle.innerHTML = `
          <svg class="${sizeCls} text-[#23162B]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
          </svg>${dotHTML}
        `;
      }
    });

    const badge = document.getElementById("profilePhotoStatusBadge");
    if (badge) {
      badge.textContent = avatarUrl ? "Custom Face Photo Active" : "Default User Icon (No Photo Set Yet)";
      badge.className = avatarUrl
        ? "text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#E5F2EF] text-[#2B6E63]"
        : "text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white text-[#76667E]";
    }
  }

  function renderProfileSettings(data) {
    const catBox = document.getElementById("profileCategoriesBox");
    if (!catBox || !data.categories) return;
    const prefSet = new Set((data.participant?.preferred_category_ids || []).map(Number));
    catBox.innerHTML = data.categories
      .map(
        (c) => `
        <label class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#FAF6F0] border border-[#CEBFA8] text-xs font-semibold cursor-pointer">
          <input type="checkbox" value="${c.category_id}" class="prof-cat-chk accent-[#C85A32]" ${
            prefSet.has(Number(c.category_id)) ? "checked" : ""
          } />
          <span>${c.category_name}</span>
        </label>
      `
      )
      .join("");
  }

  function bindProfileSettingsListeners() {
    // 1-Click Viva Role Switcher in Sidebar
    document.querySelectorAll(".viva-role-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const role = btn.getAttribute("data-viva-role") || "participant";
        const res = await fetch("/api/auth/switch-role", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        });
        const out = await res.json();
        if (res.ok && out.ok) {
          showToast(out.message, "success");
          setTimeout(() => {
            window.location.href = "/dashboard";
          }, 300);
        } else {
          showToast(out.error || "Role switching is restricted outside local demonstration mode.", "error");
        }
      });
    });

    const hiddenAvatarInput = document.getElementById("profileAvatarUrlInput");
    const fileInput = document.getElementById("profileAvatarFileInput");

    // Device File Upload -> Cropped 240x240 JPEG DataURL
    fileInput?.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = 240;
          canvas.height = 240;
          const ctx = canvas.getContext("2d");
          const minDim = Math.min(img.width, img.height);
          const sx = (img.width - minDim) / 2;
          const sy = (img.height - minDim) / 2;
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, 240, 240);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          if (hiddenAvatarInput) hiddenAvatarInput.value = dataUrl;
          updateAvatarDOMElements(dataUrl);
          showToast("Photo loaded! Click 'Save Profile & Update User Icon' to save.", "info");
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });

    // Preset Portrait Buttons
    document.querySelectorAll(".preset-avatar-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const url = btn.getAttribute("data-preset-avatar") || "";
        if (hiddenAvatarInput) hiddenAvatarInput.value = url;
        updateAvatarDOMElements(url);
        showToast("Portrait selected! Click 'Save Profile & Update User Icon' to apply.", "info");
      });
    });

    // Clear / Reset to Default User Silhouette Icon
    document.getElementById("clearAvatarBtn")?.addEventListener("click", () => {
      if (hiddenAvatarInput) hiddenAvatarInput.value = "";
      updateAvatarDOMElements("");
      showToast("Reset to default user icon. Click Save to persist.", "info");
    });

    // Save Profile Form
    document.getElementById("userProfileForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const full_name = document.getElementById("profileFullName")?.value.trim() || "";
      const phone = document.getElementById("profilePhone")?.value.trim() || "";
      const city = document.getElementById("profileCity")?.value.trim() || "Kolkata";
      const bio = document.getElementById("profileBio")?.value.trim() || "";
      const avatar_url = hiddenAvatarInput?.value.trim() || "";
      const category_ids = Array.from(document.querySelectorAll(".prof-cat-chk:checked")).map((el) =>
        Number(el.value)
      );

      try {
        const res = await fetch("/api/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ full_name, phone, city, bio, avatar_url, category_ids }),
        });
        const out = await res.json();
        if (!res.ok || !out.ok) {
          showToast(out.error || "Could not save profile.", "error");
          return;
        }
        updateAvatarDOMElements(avatar_url);
        const sidebarName = document.getElementById("sidebarUserName");
        if (sidebarName) sidebarName.textContent = full_name;
        const welcomeFirst = document.getElementById("welcomeFirstName");
        if (welcomeFirst) welcomeFirst.textContent = full_name.split(" ")[0];
        showToast(out.message, "success");
        await refreshDashboardData();
      } catch (_err) {
        showToast("Network error while saving profile.", "error");
      }
    });
  }

  function renderParticipantDashboard(data) {
    const p = data.participant;
    if (!p) return;

    // 1. Registrations
    const regList = document.getElementById("participantRegistrationsList");
    if (regList) {
      const activeRegs = (p.registrations || []).filter((r) => r.registration_status === "confirmed");
      if (!activeRegs.length) {
        regList.innerHTML = `<p class="text-sm text-[#76667E] col-span-2">You haven’t booked any events yet. Head to the Discover tab to book your first pass!</p>`;
      } else {
        regList.innerHTML = activeRegs
          .map(
            (r) => `
          <article class="bg-[#FAF6F0] rounded-2xl border border-[#CEBFA8] p-5 flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between gap-2 mb-2">
                <span class="px-2.5 py-0.5 rounded-full bg-[#23162B] text-[#FDF3E1] font-mono text-[11px]">
                  PASS #${r.ticket_code}
                </span>
                <span class="text-xs font-bold ${r.is_verified_attended ? "text-[#2B6E63]" : "text-[#C85A32]"}">
                  ${r.is_verified_attended ? "✓ Verified Attended" : r.ticket_tier}
                </span>
              </div>
              <p class="text-[11px] font-bold uppercase tracking-wider text-[#76667E]">${r.festival_name}</p>
              <h3 class="text-lg serif-heading mt-0.5 mb-2">${r.event_name}</h3>
              <p class="text-xs text-[#47384F]"><strong>When:</strong> ${formatDateTime(r.start_at)}</p>
              <p class="text-xs text-[#47384F]"><strong>Venue:</strong> ${r.venue_name}</p>
            </div>
            <div class="ticket-divider"></div>
            <div class="flex items-center justify-between">
              <span class="text-xs font-mono font-semibold">${formatPrice(r.price_at_registration)}</span>
              ${
                r.event_status !== "completed"
                  ? `<button type="button" data-cancel-reg="${r.registration_id}" class="cancel-reg-btn text-xs font-bold text-[#B9382C] hover:underline">Cancel Pass</button>`
                  : `<span class="text-xs text-[#2B6E63] font-semibold">Completed Event</span>`
              }
            </div>
          </article>
        `
          )
          .join("");

        regList.querySelectorAll(".cancel-reg-btn").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const rid = btn.getAttribute("data-cancel-reg");
            const res = await fetch(`/api/registrations/${rid}/cancel`, { method: "POST" });
            const out = await res.json();
            if (res.ok && out.ok) {
              showToast(out.message, "success");
              await refreshDashboardData();
            } else {
              showToast(out.error || "Could not cancel registration.", "error");
            }
          });
        });
      }
    }

    // 2. Plan Rescue
    const pr = p.plan_rescue;
    const statusBadge = document.getElementById("planRescueStatusBadge");
    const conflictsBox = document.getElementById("planRescueConflictsBox");
    const planList = document.getElementById("participantItineraryList");

    if (statusBadge && pr) {
      statusBadge.textContent = pr.status_label;
      statusBadge.className =
        pr.conflict_count > 0
          ? "px-4 py-2 rounded-full text-xs font-bold bg-[#FDECEB] text-[#B9382C] border border-[#B9382C]/30"
          : "px-4 py-2 rounded-full text-xs font-bold bg-[#E5F2EF] text-[#2B6E63] border border-[#2B6E63]/30";
    }

    if (conflictsBox && pr) {
      if (!pr.conflicts.length) {
        conflictsBox.innerHTML = `
          <div class="p-4 rounded-2xl bg-[#E5F2EF] border border-[#2B6E63]/30 text-xs text-[#23162B]">
            <strong>✓ Zero time clashes detected:</strong> Every event in your saved itinerary has a clean, non-overlapping time window.
          </div>
        `;
      } else {
        conflictsBox.innerHTML = pr.conflicts
          .map(
            (c) => `
          <div class="p-5 rounded-2xl bg-[#FDECEB] border border-[#B9382C]/40 space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold uppercase tracking-wider text-[#B9382C]">⚠ Schedule Clash Detected</span>
            </div>
            <p class="text-sm font-semibold text-[#23162B]">${c.message}</p>
            ${
              c.alternatives && c.alternatives.length
                ? `
              <div class="bg-white p-3.5 rounded-xl border border-[#E4D9C8] space-y-2">
                <span class="text-[11px] font-bold uppercase tracking-wider text-[#2B6E63] block">
                  Plan Rescue Conflict-Free Suggestions:
                </span>
                ${c.alternatives
                  .map(
                    (alt) => `
                  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-[#E4D9C8]">
                    <div class="text-xs">
                      <strong class="text-[#23162B]">${alt.event_name}</strong>
                      <span class="text-[#76667E] block">${formatDateTime(alt.start_at)} · ${alt.venue_name} (${alt.rescue_reason})</span>
                    </div>
                    <button
                      type="button"
                      data-swap-remove="${c.event_b_id || c.event_a_id}"
                      data-swap-add="${alt.event_id}"
                      class="swap-plan-btn btn btn-sage text-xs py-1.5 px-3 shrink-0"
                    >
                      Swap into My Plan
                    </button>
                  </div>
                `
                  )
                  .join("")}
              </div>
            `
                : ""
            }
          </div>
        `
          )
          .join("");

        conflictsBox.querySelectorAll(".swap-plan-btn").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const remove_event_id = Number(btn.getAttribute("data-swap-remove"));
            const add_event_id = Number(btn.getAttribute("data-swap-add"));
            const res = await fetch("/api/itinerary/swap", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ remove_event_id, add_event_id }),
            });
            const out = await res.json();
            if (res.ok && out.ok) {
              showToast(out.message, "success");
              await refreshDashboardData();
            }
          });
        });
      }
    }

    if (planList && pr) {
      planList.innerHTML = (pr.items || [])
        .map(
          (item) => `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[#FAF6F0] border border-[#E4D9C8]">
          <div>
            <span class="text-[11px] font-bold uppercase tracking-wider text-[#C85A32]">${item.festival_name} · ${item.category_name}</span>
            <h4 class="text-lg serif-heading">${item.event_name}</h4>
            <p class="text-xs text-[#47384F]">${formatDateTime(item.start_at)} &rarr; ${formatDateTime(item.end_at)} · ${item.venue_name}</p>
          </div>
          <button type="button" data-remove-plan="${item.event_id}" class="remove-plan-btn btn btn-outline text-xs py-1.5 px-3">
            Remove
          </button>
        </div>
      `
        )
        .join("");

      planList.querySelectorAll(".remove-plan-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const eid = btn.getAttribute("data-remove-plan");
          await fetch(`/api/itinerary/${eid}`, { method: "DELETE" });
          showToast("Removed from itinerary.", "info");
          await refreshDashboardData();
        });
      });
    }

    // 3. Festival DNA & Passport
    const dna = p.dna_passport;
    if (dna) {
      document.getElementById("dnaPersonaTitle").textContent = dna.persona_title;
      document.getElementById("dnaPersonaNote").textContent = dna.persona_note;
      document.getElementById("dnaRegCount").textContent = String(dna.total_registered);
      document.getElementById("dnaVerifiedCount").textContent = String(dna.total_verified_attended);
      document.getElementById("dnaCatCount").textContent = String(dna.distinct_categories);
      document.getElementById("passportProgressBadge").textContent = `${dna.unlocked_count} of ${dna.total_stamps} Stamps Unlocked`;

      const catBox = document.getElementById("dnaCategoryBreakdown");
      if (catBox) {
        catBox.innerHTML = (dna.category_breakdown || [])
          .map(
            (c) => `
          <div class="bg-white/10 p-3.5 rounded-xl">
            <div class="flex items-center justify-between text-xs font-semibold text-white">
              <span>${c.category_name}</span>
              <span>${c.registered_count} booked (${c.verified_attended_count} verified)</span>
            </div>
          </div>
        `
          )
          .join("");
      }

      const stampsGrid = document.getElementById("passportStampsGrid");
      if (stampsGrid) {
        stampsGrid.innerHTML = (dna.passport_stamps || [])
          .map(
            (s) => `
          <div class="passport-stamp ${s.unlocked ? "unlocked" : ""}">
            <div class="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider mb-1">
              <span class="${s.unlocked ? "text-[#2B6E63] font-bold" : "text-[#76667E]"}">${s.stamp_type}</span>
              <span>${s.unlocked ? "★ UNLOCKED" : "LOCKED"}</span>
            </div>
            <h4 class="text-base serif-heading">${s.title}</h4>
            <p class="text-xs text-[#47384F] mt-1">${s.criteria}</p>
            <p class="text-[11px] font-mono text-[#C85A32] mt-2">${s.progress}</p>
          </div>
        `
          )
          .join("");
      }
    }

    // 4. Discover inside Dashboard
    const hypeGrid = document.getElementById("dashBeyondHypeGrid");
    if (hypeGrid && p.beyond_the_hype) {
      const gems = p.beyond_the_hype.hidden_gems || [];
      hypeGrid.innerHTML = gems
        .map(
          (ev) => `
        <div class="p-4 rounded-2xl bg-[#FAF6F0] border border-[#CEBFA8] flex flex-col justify-between">
          <div>
            <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#FBECE6] text-[#C85A32]">${ev.recommendation_badge}</span>
            <h4 class="text-lg serif-heading mt-2">${ev.event_name}</h4>
            <p class="text-xs text-[#76667E] mb-2">${ev.venue_name} · ${formatDateTime(ev.start_at)}</p>
            <p class="text-xs italic text-[#47384F] mb-3">“${ev.recommendation_reason}”</p>
          </div>
          <div>
            ${renderSeatPulseHTML(ev.seat_pulse)}
            <div class="flex gap-2 mt-3">
              <button type="button" data-dash-book="${ev.event_id}" class="dash-book-btn btn btn-primary text-xs py-1.5 px-3 flex-1">Book Pass</button>
              <button type="button" data-dash-plan="${ev.event_id}" class="dash-plan-btn btn btn-outline text-xs py-1.5 px-3">+ Plan</button>
            </div>
          </div>
        </div>
      `
        )
        .join("");
    }

    const allGrid = document.getElementById("dashAllEventsGrid");
    if (allGrid && data.published_events) {
      allGrid.innerHTML = data.published_events
        .map(
          (ev) => `
        <div class="p-4 rounded-2xl bg-[#FAF6F0] border border-[#E4D9C8] flex flex-col justify-between">
          <div>
            <div class="flex justify-between text-xs font-semibold text-[#C85A32]">
              <span>${ev.festival_name}</span>
              <span>${formatPrice(ev.ticket_price)}</span>
            </div>
            <h4 class="text-lg serif-heading mt-1">${ev.event_name}</h4>
            <p class="text-xs text-[#47384F] mb-3">${formatDateTime(ev.start_at)} · ${ev.venue_name}</p>
          </div>
          <div>
            ${renderSeatPulseHTML(ev.seat_pulse)}
            <div class="flex gap-2 mt-3">
              <button type="button" data-dash-book="${ev.event_id}" class="dash-book-btn btn btn-primary text-xs py-1.5 px-3 flex-1">
                Book Pass
              </button>
              <button type="button" data-dash-plan="${ev.event_id}" class="dash-plan-btn btn btn-outline text-xs py-1.5 px-3">
                + Add to Plan
              </button>
            </div>
          </div>
        </div>
      `
        )
        .join("");
    }

    document.querySelectorAll(".dash-book-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const eid = btn.getAttribute("data-dash-book");
        const res = await fetch(`/api/events/${eid}/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticket_tier: "General Pass" }),
        });
        const out = await res.json();
        if (res.ok && out.ok) {
          showToast(out.message, "success");
          await refreshDashboardData();
          switchDashboardTab("p-overview");
        } else {
          showToast(out.error || "Booking rejected.", "error");
        }
      });
    });

    document.querySelectorAll(".dash-plan-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const eid = btn.getAttribute("data-dash-plan");
        const res = await fetch("/api/itinerary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event_id: Number(eid) }),
        });
        const out = await res.json();
        if (res.ok && out.ok) {
          showToast(out.message, "success");
          await refreshDashboardData();
        } else {
          showToast(out.error || "Could not add to plan.", "error");
        }
      });
    });

    renderParticipantRewards();
    renderLeaderboard();
  }

  function renderOrganizerDashboard(data) {
    const org = data.organizer;
    if (!org || !org.managed_events) return;

    // Populate Create Event dropdowns
    const festSel = document.getElementById("orgFestivalId");
    if (festSel && data.festivals) {
      festSel.innerHTML = data.festivals.map((f) => `<option value="${f.festival_id}">${f.name}</option>`).join("");
    }
    const catSel = document.getElementById("orgCategoryId");
    if (catSel && data.categories) {
      catSel.innerHTML = data.categories.map((c) => `<option value="${c.category_id}">${c.category_name}</option>`).join("");
    }
    const venueSel = document.getElementById("orgVenueId");
    if (venueSel && data.venues) {
      venueSel.innerHTML = data.venues
        .map((v) => `<option value="${v.venue_id}">${v.venue_name} (Max Cap: ${v.capacity})</option>`)
        .join("");
    }

    // Managed Events List
    const evList = document.getElementById("organizerEventsList");
    if (evList) {
      evList.innerHTML = org.managed_events
        .map(
          (ev) => `
        <div class="p-5 rounded-2xl bg-[#FAF6F0] border border-[#CEBFA8] grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          <div class="md:col-span-5">
            <span class="text-[11px] font-bold uppercase tracking-wider text-[#C85A32]">${ev.festival_name} · ${ev.status.toUpperCase()}</span>
            <h3 class="text-lg serif-heading">${ev.event_name}</h3>
            <p class="text-xs text-[#47384F]">${formatDateTime(ev.start_at)} · ${ev.venue_name} (Venue Cap ${ev.venue_capacity})</p>
          </div>
          <div class="md:col-span-4">
            ${renderSeatPulseHTML(ev.seat_pulse)}
          </div>
          <div class="md:col-span-3 flex justify-end gap-2">
            <span class="px-3 py-1.5 rounded-xl bg-white border border-[#E4D9C8] text-xs font-mono">
              ${formatPrice(ev.ticket_price)}
            </span>
          </div>
        </div>
      `
        )
        .join("");
    }

    // Roster Table
    const rosterBody = document.getElementById("organizerRosterTableBody");
    if (rosterBody && org.participant_roster) {
      rosterBody.innerHTML = org.participant_roster
        .map(
          (r) => `
        <tr>
          <td class="py-3 px-3 font-mono font-semibold">${r.ticket_code}</td>
          <td class="py-3 px-3">
            <strong class="block text-[#23162B]">${r.participant_name}</strong>
            <span class="text-[#76667E]">${r.participant_email}</span>
          </td>
          <td class="py-3 px-3">${r.event_name}</td>
          <td class="py-3 px-3">${r.ticket_tier} · ${r.registration_status}</td>
          <td class="py-3 px-3 text-right">
            ${
              r.verified_attended
                ? `<span class="px-2.5 py-1 rounded-full bg-[#E5F2EF] text-[#2B6E63] font-bold">✓ Checked In</span>`
                : `<button type="button" data-verify-reg="${r.registration_id}" class="verify-att-btn btn btn-sage text-xs py-1 px-3">Verify Check-In</button>`
            }
          </td>
        </tr>
      `
        )
        .join("");

      rosterBody.querySelectorAll(".verify-att-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const rid = btn.getAttribute("data-verify-reg");
          const res = await fetch(`/api/organizer/registrations/${rid}/verify-attendance`, { method: "POST" });
          const out = await res.json();
          if (res.ok && out.ok) {
            showToast(out.message, "success");
            await refreshDashboardData();
          } else {
            showToast(out.error || "Could not verify attendance.", "error");
          }
        });
      });
    }

    // Event Echo
    const echoList = document.getElementById("eventEchoList");
    if (echoList && org.event_echo) {
      echoList.innerHTML = org.event_echo
        .map(
          (ec) => `
        <div class="p-5 rounded-2xl bg-[#FAF6F0] border border-[#CEBFA8] space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-bold uppercase tracking-wider text-[#8C2D4B]">${ec.festival_name}</span>
            <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#23162B] text-white">${ec.status}</span>
          </div>
          <h3 class="text-xl serif-heading">${ec.event_name}</h3>
          <div class="grid grid-cols-3 gap-2 pt-2">
            <div class="bg-white p-2.5 rounded-xl border border-[#E4D9C8] text-center">
              <strong class="block text-base serif-heading">${ec.confirmed_registrations}/${ec.max_seats}</strong>
              <span class="text-[10px] text-[#76667E]">Confirmed</span>
            </div>
            <div class="bg-white p-2.5 rounded-xl border border-[#E4D9C8] text-center">
              <strong class="block text-base serif-heading text-[#2B6E63]">
                ${ec.verified_attendees} ${ec.attendance_rate_percent !== null ? `(${ec.attendance_rate_percent}%)` : ""}
              </strong>
              <span class="text-[10px] text-[#76667E]">Verified Attended</span>
            </div>
            <div class="bg-white p-2.5 rounded-xl border border-[#E4D9C8] text-center">
              <strong class="block text-base serif-heading text-[#D48C28]">
                ${ec.avg_rating !== null ? `${ec.avg_rating} ★ (${ec.feedback_count})` : "No ratings"}
              </strong>
              <span class="text-[10px] text-[#76667E]">Avg Feedback</span>
            </div>
          </div>
          ${
            ec.feedback_quotes && ec.feedback_quotes.length
              ? `<div class="space-y-1.5 pt-2">
                  ${ec.feedback_quotes
                    .map(
                      (q) =>
                        `<blockquote class="text-xs italic text-[#47384F] bg-white p-2.5 rounded-lg border border-[#E4D9C8]">“${q.comment}” — <strong>${q.full_name}</strong> (${q.rating}★)</blockquote>`
                    )
                    .join("")}
                </div>`
              : `<p class="text-xs text-[#76667E] italic">No participant reflections recorded yet.</p>`
          }
        </div>
      `
        )
        .join("");
    }

    renderOrganizerPasses();
    renderOrganizerRewardPerformance();
  }

  function renderAdminDashboard(data) {
    const adm = data.admin;
    if (!adm || !adm.users) return;

    // 1. Admin Events Oversight Table
    const evBody = document.getElementById("adminEventsTableBody");
    const managed = data.organizer?.managed_events || [];
    if (evBody) {
      evBody.innerHTML = managed
        .map(
          (ev) => `
        <tr>
          <td class="py-3 px-3">
            <strong class="block text-[#23162B]">${ev.event_name}</strong>
            <span class="text-[#76667E]">${ev.festival_name}</span>
          </td>
          <td class="py-3 px-3">${ev.organizer_name} · ${ev.venue_name}</td>
          <td class="py-3 px-3">${ev.confirmed_count}/${ev.max_seats} booked</td>
          <td class="py-3 px-3 font-bold uppercase">${ev.status}</td>
          <td class="py-3 px-3 text-right space-x-1">
            ${
              ev.status !== "published"
                ? `<button type="button" data-adm-ev="${ev.event_id}" data-adm-status="published" class="adm-ev-btn btn btn-sage text-[11px] py-1 px-2.5">Approve &amp; Publish</button>`
                : ""
            }
            ${
              ev.status === "published"
                ? `<button type="button" data-adm-ev="${ev.event_id}" data-adm-status="completed" class="adm-ev-btn btn btn-outline text-[11px] py-1 px-2.5">Mark Completed</button>`
                : ""
            }
          </td>
        </tr>
      `
        )
        .join("");

      evBody.querySelectorAll(".adm-ev-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const eid = btn.getAttribute("data-adm-ev");
          const status = btn.getAttribute("data-adm-status");
          const res = await fetch(`/api/admin/events/${eid}/status`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
          });
          const out = await res.json();
          if (res.ok && out.ok) {
            showToast(out.message, "success");
            await refreshDashboardData();
          }
        });
      });
    }

    // 2. Venues Grid
    const vGrid = document.getElementById("adminVenuesGrid");
    if (vGrid && data.venues) {
      vGrid.innerHTML = data.venues
        .map(
          (v) => `
        <div class="p-4 rounded-2xl bg-[#FAF6F0] border border-[#E4D9C8]">
          <span class="text-[11px] font-bold uppercase text-[#2B6E63]">${v.venue_type}</span>
          <h4 class="text-base serif-heading mt-0.5">${v.venue_name}</h4>
          <p class="text-xs text-[#76667E]">${v.location}</p>
          <p class="text-xs font-mono font-bold mt-2">Physical Capacity: ${v.capacity} seats</p>
        </div>
      `
        )
        .join("");
    }

    // 3. Users & Roles Table
    const uBody = document.getElementById("adminUsersTableBody");
    if (uBody) {
      uBody.innerHTML = adm.users
        .map(
          (u) => `
        <tr>
          <td class="py-3 px-3 font-mono">#${u.user_id}</td>
          <td class="py-3 px-3 font-semibold">${u.full_name}</td>
          <td class="py-3 px-3">${u.email}</td>
          <td class="py-3 px-3 uppercase font-bold text-[#C85A32]">${u.role}</td>
          <td class="py-3 px-3 text-right">
            <select data-role-user="${u.user_id}" class="adm-role-select px-2.5 py-1 rounded-lg bg-[#FAF6F0] border border-[#CEBFA8] text-xs">
              <option value="participant" ${u.role === "participant" ? "selected" : ""}>participant</option>
              <option value="organizer" ${u.role === "organizer" ? "selected" : ""}>organizer</option>
              <option value="admin" ${u.role === "admin" ? "selected" : ""}>admin</option>
            </select>
          </td>
        </tr>
      `
        )
        .join("");

      uBody.querySelectorAll(".adm-role-select").forEach((sel) => {
        sel.addEventListener("change", async () => {
          const uid = sel.getAttribute("data-role-user");
          const res = await fetch(`/api/admin/users/${uid}/role`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role: sel.value }),
          });
          const out = await res.json();
          if (res.ok && out.ok) {
            showToast(out.message, "success");
            await refreshDashboardData();
          }
        });
      });
    }

    // 4. Sponsors & Sponsorships
    const spFestSel = document.getElementById("spFestivalId");
    if (spFestSel && data.festivals) {
      spFestSel.innerHTML = data.festivals.map((f) => `<option value="${f.festival_id}">${f.name}</option>`).join("");
    }
    const totSp = document.getElementById("adminTotalSponsorship");
    if (totSp) {
      totSp.textContent = `₹${Number(data.overview_stats.total_sponsorship || 0).toLocaleString("en-IN")}`;
    }
    const spList = document.getElementById("adminSponsorshipsList");
    if (spList && adm.sponsorships) {
      spList.innerHTML = adm.sponsorships
        .map(
          (s) => `
        <div class="p-4 rounded-2xl bg-[#FAF6F0] border border-[#E4D9C8] flex items-center justify-between">
          <div>
            <span class="text-[11px] font-bold uppercase text-[#C85A32]">${s.tier} · ${s.industry || "Partner"}</span>
            <h4 class="text-base serif-heading">${s.sponsor_name}</h4>
            <p class="text-xs text-[#47384F]">Supporting: ${s.festival_name}</p>
          </div>
          <div class="text-right">
            <strong class="text-base font-mono text-[#2B6E63]">₹${Number(s.contribution_amount).toLocaleString("en-IN")}</strong>
            <span class="block text-[10px] uppercase text-[#76667E]">${s.status}</span>
          </div>
        </div>
      `
        )
        .join("");
    }

    renderAdminVouchers();
    renderLeaderboard();
  }

  // --------------------------------------------------------------------------
  // REWARDS, LEADERBOARD, PASS BUILDER & VOUCHER CONTROLLERS
  // --------------------------------------------------------------------------
  let activeStampFilter = "verified";
  let activeVoucherFilter = "all";

  async function renderParticipantRewards() {
    try {
      const res = await fetch("/api/participant/rewards");
      const data = await res.json();
      if (!data.ok) return;

      const pData = data.rewards;
      if (!pData) return;

      // Summary standing
      const ptsEl = document.getElementById("rewardsStandingPoints");
      const rankEl = document.getElementById("rewardsStandingRank");
      if (ptsEl) ptsEl.textContent = String(pData.journey_points || 0);
      if (rankEl) rankEl.textContent = pData.leaderboard_rank ? `#${pData.leaderboard_rank}` : "#—";

      // 1. Badges
      const badgesGrid = document.getElementById("rewardsBadgesGrid");
      const badgeCountBadge = document.getElementById("earnedBadgesCountBadge");
      const earnedBadges = pData.earned_badges || [];
      if (badgeCountBadge) badgeCountBadge.textContent = `${earnedBadges.length} Badges`;
      if (badgesGrid) {
        if (!earnedBadges.length) {
          badgesGrid.innerHTML = `
            <div class="p-6 rounded-2xl bg-[#FAF6F0] border border-[#E4D9C8] col-span-full text-center text-xs text-[#76667E]">
              No badges earned yet. Attend verified events or complete milestone passes to unlock distinctive accolades!
            </div>
          `;
        } else {
          badgesGrid.innerHTML = earnedBadges.map((b) => `
            <div class="reward-card p-5 rounded-2xl bg-[#FAF6F0] border border-[#CEBFA8] flex items-start gap-4">
              <img src="${b.badge_icon_path || '/static/images/badges/badge_first_experience.svg'}" alt="${b.title || 'Badge'}" class="badge-art-img w-14 h-14 shrink-0 object-contain" />
              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-[10px] uppercase font-bold tracking-wider text-[#C85A32]">${b.pass_title ? 'Custom Pass' : 'Standard Accolade'}</span>
                  <span class="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-[#E5F2EF] text-[#2B6E63]">Earned</span>
                </div>
                <h4 class="text-base serif-heading text-[#23162B] truncate mt-0.5">${b.title || 'Achievement Badge'}</h4>
                <p class="text-xs text-[#47384F] mt-0.5 line-clamp-2">${b.description || ''}</p>
                <span class="text-[10px] text-[#76667E] block mt-2">Awarded ${formatDateTime(b.awarded_at)}</span>
              </div>
            </div>
          `).join("");
        }
      }

      // 2. Exploration Stamps (Physical Door Check-Ins vs Awaiting)
      const stampsGrid = document.getElementById("rewardsStampsGrid");
      const verifiedStamps = pData.verified_stamps || pData.stamps || [];
      const awaitingStamps = pData.awaiting_stamps || [];

      const vCountEl = document.getElementById("verifiedStampsCount");
      const aCountEl = document.getElementById("awaitingStampsCount");
      if (vCountEl) vCountEl.textContent = String(verifiedStamps.length);
      if (aCountEl) aCountEl.textContent = String(awaitingStamps.length);

      function renderStampsGrid() {
        if (!stampsGrid) return;
        const isVerified = activeStampFilter === "verified";
        const currentList = isVerified ? verifiedStamps : awaitingStamps;

        if (!currentList.length) {
          stampsGrid.innerHTML = isVerified
            ? `
              <div class="p-6 rounded-2xl bg-[#FAF6F0] border border-[#E4D9C8] col-span-full text-center text-xs text-[#76667E]">
                No physical door check-in stamps yet. Have the venue organizer scan your ticket pass to imprint your festival passport!
              </div>
            `
            : `
              <div class="p-6 rounded-2xl bg-[#FAF6F0] border border-[#E4D9C8] col-span-full text-center text-xs text-[#76667E]">
                No confirmed registrations awaiting check-in. Explore upcoming festivals from Discover and register to earn check-in points!
              </div>
            `;
          return;
        }

        stampsGrid.innerHTML = currentList.map((s) => {
          const eventTitle = s.event_name || 'Campus Celebration';
          const festName = s.festival_name || 'Rangora Campus Festival';
          const venueName = s.venue_name || 'Campus Main Grounds';
          const dateStr = isVerified
            ? `Checked in ${formatDateTime(s.checked_in_at || s.awarded_at)}`
            : `Scheduled for ${formatDateTime(s.start_at)}`;

          return `
            <div class="reward-card p-4 rounded-2xl bg-[#FAF6F0] border ${isVerified ? 'border-[#CEBFA8]' : 'border-[#E4D9C8] opacity-90'} flex items-center gap-3.5">
              <img src="${s.stamp_icon_path || '/static/images/badges/stamp_verified_attendance.svg'}" alt="${festName}" class="stamp-art-img w-12 h-12 shrink-0 object-contain ${isVerified ? '' : 'grayscale-[30%]'}" />
              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-1 mb-0.5">
                  <span class="text-[10px] uppercase font-bold tracking-wider ${isVerified ? 'text-[#2B6E63]' : 'text-[#8B68C7]'}">
                    ${isVerified ? 'Verified Check-In' : 'Awaiting Check-In'}
                  </span>
                  <span class="text-[10px] font-mono font-bold ${isVerified ? 'text-[#2B6E63]' : 'text-[#76667E]'}">
                    ${isVerified ? '+50 pts' : 'Pending'}
                  </span>
                </div>
                <h4 class="text-sm serif-heading text-[#23162B] truncate">${eventTitle}</h4>
                <p class="text-xs text-[#76667E] truncate">${festName} &bull; ${venueName}</p>
                <span class="text-[10px] text-[#76667E] block mt-1">${dateStr}</span>
              </div>
            </div>
          `;
        }).join("");
      }

      renderStampsGrid();

      // Bind stamp tab filter buttons
      document.querySelectorAll(".stamp-tab-btn").forEach((btn) => {
        btn.onclick = () => {
          activeStampFilter = btn.getAttribute("data-stamp-filter") || "verified";
          document.querySelectorAll(".stamp-tab-btn").forEach((b) => {
            const isActive = b.getAttribute("data-stamp-filter") === activeStampFilter;
            b.className = isActive
              ? "stamp-tab-btn active px-3 py-1 rounded-full bg-[#23162B] text-white transition"
              : "stamp-tab-btn px-3 py-1 rounded-full text-[#47384F] hover:bg-white transition";
          });
          renderStampsGrid();
        };
      });

      // 3. In-progress achievements
      const progList = document.getElementById("rewardsProgressList");
      const available = pData.available_achievements || [];
      const availCountBadge = document.getElementById("availableAchievementsCountBadge");
      if (availCountBadge) availCountBadge.textContent = `${available.length} Available`;

      if (progList) {
        if (!available.length) {
          progList.innerHTML = `<p class="text-xs text-[#76667E]">All available achievements have been unlocked!</p>`;
        } else {
          progList.innerHTML = available.map((ach) => {
            const current = Number(ach.current_progress || 0);
            const target = Number(ach.target_progress || 1);
            const pct = Math.min(100, Math.round((current / target) * 100));
            const statusLabel = current >= target ? "Earned" : current > 0 ? "In Progress" : "Locked";
            const statusClass = current >= target ? "bg-[#E5F2EF] text-[#2B6E63]" : current > 0 ? "bg-[#F3EFFB] text-[#8B68C7]" : "bg-[#FAF6F0] text-[#76667E]";

            return `
              <div class="p-4 rounded-2xl bg-[#FAF6F0] border border-[#E4D9C8] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="text-[10px] uppercase font-bold tracking-wider text-[#76667E]">${ach.category || 'General'}</span>
                    <span class="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${statusClass}">${statusLabel}</span>
                    <span class="text-[10px] font-bold text-[#C85A32]">+${ach.points_reward || 30} pts</span>
                  </div>
                  <h4 class="text-sm font-bold text-[#23162B] mt-0.5">${ach.title || 'Pass Milestone'}</h4>
                  <p class="text-xs text-[#47384F] mt-0.5">${ach.description || ''}</p>
                  <div class="w-full bg-[#E4D9C8] h-2 rounded-full mt-2.5 overflow-hidden">
                    <div class="bg-[#B8336A] h-full rounded-full transition-all duration-500" style="width: ${pct}%"></div>
                  </div>
                </div>
                <div class="text-right shrink-0">
                  <span class="font-mono text-xs font-bold text-[#23162B]">${current} / ${target}</span>
                  <span class="block text-[10px] text-[#76667E]">${pct}% complete</span>
                </div>
              </div>
            `;
          }).join("");
        }
      }

      // 4. Issued Collectible Vouchers
      const vouchersGrid = document.getElementById("rewardsVouchersGrid");
      const vouchers = pData.issued_vouchers || [];

      // Calculate category counts
      const now = new Date();
      const isVouchExpired = (v) => v.voucher_status === "expired" || (v.valid_until && new Date(v.valid_until) < now && v.voucher_status !== "redeemed");
      const isVouchRedeemed = (v) => v.voucher_status === "redeemed";
      const isVouchActive = (v) => (v.voucher_status === "active" || v.voucher_status === "available") && !isVouchExpired(v);

      const activeVouchers = vouchers.filter(isVouchActive);
      const redeemedVouchers = vouchers.filter(isVouchRedeemed);
      const expiredVouchers = vouchers.filter(isVouchExpired);

      const vActiveEl = document.getElementById("vouchCountActive");
      const vRedeemedEl = document.getElementById("vouchCountRedeemed");
      const vExpiredEl = document.getElementById("vouchCountExpired");
      if (vActiveEl) vActiveEl.textContent = String(activeVouchers.length);
      if (vRedeemedEl) vRedeemedEl.textContent = String(redeemedVouchers.length);
      if (vExpiredEl) vExpiredEl.textContent = String(expiredVouchers.length);

      function renderVouchersGrid() {
        if (!vouchersGrid) return;

        let filteredVouchers = vouchers;
        if (activeVoucherFilter === "active") filteredVouchers = activeVouchers;
        else if (activeVoucherFilter === "redeemed") filteredVouchers = redeemedVouchers;
        else if (activeVoucherFilter === "expired") filteredVouchers = expiredVouchers;

        if (!filteredVouchers.length) {
          vouchersGrid.innerHTML = `
            <div class="p-6 rounded-2xl bg-[#FAF6F0] border border-[#E4D9C8] col-span-full text-center text-xs text-[#76667E]">
              No vouchers found in this category. Complete festival achievement passes or earn organizer accolades to receive collectible perk coupons!
            </div>
          `;
          return;
        }

        vouchersGrid.innerHTML = filteredVouchers.map((v) => {
          const redeemed = isVouchRedeemed(v);
          const expired = isVouchExpired(v);
          const vType = (v.voucher_type || "perk").toLowerCase();
          const artImg = vType.includes("vip")
            ? "/static/images/badges/voucher_art_vip.svg"
            : vType.includes("workshop") || vType.includes("entry")
            ? "/static/images/badges/voucher_art_workshop.svg"
            : "/static/images/badges/voucher_art_discount.svg";

          const statusBadge = redeemed
            ? `<span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#E5F2EF] text-[#2B6E63]">Redeemed</span>`
            : expired
            ? `<span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#FDECEB] text-[#B9382C]">Expired</span>`
            : `<span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#FBECE6] text-[#B8336A]">Available</span>`;

          const vid = v.issued_voucher_id || v.voucher_id;
          const campTitle = v.campaign_name || v.name || "Festival Perk Voucher";
          const benefit = v.benefit_description || (vType.includes("discount") ? "Percentage discount on pass registration" : "Festival admission perk");

          return `
            <div class="coupon-ticket p-5 rounded-2xl bg-white border border-dashed border-[#CEBFA8] shadow-sm flex flex-col justify-between">
              <div>
                <div class="flex items-start justify-between gap-3 mb-2">
                  <div class="flex items-center gap-2.5">
                    <img src="${artImg}" alt="Voucher" class="voucher-card-art-img w-10 h-10 object-contain shrink-0" />
                    <div>
                      <span class="text-[10px] uppercase font-bold tracking-wider text-[#C85A32]">${vType.replace('_', ' ')}</span>
                      <h4 class="text-base serif-heading text-[#23162B]">${campTitle}</h4>
                    </div>
                  </div>
                  ${statusBadge}
                </div>
                <p class="text-xs text-[#47384F] mt-1">${benefit}</p>
                <div class="mt-3 p-2.5 rounded-xl bg-[#FAF6F0] border border-dashed border-[#CEBFA8] flex items-center justify-between gap-2">
                  <div class="min-w-0">
                    <span class="text-[9px] uppercase font-bold text-[#76667E] block">Voucher Code</span>
                    <strong class="font-mono text-sm tracking-widest text-[#23162B] truncate block">${v.voucher_code}</strong>
                  </div>
                  <div class="flex items-center gap-1.5 shrink-0">
                    <button type="button" data-copy-vouch="${v.voucher_code}" class="btn btn-outline text-[11px] py-1 px-2.5">
                      Copy Code
                    </button>
                    <button type="button" data-open-vouch="${vid}" class="btn btn-outline text-[11px] py-1 px-2">
                      Details
                    </button>
                  </div>
                </div>
              </div>
              <div class="pt-4 mt-3 border-t border-[#E4D9C8] flex items-center justify-between gap-2">
                <span class="text-[10px] text-[#76667E] truncate">${v.festival_name ? `Valid for ${v.festival_name}` : 'Platform-Wide'}</span>
                ${!redeemed && !expired ? `
                  <button type="button" data-redeem-voucher="${vid}" class="redeem-voucher-btn btn btn-primary text-xs py-1.5 px-3 font-bold">
                    Redeem Voucher
                  </button>
                ` : redeemed ? `
                  <span class="text-xs text-[#2B6E63] font-semibold">✓ Redeemed on ${formatDateTime(v.redeemed_at)}</span>
                ` : `
                  <span class="text-xs text-[#B9382C] font-semibold">Expired</span>
                `}
              </div>
            </div>
          `;
        }).join("");

        // Wire Copy Code Buttons
        vouchersGrid.querySelectorAll("[data-copy-vouch]").forEach((btn) => {
          btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const code = btn.getAttribute("data-copy-vouch");
            try {
              await navigator.clipboard.writeText(code);
              const orig = btn.textContent;
              btn.textContent = "✓ Copied!";
              setTimeout(() => { btn.textContent = orig; }, 2000);
              showToast(`Voucher code "${code}" copied to clipboard!`, "success");
            } catch (_err) {
              showToast(`Voucher code: ${code}`, "info");
            }
          });
        });

        // Wire Details Modal Opening
        vouchersGrid.querySelectorAll("[data-open-vouch]").forEach((btn) => {
          btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const vid = Number(btn.getAttribute("data-open-vouch"));
            const targetVouch = vouchers.find((x) => Number(x.issued_voucher_id || x.voucher_id) === vid);
            if (!targetVouch) return;

            const modal = document.getElementById("voucherDetailModal");
            if (!modal) return;

            const isRed = isVouchRedeemed(targetVouch);
            const isExp = isVouchExpired(targetVouch);
            const titleEl = document.getElementById("modalVoucherTitle");
            const descEl = document.getElementById("modalVoucherDesc");
            const codeEl = document.getElementById("modalVoucherCode");
            const expEl = document.getElementById("modalVoucherExpiry");
            const statEl = document.getElementById("modalVoucherStatusBadge");
            const scopeEl = document.getElementById("modalVoucherScope");
            const actBtn = document.getElementById("modalRedeemVoucherActionBtn");

            if (titleEl) titleEl.textContent = targetVouch.campaign_name || targetVouch.name || "Voucher Perk";
            if (descEl) descEl.textContent = targetVouch.benefit_description || "Demonstration academic discount perk";
            if (codeEl) codeEl.textContent = targetVouch.voucher_code;
            if (expEl) expEl.textContent = targetVouch.valid_until ? targetVouch.valid_until.slice(0, 10) : "No Expiry / Platform-Wide";
            if (statEl) {
              statEl.textContent = isRed ? "Redeemed" : isExp ? "Expired" : "Available";
              statEl.className = isRed ? "text-[#2B6E63]" : isExp ? "text-[#B9382C]" : "text-[#B8336A]";
            }
            if (scopeEl) scopeEl.textContent = targetVouch.festival_name ? `Valid for ${targetVouch.festival_name}` : "Platform-Wide";

            if (actBtn) {
              if (isRed) {
                actBtn.textContent = "Already Redeemed";
                actBtn.disabled = true;
              } else if (isExp) {
                actBtn.textContent = "Expired";
                actBtn.disabled = true;
              } else {
                actBtn.textContent = "Redeem Voucher";
                actBtn.disabled = false;
                actBtn.onclick = async () => {
                  actBtn.disabled = true;
                  actBtn.textContent = "Redeeming...";
                  const res = await fetch(`/api/vouchers/${vid}/redeem`, { method: "POST" });
                  const out = await res.json();
                  if (res.ok && out.ok) {
                    showToast(out.message, "success");
                    modal.classList.add("hidden");
                    await renderParticipantRewards();
                  } else {
                    showToast(out.error || "Could not redeem voucher.", "error");
                    actBtn.disabled = false;
                    actBtn.textContent = "Redeem Voucher";
                  }
                };
              }
            }

            const copyModalBtn = document.getElementById("copyModalVoucherCodeBtn");
            if (copyModalBtn) {
              copyModalBtn.onclick = async () => {
                try {
                  await navigator.clipboard.writeText(targetVouch.voucher_code);
                  copyModalBtn.textContent = "✓ Copied!";
                  setTimeout(() => { copyModalBtn.textContent = "Copy"; }, 2000);
                  showToast(`Voucher code copied!`, "success");
                } catch (_e) {
                  showToast(`Code: ${targetVouch.voucher_code}`, "info");
                }
              };
            }

            modal.classList.remove("hidden");
          });
        });

        // Wire 1-Click Redeem Buttons
        vouchersGrid.querySelectorAll(".redeem-voucher-btn").forEach((btn) => {
          btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const vid = btn.getAttribute("data-redeem-voucher");
            btn.disabled = true;
            btn.textContent = "Redeeming...";
            const res = await fetch(`/api/vouchers/${vid}/redeem`, { method: "POST" });
            const out = await res.json();
            if (res.ok && out.ok) {
              showToast(out.message, "success");
              await renderParticipantRewards();
            } else {
              showToast(out.error || "Could not redeem voucher.", "error");
              btn.disabled = false;
              btn.textContent = "Redeem Voucher";
            }
          });
        });
      }

      renderVouchersGrid();

      // Bind voucher filter tabs
      document.querySelectorAll(".voucher-tab-btn").forEach((btn) => {
        btn.onclick = () => {
          activeVoucherFilter = btn.getAttribute("data-voucher-filter") || "all";
          document.querySelectorAll(".voucher-tab-btn").forEach((b) => {
            const isActive = b.getAttribute("data-voucher-filter") === activeVoucherFilter;
            b.className = isActive
              ? "voucher-tab-btn active px-3.5 py-1.5 rounded-full bg-[#23162B] text-white transition"
              : "voucher-tab-btn px-3.5 py-1.5 rounded-full text-[#47384F] hover:bg-white transition";
          });
          renderVouchersGrid();
        };
      });

      // Bind Modal Close Buttons
      document.getElementById("modalCloseVoucherBtn")?.addEventListener("click", () => {
        document.getElementById("voucherDetailModal")?.classList.add("hidden");
      });
      document.getElementById("closeModalVoucherXBtn")?.addEventListener("click", () => {
        document.getElementById("voucherDetailModal")?.classList.add("hidden");
      });

    } catch (err) {
      console.warn("Rewards fetch error:", err);
    }
  }

  let activeLeaderboardCategory = "";
  let activeLeaderboardFestival = "";

  async function renderLeaderboard() {
    try {
      let url = `/api/leaderboard?category=${encodeURIComponent(activeLeaderboardCategory)}`;
      if (activeLeaderboardFestival) {
        url += `&festival_id=${encodeURIComponent(activeLeaderboardFestival)}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (!data.ok) return;

      const rows = data.leaderboard || [];

      // 1. Personal Standing Highlight Banner
      const currUser = data.current_user || state.dashboardData?.user || {};
      const userRow = rows.find((u) => u.user_id === currUser.user_id || u.full_name === currUser.full_name);

      const bannerName = document.getElementById("lbBannerUserName");
      const bannerInit = document.getElementById("lbBannerUserInitials");
      const bannerRank = document.getElementById("lbBannerUserRank");
      const bannerPts = document.getElementById("lbBannerUserPoints");

      const displayName = currUser.full_name || "Platform Explorer";
      if (bannerName) bannerName.textContent = displayName;
      if (bannerInit) {
        const parts = displayName.split(" ");
        bannerInit.textContent = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : displayName.slice(0, 2).toUpperCase();
      }
      if (bannerRank) bannerRank.textContent = userRow ? `#${userRow.rank}` : "#—";
      if (bannerPts) bannerPts.textContent = String(userRow ? userRow.total_points : 0);

      // 2. Top-3 Podium Layout
      const podiumRow = document.getElementById("leaderboardPodiumRow");
      if (podiumRow) {
        if (!rows.length) {
          podiumRow.innerHTML = `<p class="col-span-full text-center text-xs text-[#76667E] py-4">No ranked participants yet.</p>`;
        } else {
          const first = rows[0];
          const second = rows.length > 1 ? rows[1] : null;
          const third = rows.length > 2 ? rows[2] : null;

          const renderPodiumCard = (u, rank, podiumClass, medalLabel) => {
            if (!u) return `<div class="hidden md:block"></div>`;
            const isFirst = rank === 1;
            return `
              <div class="podium-card ${podiumClass} p-5 rounded-2xl border text-center flex flex-col items-center justify-between ${isFirst ? 'md:-translate-y-2' : ''}">
                <div class="flex flex-col items-center">
                  <span class="inline-block px-3 py-1 rounded-full text-xs font-bold font-mono uppercase tracking-wider mb-2.5 ${
                    rank === 1 ? 'rank-pill-1' : rank === 2 ? 'rank-pill-2' : 'rank-pill-3'
                  }">${medalLabel}</span>
                  <div class="w-14 h-14 rounded-full bg-[#E4D9C8] flex items-center justify-center font-bold text-base text-[#47384F] shadow-sm mb-2 overflow-hidden">
                    ${u.avatar_url ? `<img src="${u.avatar_url}" alt="${u.full_name}" class="w-full h-full object-cover" />` : u.full_name.charAt(0)}
                  </div>
                  <strong class="text-sm font-bold text-[#23162B] block truncate max-w-[160px]">${u.full_name}</strong>
                  <span class="text-[10px] text-[#76667E] block">${u.primary_focus || 'Campus Explorer'}</span>
                </div>
                <div class="mt-3 pt-3 border-t border-[#E4D9C8] w-full grid grid-cols-2 gap-1 text-[11px]">
                  <div>
                    <span class="text-[9px] text-[#76667E] uppercase block">Check-Ins</span>
                    <strong class="font-mono text-[#2B6E63]">${u.verified_attendances}</strong>
                  </div>
                  <div>
                    <span class="text-[9px] text-[#76667E] uppercase block">Badges</span>
                    <strong class="font-mono text-[#C85A32]">${u.badges_count}</strong>
                  </div>
                  <div class="col-span-2 pt-1 text-center">
                    <span class="font-mono text-base font-bold text-[#23162B]">${u.total_points}</span>
                    <span class="text-[10px] text-[#76667E]"> pts</span>
                  </div>
                </div>
              </div>
            `;
          };

          podiumRow.innerHTML = `
            ${renderPodiumCard(second, 2, "podium-2", "2nd Place")}
            ${renderPodiumCard(first, 1, "podium-1", "1st Champion")}
            ${renderPodiumCard(third, 3, "podium-3", "3rd Place")}
          `;
        }
      }

      // 3. Populate festival dropdown if needed
      const festSel = document.getElementById("leaderboardFestivalSelect");
      if (festSel && festSel.options.length <= 1 && state.dashboardData?.festivals) {
        state.dashboardData.festivals.forEach((f) => {
          const opt = document.createElement("option");
          opt.value = f.festival_id;
          opt.textContent = f.name;
          festSel.appendChild(opt);
        });
        festSel.addEventListener("change", (e) => {
          activeLeaderboardFestival = e.target.value;
          renderLeaderboard();
        });
      }

      // 4. Wire category filter pills
      const filterPills = document.querySelectorAll(".lb-cat-btn");
      filterPills.forEach((btn) => {
        btn.onclick = () => {
          activeLeaderboardCategory = btn.getAttribute("data-lb-category") || "";
          filterPills.forEach((b) => {
            const isActive = (b.getAttribute("data-lb-category") || "") === activeLeaderboardCategory;
            b.className = isActive
              ? "lb-cat-btn px-3.5 py-1.5 rounded-full font-semibold border bg-[#23162B] text-white border-[#23162B]"
              : "lb-cat-btn px-3.5 py-1.5 rounded-full font-semibold border bg-white text-[#47384F] border-[#CEBFA8] hover:border-[#23162B]";
          });
          renderLeaderboard();
        };
      });

      // 5. Table rows: Show ranks 4 and beyond if podium is present, or all if <= 3
      const tableRows = rows.length > 3 ? rows.slice(3) : rows;

      const makeRowsHTML = () => {
        if (!tableRows.length) {
          return `<tr><td colspan="6" class="py-6 text-center text-[#76667E]">No additional participant rankings in this category.</td></tr>`;
        }
        return tableRows.map((u) => {
          const rankPill = `<span class="font-mono font-bold text-[#76667E]">#${u.rank}</span>`;
          const avatarHTML = u.avatar_url
            ? `<img src="${u.avatar_url}" alt="${u.full_name}" class="w-8 h-8 rounded-full object-cover shrink-0" />`
            : `<div class="w-8 h-8 rounded-full bg-[#E4D9C8] flex items-center justify-center font-bold text-xs text-[#47384F] shrink-0">${u.full_name.charAt(0)}</div>`;

          return `
            <tr class="leaderboard-row hover:bg-[#FAF6F0] transition">
              <td class="py-3 px-3 w-16 text-center">${rankPill}</td>
              <td class="py-3 px-3">
                <div class="flex items-center gap-2.5">
                  ${avatarHTML}
                  <div>
                    <strong class="text-[#23162B] block text-xs">${u.full_name}</strong>
                    <span class="text-[10px] text-[#76667E]">${u.total_registrations} events registered</span>
                  </div>
                </div>
              </td>
              <td class="py-3 px-3">
                <span class="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[#FAF6F0] border border-[#E4D9C8] text-[#47384F]">
                  ${u.primary_focus || 'Explorer'}
                </span>
              </td>
              <td class="py-3 px-3 text-center font-mono font-semibold text-[#2B6E63]">${u.verified_attendances}</td>
              <td class="py-3 px-3 text-center font-mono font-semibold text-[#C85A32]">${u.badges_count}</td>
              <td class="py-3 px-3 text-right">
                <strong class="font-mono text-sm text-[#23162B]">${u.total_points}</strong>
                <span class="text-[10px] text-[#76667E] block">pts</span>
              </td>
            </tr>
          `;
        }).join("");
      };

      const pBody = document.getElementById("participantLeaderboardTableBody");
      if (pBody) pBody.innerHTML = makeRowsHTML();

      const aBody = document.getElementById("adminLeaderboardTableBody");
      if (aBody) aBody.innerHTML = makeRowsHTML();

      // 6. Wire Scoring Modal
      const openRulesBtn = document.getElementById("openLeaderboardRulesBtn");
      const rulesModal = document.getElementById("leaderboardScoringModal");
      const closeRulesBtn = document.getElementById("closeLbScoringModalBtn");
      const closeRulesOkBtn = document.getElementById("closeLbScoringModalOkBtn");

      if (openRulesBtn && rulesModal && !openRulesBtn.dataset.bound) {
        openRulesBtn.dataset.bound = "true";
        openRulesBtn.addEventListener("click", () => rulesModal.classList.remove("hidden"));
      }
      if (closeRulesBtn && rulesModal && !closeRulesBtn.dataset.bound) {
        closeRulesBtn.dataset.bound = "true";
        closeRulesBtn.addEventListener("click", () => rulesModal.classList.add("hidden"));
      }
      if (closeRulesOkBtn && rulesModal && !closeRulesOkBtn.dataset.bound) {
        closeRulesOkBtn.dataset.bound = "true";
        closeRulesOkBtn.addEventListener("click", () => rulesModal.classList.add("hidden"));
      }

    } catch (err) {
      console.warn("Leaderboard fetch error:", err);
    }
  }

  const availableBadgeArtworks = [
    { path: "/static/images/badges/badge_tech_trailblazer.svg", label: "Tech Trailblazer" },
    { path: "/static/images/badges/badge_cultural_explorer.svg", label: "Cultural Explorer" },
    { path: "/static/images/badges/badge_music_connoisseur.svg", label: "Music Connoisseur" },
    { path: "/static/images/badges/badge_gaming_champion.svg", label: "Gaming Champion" },
    { path: "/static/images/badges/badge_guild_artisan.svg", label: "Guild Artisan" },
    { path: "/static/images/badges/badge_community_spirit.svg", label: "Community Spirit" },
    { path: "/static/images/badges/badge_venture_rocket.svg", label: "Venture Rocket" },
    { path: "/static/images/badges/badge_festival_finisher.svg", label: "Festival Finisher" },
    { path: "/static/images/badges/badge_first_experience.svg", label: "First Experience" },
    { path: "/static/images/badges/badge_all_round_explorer.svg", label: "All-Round Explorer" },
  ];

  async function renderOrganizerPasses() {
    try {
      const res = await fetch("/api/organizer/achievement-passes");
      const data = await res.json();
      if (!data.ok) return;

      const passes = data.passes || [];
      const managedEvents = data.managed_events || [];
      const campaigns = data.voucher_campaigns || [];

      // Populate target event dropdown
      const evSel = document.getElementById("passTargetEventSelect");
      if (evSel) {
        evSel.innerHTML = `<option value="">Select an Authorized Event...</option>` +
          managedEvents.map((ev) => `<option value="${ev.event_id}">${ev.event_name} (${ev.festival_name})</option>`).join("");
      }

      // Populate voucher campaign dropdown
      const campSel = document.getElementById("passVoucherCampaignSelect");
      if (campSel) {
        campSel.innerHTML = `<option value="">No Voucher Linked</option>` +
          campaigns.map((c) => `<option value="${c.campaign_id}">${c.name} (${c.discount_percent}% / ${c.voucher_type})</option>`).join("");
      }

      // Render Artwork Picker
      const artPicker = document.getElementById("passArtworkPicker");
      const hiddenArtInput = document.getElementById("selectedBadgeArtInput");
      if (artPicker && hiddenArtInput) {
        artPicker.innerHTML = availableBadgeArtworks.map((art) => {
          const isSelected = art.path === hiddenArtInput.value;
          return `
            <button type="button" data-art-path="${art.path}" class="art-pick-btn p-2 rounded-xl border-2 flex flex-col items-center gap-1.5 transition ${isSelected ? 'border-[#C85A32] bg-[#FBECE6]' : 'border-[#CEBFA8] bg-white hover:border-[#23162B]'}">
              <img src="${art.path}" alt="${art.label}" class="w-10 h-10 object-contain" />
              <span class="text-[10px] text-center font-medium leading-tight truncate w-full">${art.label}</span>
            </button>
          `;
        }).join("");

        artPicker.querySelectorAll(".art-pick-btn").forEach((btn) => {
          btn.addEventListener("click", () => {
            const p = btn.getAttribute("data-art-path");
            hiddenArtInput.value = p;
            artPicker.querySelectorAll(".art-pick-btn").forEach((b) => {
              const sel = b.getAttribute("data-art-path") === p;
              b.className = `art-pick-btn p-2 rounded-xl border-2 flex flex-col items-center gap-1.5 transition ${sel ? 'border-[#C85A32] bg-[#FBECE6]' : 'border-[#CEBFA8] bg-white hover:border-[#23162B]'}`;
            });
          });
        });
      }

      // Render organizer passes list
      const passesList = document.getElementById("organizerPassesList");
      if (passesList) {
        if (!passes.length) {
          passesList.innerHTML = `
            <div class="p-6 rounded-2xl bg-[#FAF6F0] border border-[#E4D9C8] col-span-full text-center text-xs text-[#76667E]">
              You haven't created any custom achievement passes yet. Achievement passes are completely optional. Click "+ Create New Pass" above to publish your first pass.
            </div>
          `;
        } else {
          passesList.innerHTML = passes.map((pass) => `
            <div class="p-5 rounded-2xl bg-[#FAF6F0] border border-[#CEBFA8] flex flex-col justify-between">
              <div>
                <div class="flex items-start justify-between gap-3 mb-2">
                  <div class="flex items-center gap-3">
                    <img src="${pass.badge_artwork_url || '/static/images/badges/badge_tech_trailblazer.svg'}" alt="${pass.pass_title}" class="w-12 h-12 object-contain" />
                    <div>
                      <h4 class="text-base serif-heading text-[#23162B]">${pass.pass_title}</h4>
                      <span class="text-[10px] text-[#76667E] block">${pass.event_name ? `Event: ${pass.event_name}` : `Festival: ${pass.festival_name}`}</span>
                    </div>
                  </div>
                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${pass.is_active ? 'bg-[#E5F2EF] text-[#2B6E63]' : 'bg-white border border-[#CEBFA8] text-[#76667E]'}">
                    ${pass.is_active ? 'Active' : 'Draft'}
                  </span>
                </div>
                <p class="text-xs text-[#47384F] mt-1">${pass.pass_description}</p>
                <div class="mt-3 text-xs bg-white p-2.5 rounded-xl border border-[#E4D9C8] space-y-1">
                  <p class="text-[#76667E]"><strong>Condition:</strong> ${pass.condition_type} &times; ${pass.condition_target_count}</p>
                  ${pass.linked_voucher_campaign_name ? `<p class="text-[#C85A32]"><strong>Reward Perk:</strong> ${pass.linked_voucher_campaign_name}</p>` : ''}
                </div>
              </div>
              <div class="pt-4 mt-3 border-t border-[#E4D9C8] flex items-center justify-between">
                <span class="text-xs font-mono font-bold text-[#23162B]">${pass.total_earners || 0} participants earned</span>
                <div class="flex gap-2">
                  <button type="button" data-toggle-pass="${pass.pass_id}" data-current-active="${pass.is_active ? 'true' : 'false'}" class="toggle-pass-btn btn btn-outline text-xs py-1 px-2.5">
                    ${pass.is_active ? 'Save as Draft' : 'Activate'}
                  </button>
                  <button type="button" data-delete-pass="${pass.pass_id}" class="delete-pass-btn text-xs font-bold text-[#B9382C] hover:underline px-2">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          `).join("");

          passesList.querySelectorAll(".toggle-pass-btn").forEach((btn) => {
            btn.addEventListener("click", async () => {
              const pid = btn.getAttribute("data-toggle-pass");
              const currentActive = btn.getAttribute("data-current-active") === "true";
              const res = await fetch(`/api/organizer/achievement-passes/${pid}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ is_active: !currentActive }),
              });
              const out = await res.json();
              if (res.ok && out.ok) {
                showToast(out.message, "success");
                await renderOrganizerPasses();
                await renderOrganizerRewardPerformance();
              } else {
                showToast(out.error || "Could not update pass status.", "error");
              }
            });
          });

          passesList.querySelectorAll(".delete-pass-btn").forEach((btn) => {
            btn.addEventListener("click", async () => {
              const pid = btn.getAttribute("data-delete-pass");
              if (!confirm("Are you sure you want to delete this achievement pass?")) return;
              const res = await fetch(`/api/organizer/achievement-passes/${pid}`, { method: "DELETE" });
              const out = await res.json();
              if (res.ok && out.ok) {
                showToast(out.message, "success");
                await renderOrganizerPasses();
                await renderOrganizerRewardPerformance();
              } else {
                showToast(out.error || "Could not delete pass.", "error");
              }
            });
          });
        }
      }

      // Bind pass form submit if not already bound
      const passForm = document.getElementById("organizerPassForm");
      if (passForm && !passForm.dataset.bound) {
        passForm.dataset.bound = "true";
        passForm.addEventListener("submit", async (e) => {
          e.preventDefault();
          const target_event_id = Number(document.getElementById("passTargetEventSelect").value);
          const evObj = managedEvents.find((m) => m.event_id === target_event_id);
          const festival_id = evObj ? evObj.festival_id : null;
          const payload = {
            title: document.getElementById("passTitleInput").value.trim(),
            description: document.getElementById("passDescriptionInput").value.trim(),
            target_event_id: target_event_id || null,
            target_festival_id: festival_id,
            badge_artwork_url: document.getElementById("selectedBadgeArtInput").value,
            condition_type: document.getElementById("passConditionTypeSelect").value,
            condition_target_count: Number(document.getElementById("passTargetCountInput").value || 1),
            voucher_campaign_id: Number(document.getElementById("passVoucherCampaignSelect").value) || null,
            is_active: document.getElementById("passIsActiveCheckbox").checked,
          };

          const createRes = await fetch("/api/organizer/achievement-passes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const createData = await createRes.json();
          if (createRes.ok && createData.ok) {
            showToast(createData.message, "success");
            passForm.reset();
            document.getElementById("selectedBadgeArtInput").value = "/static/images/badges/badge_tech_trailblazer.svg";
            await renderOrganizerPasses();
            await renderOrganizerRewardPerformance();
          } else {
            showToast(createData.error || "Could not create achievement pass.", "error");
          }
        });
      }

      // Toggle pass form container button
      const toggleBtn = document.getElementById("toggleCreatePassFormBtn");
      const formContainer = document.getElementById("createPassFormContainer");
      if (toggleBtn && formContainer && !toggleBtn.dataset.bound) {
        toggleBtn.dataset.bound = "true";
        toggleBtn.addEventListener("click", () => {
          formContainer.classList.toggle("hidden");
        });
      }

    } catch (err) {
      console.warn("Organizer passes fetch error:", err);
    }
  }

  async function renderOrganizerRewardPerformance() {
    try {
      const res = await fetch("/api/organizer/reward-performance");
      const data = await res.json();
      if (!data.ok) return;

      const perf = data.performance;
      if (!perf) return;

      const actEl = document.getElementById("orgPerfActivePasses");
      const earnEl = document.getElementById("orgPerfTotalEarners");
      const vouchEl = document.getElementById("orgPerfVouchersDistributed");
      if (actEl) actEl.textContent = String(perf.active_passes || 0);
      if (earnEl) earnEl.textContent = String(perf.total_earners || 0);
      if (vouchEl) vouchEl.textContent = String(perf.vouchers_distributed || 0);

      const tableBody = document.getElementById("orgRewardEarnersTableBody");
      const recentEarners = perf.recent_earners || [];
      if (tableBody) {
        if (!recentEarners.length) {
          tableBody.innerHTML = `<tr><td colspan="4" class="py-6 text-center text-[#76667E]">No participants have unlocked your passes yet. Check back once events are checked in!</td></tr>`;
        } else {
          tableBody.innerHTML = recentEarners.map((r) => `
            <tr>
              <td class="py-3 px-3">
                <div class="flex items-center gap-2">
                  <img src="${r.badge_icon_path || '/static/images/badges/badge_tech_trailblazer.svg'}" alt="" class="w-7 h-7 object-contain" />
                  <strong class="text-[#23162B]">${r.badge_title}</strong>
                </div>
              </td>
              <td class="py-3 px-3">${r.participant_name}</td>
              <td class="py-3 px-3 text-[#76667E]">${r.event_name || 'Festival Scope'}</td>
              <td class="py-3 px-3 text-right font-mono text-[#76667E]">${formatDateTime(r.awarded_at)}</td>
            </tr>
          `).join("");
        }
      }
    } catch (err) {
      console.warn("Organizer perf fetch error:", err);
    }
  }

  async function renderAdminVouchers() {
    try {
      const res = await fetch("/api/admin/voucher-campaigns");
      const data = await res.json();
      if (!data.ok) return;

      const campaigns = data.campaigns || [];
      const metrics = data.summary_metrics || {};
      const recentVouchers = data.recent_vouchers || [];
      const users = data.users || [];
      const festivals = data.festivals || [];

      // Update metrics
      const setMetric = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(val);
      };
      setMetric("admMetricAllocated", metrics.total_allocated || 0);
      setMetric("admMetricIssued", metrics.total_issued || 0);
      setMetric("admMetricRedeemed", metrics.total_redeemed || 0);
      setMetric("admMetricRemaining", metrics.total_remaining || 0);
      setMetric("admMetricExpired", metrics.total_expired || 0);
      const rateEl = document.getElementById("admMetricRate");
      if (rateEl) rateEl.textContent = `${metrics.redemption_rate_percent || 0}%`;

      // Populate campaign form festival select
      const festSel = document.getElementById("admCampFestivalSelect");
      if (festSel && festSel.options.length <= 1) {
        festSel.innerHTML = `<option value="">All Platform Festivals</option>` +
          festivals.map((f) => `<option value="${f.festival_id}">${f.name}</option>`).join("");
      }

      // Populate issue voucher campaign and user select
      const issueCampSel = document.getElementById("issueVoucherCampaignSelect");
      if (issueCampSel) {
        issueCampSel.innerHTML = campaigns
          .filter((c) => c.status === "active")
          .map((c) => `<option value="${c.campaign_id}">${c.name} (${c.remaining_quantity} left)</option>`)
          .join("");
      }
      const issueUserSel = document.getElementById("issueVoucherUserSelect");
      if (issueUserSel) {
        issueUserSel.innerHTML = users
          .map((u) => `<option value="${u.user_id}">${u.full_name} (${u.role})</option>`)
          .join("");
      }

      // Render campaigns table with Search, Filter & View Distribution
      let campSearchTerm = "";
      let campStatusFilterVal = "all";

      const campBody = document.getElementById("adminVoucherCampaignsTableBody");
      const searchInput = document.getElementById("admCampSearchInput");
      const statusSelect = document.getElementById("admCampStatusFilter");

      function filterAndRenderCampaigns() {
        if (!campBody) return;
        const q = campSearchTerm.toLowerCase();
        const filtered = campaigns.filter((c) => {
          const matchQuery = !q || `${c.name} ${c.voucher_type} ${c.festival_name || ''} ${c.benefit_description || ''}`.toLowerCase().includes(q);
          const matchStatus = campStatusFilterVal === "all" || c.status === campStatusFilterVal;
          return matchQuery && matchStatus;
        });

        if (!filtered.length) {
          campBody.innerHTML = `<tr><td colspan="9" class="py-6 text-center text-[#76667E]">No voucher campaigns match your search / filter criteria.</td></tr>`;
          return;
        }

        campBody.innerHTML = filtered.map((c) => `
          <tr>
            <td class="py-3 px-3">
              <strong class="block text-[#23162B]">${c.name}</strong>
              <span class="text-[10px] text-[#76667E]">${c.festival_name || 'All Platform Festivals'}</span>
            </td>
            <td class="py-3 px-3">
              <span class="text-[11px] font-semibold text-[#C85A32] block">${c.voucher_type.replace('_', ' ')}</span>
              <span class="text-[10px] text-[#76667E]">${c.benefit_description}</span>
            </td>
            <td class="py-3 px-3 text-center font-mono font-semibold">${c.total_quantity}</td>
            <td class="py-3 px-3 text-center font-mono font-semibold text-[#C85A32]">${c.issued_count}</td>
            <td class="py-3 px-3 text-center font-mono font-semibold text-[#2B6E63]">${c.redeemed_count}</td>
            <td class="py-3 px-3 text-center font-mono font-bold text-[#23162B]">${c.remaining_quantity}</td>
            <td class="py-3 px-3 font-mono text-[#76667E]">${c.valid_until ? c.valid_until.slice(0, 10) : 'Ongoing'}</td>
            <td class="py-3 px-3">
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${c.status === 'active' ? 'bg-[#E5F2EF] text-[#2B6E63]' : 'bg-[#FAF6F0] text-[#76667E]'}">
                ${c.status}
              </span>
            </td>
            <td class="py-3 px-3 text-right">
              <button type="button" data-view-dist="${c.campaign_id}" class="btn btn-outline text-[11px] py-1 px-2.5">
                View Distribution
              </button>
            </td>
          </tr>
        `).join("");

        // Wire View Distribution Buttons
        campBody.querySelectorAll("[data-view-dist]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const cid = Number(btn.getAttribute("data-view-dist"));
            const targetCamp = campaigns.find((x) => x.campaign_id === cid);
            if (!targetCamp) return;

            const modal = document.getElementById("admCampaignDistributionModal");
            const titleEl = document.getElementById("admDistModalTitle");
            const statsEl = document.getElementById("admDistModalStats");
            const tableBody = document.getElementById("admDistModalTableBody");
            if (!modal) return;

            if (titleEl) titleEl.textContent = `${targetCamp.name} — Distribution Records`;
            if (statsEl) {
              statsEl.innerHTML = `
                <div class="p-2.5 rounded-xl bg-[#FAF6F0] border border-[#E4D9C8] text-center">
                  <span class="text-[9px] uppercase font-bold text-[#76667E] block">Allocated</span>
                  <strong class="font-mono text-sm text-[#23162B]">${targetCamp.total_quantity}</strong>
                </div>
                <div class="p-2.5 rounded-xl bg-[#FAF6F0] border border-[#E4D9C8] text-center">
                  <span class="text-[9px] uppercase font-bold text-[#76667E] block">Issued</span>
                  <strong class="font-mono text-sm text-[#C85A32]">${targetCamp.issued_count}</strong>
                </div>
                <div class="p-2.5 rounded-xl bg-[#FAF6F0] border border-[#E4D9C8] text-center">
                  <span class="text-[9px] uppercase font-bold text-[#76667E] block">Redeemed</span>
                  <strong class="font-mono text-sm text-[#2B6E63]">${targetCamp.redeemed_count}</strong>
                </div>
                <div class="p-2.5 rounded-xl bg-[#FAF6F0] border border-[#E4D9C8] text-center">
                  <span class="text-[9px] uppercase font-bold text-[#76667E] block">Remaining</span>
                  <strong class="font-mono text-sm text-[#23162B]">${targetCamp.remaining_quantity}</strong>
                </div>
              `;
            }

            const matchingVouchers = recentVouchers.filter((v) => v.campaign_id === cid || v.campaign_name === targetCamp.name);
            if (tableBody) {
              if (!matchingVouchers.length) {
                tableBody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-[#76667E]">No vouchers issued under this campaign yet. Use Direct Voucher Distribution below to grant perks.</td></tr>`;
              } else {
                tableBody.innerHTML = matchingVouchers.map((v) => `
                  <tr>
                    <td class="py-2.5 px-3 font-mono font-bold text-[#23162B]">${v.voucher_code}</td>
                    <td class="py-2.5 px-3">${v.recipient_name}</td>
                    <td class="py-2.5 px-3 text-[#76667E]">${formatDateTime(v.issued_at)}</td>
                    <td class="py-2.5 px-3 text-[#76667E]">${v.valid_until ? v.valid_until.slice(0, 10) : 'Never'}</td>
                    <td class="py-2.5 px-3">
                      <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${v.voucher_status === 'redeemed' ? 'bg-[#E5F2EF] text-[#2B6E63]' : 'bg-[#FBECE6] text-[#C85A32]'}">
                        ${v.voucher_status}
                      </span>
                    </td>
                  </tr>
                `).join("");
              }
            }

            modal.classList.remove("hidden");
          });
        });
      }

      filterAndRenderCampaigns();

      if (searchInput && !searchInput.dataset.bound) {
        searchInput.dataset.bound = "true";
        searchInput.addEventListener("input", (e) => {
          campSearchTerm = e.target.value.trim();
          filterAndRenderCampaigns();
        });
      }

      if (statusSelect && !statusSelect.dataset.bound) {
        statusSelect.dataset.bound = "true";
        statusSelect.addEventListener("change", (e) => {
          campStatusFilterVal = e.target.value;
          filterAndRenderCampaigns();
        });
      }

      // Wire close modal buttons for distribution inspection drawer
      document.getElementById("closeAdmDistModalBtn")?.addEventListener("click", () => {
        document.getElementById("admCampaignDistributionModal")?.classList.add("hidden");
      });
      document.getElementById("closeAdmDistModalOkBtn")?.addEventListener("click", () => {
        document.getElementById("admCampaignDistributionModal")?.classList.add("hidden");
      });

      // Render recent vouchers table
      const vouchersBody = document.getElementById("adminRecentVouchersTableBody");
      if (vouchersBody) {
        if (!recentVouchers.length) {
          vouchersBody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-[#76667E]">No vouchers issued yet.</td></tr>`;
        } else {
          vouchersBody.innerHTML = recentVouchers.map((v) => `
            <tr>
              <td class="py-3 px-3 font-mono font-bold text-[#23162B]">${v.voucher_code}</td>
              <td class="py-3 px-3">${v.campaign_name}</td>
              <td class="py-3 px-3">${v.recipient_name}</td>
              <td class="py-3 px-3 text-[#76667E]">${formatDateTime(v.issued_at)}</td>
              <td class="py-3 px-3">
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${v.voucher_status === 'redeemed' ? 'bg-[#E5F2EF] text-[#2B6E63]' : 'bg-[#FBECE6] text-[#C85A32]'}">
                  ${v.voucher_status}
                </span>
              </td>
            </tr>
          `).join("");
        }
      }

      // Bind admin voucher campaign form submit
      const campaignForm = document.getElementById("adminVoucherCampaignForm");
      if (campaignForm && !campaignForm.dataset.bound) {
        campaignForm.dataset.bound = "true";
        campaignForm.addEventListener("submit", async (e) => {
          e.preventDefault();
          const discount = Number(document.getElementById("admCampDiscount").value || 0);
          const quantity = Number(document.getElementById("admCampQuantity").value || 0);
          if (discount < 0 || discount > 100) {
            showToast("Discount percentage must be between 0 and 100.", "error");
            return;
          }
          if (quantity <= 0) {
            showToast("Total quantity must be greater than zero.", "error");
            return;
          }

          const payload = {
            name: document.getElementById("admCampTitle").value.trim(),
            voucher_type: document.getElementById("admCampType").value,
            discount_percent: discount,
            benefit_description: document.getElementById("admCampBenefit").value.trim(),
            total_quantity: quantity,
            valid_from: document.getElementById("admCampValidFrom").value,
            valid_until: document.getElementById("admCampValidUntil").value,
            festival_id: Number(document.getElementById("admCampFestivalSelect").value) || null,
          };

          const postRes = await fetch("/api/admin/voucher-campaigns", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const postData = await postRes.json();
          if (postRes.ok && postData.ok) {
            showToast(postData.message, "success");
            campaignForm.reset();
            await renderAdminVouchers();
          } else {
            showToast(postData.error || "Could not launch voucher campaign.", "error");
          }
        });
      }

      // Bind direct issue voucher form
      const issueForm = document.getElementById("adminIssueVoucherForm");
      if (issueForm && !issueForm.dataset.bound) {
        issueForm.dataset.bound = "true";
        issueForm.addEventListener("submit", async (e) => {
          e.preventDefault();
          const campaign_id = Number(document.getElementById("issueVoucherCampaignSelect").value);
          const user_id = Number(document.getElementById("issueVoucherUserSelect").value);
          if (!campaign_id || !user_id) {
            showToast("Please select both a voucher campaign and a recipient.", "error");
            return;
          }

          const issueRes = await fetch("/api/admin/vouchers/issue", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ campaign_id, user_id }),
          });
          const issueData = await issueRes.json();
          if (issueRes.ok && issueData.ok) {
            showToast(issueData.message, "success");
            await renderAdminVouchers();
          } else {
            showToast(issueData.error || "Could not issue voucher.", "error");
          }
        });
      }

      // Toggle form button
      const toggleCampBtn = document.getElementById("toggleAdminCampaignFormBtn");
      const campFormContainer = document.getElementById("adminCampaignFormContainer");
      if (toggleCampBtn && campFormContainer && !toggleCampBtn.dataset.bound) {
        toggleCampBtn.dataset.bound = "true";
        toggleCampBtn.addEventListener("click", () => {
          campFormContainer.classList.toggle("hidden");
        });
      }

    } catch (err) {
      console.warn("Admin vouchers fetch error:", err);
    }
  }

  // --------------------------------------------------------------------------
  // BOOTSTRAP BY CURRENT PAGE
  // --------------------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    const page = document.body.getAttribute("data-page");
    if (page === "landing") initLandingPage();
    else if (page === "auth") initAuthPage();
    else if (page === "dashboard") initDashboardPage();
  });
})();
