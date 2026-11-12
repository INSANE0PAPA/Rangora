import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { DotField } from "@/components/DotField";
import { EventPulseGallery } from "@/components/EventPulseGallery";
import { fetchPulseEchoes, executeReportEcho, type PulseEchoItem } from "@/lib/api.functions";
import { Sparkles, Camera, ShieldCheck, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/pulse")({
  head: () => ({
    meta: [
      { title: "Event Pulse — Campus Memories & Moments · Rangora" },
      {
        name: "description",
        content:
          "Explore unfiltered attendee reviews, candid photographs, and shared moments from collegiate festivals across West Bengal.",
      },
      { property: "og:title", content: "Event Pulse — Campus Memories & Moments · Rangora" },
      {
        property: "og:description",
        content:
          "Discover genuine student stories, stage photos, and festival reflections curated from verified attendees.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: EventPulsePage,
});

function EventPulsePage() {
  const queryClient = useQueryClient();
  const getEchoes = useServerFn(fetchPulseEchoes);
  const reportEcho = useServerFn(executeReportEcho);

  const { data: echoes = [], isLoading } = useQuery<PulseEchoItem[]>({
    queryKey: ["pulse-echoes"],
    queryFn: () => getEchoes({ data: { sortBy: "recent" } }),
  });

  const reportMutation = useMutation({
    mutationFn: async (echoId: string) => {
      await reportEcho({ data: { echoId } });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pulse-echoes"] });
    },
  });

  return (
    <div className="min-h-screen bg-ivory text-ink flex flex-col justify-between">
      <SiteHeader />

      {/* HERO SECTION */}
      <section className="relative overflow-hidden border-b border-line bg-parchment py-12 lg:py-16">
        <DotField />
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-4 animate-rise">
            <div className="inline-flex items-center gap-2 rounded-full border border-terracotta/40 bg-saffron-soft px-3.5 py-1 text-xs font-bold text-terracotta">
              <Camera size={14} />
              <span>COMMUNITY DISCOVERY GALLERY</span>
            </div>

            <h1 className="hero-headline text-4xl sm:text-5xl lg:text-6xl font-bold">
              The Living Pulse of Campus Culture.
            </h1>

            <p className="text-base sm:text-lg text-ink-body leading-relaxed max-w-2xl">
              Authentic reflections, stage snapshots, and workshop creations shared directly by verified
              attendees. Every moment is preserved with consent and curated for the Bengal collegiate community.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-ink-muted">
              <span className="flex items-center gap-1.5 font-semibold">
                <ShieldCheck size={15} className="text-sage" />
                Verified Student Passes
              </span>
              <span>·</span>
              <span className="flex items-center gap-1.5 font-semibold">
                <Sparkles size={15} className="text-terracotta" />
                Organiser-Endorsed Moments
              </span>
              <span>·</span>
              <Link
                to="/demo"
                className="font-bold text-terracotta hover:underline inline-flex items-center gap-1"
              >
                Try Direct Demo Workspace <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* MAIN GALLERY SECTION */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="brutal-card h-80 bg-paper animate-pulse p-4 space-y-4">
                <div className="h-44 bg-parchment rounded-md" />
                <div className="h-4 bg-line rounded w-3/4" />
                <div className="h-3 bg-line rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <EventPulseGallery
            initialEchoes={echoes}
            onReport={async (echoId) => {
              await reportMutation.mutateAsync(echoId);
            }}
          />
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
