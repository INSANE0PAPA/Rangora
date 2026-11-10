import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchLeaderboard } from "@/lib/api.functions";
import { Trophy, Medal, Crown, Flame, Zap, Sparkles, Award, TrendingUp } from "lucide-react";

type Row = { user_id: string; display_name: string; department: string | null; points: number };
const ROW = 74;

function CountUp({ value }: { value: number }) {
  const [n, setN] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = from.current;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 900);
      const v = Math.round(start + (value - start) * (1 - Math.pow(1 - k, 3)));
      setN(v);
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{n}</>;
}

/** Live, animated leaderboard with Neo-Brutalist podium, vector icons and tilted status accents. */
export function Leaderboard({ me, isDemo }: { me: string; isDemo?: boolean | undefined }) {
  const qc = useQueryClient();
  const isDemoMode =
    isDemo ??
    (typeof window !== "undefined" &&
      (window.location.pathname.startsWith("/demo") || me.startsWith("d3300")));

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["leaderboard", isDemoMode ? "demo" : "prod"],
    queryFn: async () => {
      const data = await fetchLeaderboard({ data: { limit: 25, isDemo: isDemoMode } });
      return (data || []) as Row[];
    },
  });
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    const ch = supabase
      .channel(`leaderboard-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "leaderboard" }, (p) => {
        setFlash((p.new as Row)?.user_id ?? null);
        qc.invalidateQueries({ queryKey: ["leaderboard"] });
        setTimeout(() => setFlash(null), 1500);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  if (isLoading) {
    return (
      <div className="brutal-card p-10 text-center text-sm text-ink-muted">
        <div className="mx-auto w-12 h-12 rounded-full border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] bg-saffron text-black flex items-center justify-center animate-spin">
          <Sparkles size={22} />
        </div>
        <p className="mt-3 font-mono text-xs uppercase font-bold tracking-wider">Synchronizing live campus standings…</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="brutal-card p-8 text-center bg-paper border-2 border-black dark:border-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-black dark:border-white bg-saffron shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] text-black">
          <Trophy size={32} />
        </div>
        <h3 className="serif-heading mt-4 text-2xl font-bold">
          Campus <span className="inline-block px-2.5 py-0.5 -rotate-1 bg-saffron text-black rounded border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">Leaderboard</span>
        </h3>
        <p className="mt-2 text-sm text-ink-muted max-w-md mx-auto">
          No rankings recorded yet! Attend festival events, get your passes verified by organisers, collect badges, and earn Rangora points to climb the campus standings.
        </p>
        <Link to="/" hash="featured-events-today" className="btn btn-primary mt-5 inline-flex items-center gap-2">
          <Sparkles size={16} /> Browse Events to Earn Points
        </Link>
      </div>
    );
  }

  const sorted = [...rows].sort((a, b) => b.points - a.points);
  const rank = new Map(sorted.map((r, i) => [r.user_id, i]));
  const stable = [...rows].sort((a, b) => a.user_id.localeCompare(b.user_id));
  const top = sorted.slice(0, 3);

  const podiumOrder = [1, 0, 2]; // 2nd, 1st, 3rd podium arrangement
  const podiumStyles = [
    {
      title: "Champion",
      rankLabel: "1st",
      bgClass: "bg-saffron text-black border-2 border-black dark:border-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#fff]",
      badgeClass: "-rotate-2 bg-black text-saffron border border-saffron shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
      icon: Crown,
      heightClass: "min-h-[220px]",
    },
    {
      title: "Silver",
      rankLabel: "2nd",
      bgClass: "bg-card text-foreground border-2 border-black dark:border-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_#fff]",
      badgeClass: "rotate-1 bg-slate-200 dark:bg-slate-700 text-black dark:text-white border border-black shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]",
      icon: Medal,
      heightClass: "min-h-[190px]",
    },
    {
      title: "Bronze",
      rankLabel: "3rd",
      bgClass: "bg-card text-foreground border-2 border-black dark:border-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_#fff]",
      badgeClass: "-rotate-1 bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 border border-black shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]",
      icon: Award,
      heightClass: "min-h-[170px]",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Top 3 Podium */}
      <div className="grid grid-cols-3 items-end gap-3 sm:gap-5 pt-4">
        {podiumOrder.map((topIndex) => {
          const r = top[topIndex];
          if (!r) return <div key={topIndex} />;
          const style = podiumStyles[topIndex]!;
          const IconComponent = style.icon;
          const isMe = r.user_id === me;

          return (
            <div
              key={r.user_id}
              className={`rounded-2xl p-4 text-center flex flex-col justify-between transition-all relative ${style.bgClass} ${style.heightClass} ${
                isMe ? "ring-4 ring-terracotta" : ""
              }`}
            >
              <div>
                <div className="flex justify-center -mt-8">
                  <div className={`w-12 h-12 rounded-full border-2 border-black dark:border-white flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                    topIndex === 0 ? "bg-black text-saffron" : topIndex === 1 ? "bg-slate-200 text-slate-800" : "bg-amber-200 text-amber-900"
                  }`}>
                    <IconComponent size={24} />
                  </div>
                </div>

                <div className="mt-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[10px] font-black uppercase ${style.badgeClass}`}>
                    <IconComponent size={11} /> {style.rankLabel} · {style.title}
                  </span>
                </div>

                <p className="mt-2 truncate font-bold text-sm sm:text-base">{r.display_name}</p>
                <p className="truncate font-mono text-[11px] text-ink-muted">{r.department ?? "Campus Attendee"}</p>
              </div>

              <div className="mt-3 pt-2 border-t border-black/10 dark:border-white/10">
                <span className="inline-flex items-center gap-1 font-mono text-sm sm:text-base font-black text-terracotta bg-card/90 px-2.5 py-1 rounded-md border border-black/20 dark:border-white/20 shadow-sm">
                  <Flame size={14} className="text-terracotta fill-terracotta/30 animate-pulse" />
                  <CountUp value={r.points} /> pts
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Rankings List */}
      <div className="rounded-2xl border-2 border-black dark:border-white bg-card p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#fff]">
        <div className="flex items-center justify-between px-3 py-2 border-b border-line mb-2">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-terracotta" />
            <span className="font-mono text-xs uppercase font-black tracking-wider text-ink-muted">All Participants</span>
          </div>
          <span className="font-mono text-xs font-bold text-ink-muted">Total: {rows.length} Active Racers</span>
        </div>

        <div className="relative" style={{ height: rows.length * ROW }}>
          {stable.map((r) => {
            const i = rank.get(r.user_id) ?? 0;
            const mine = r.user_id === me;
            const isTopThree = i < 3;

            return (
              <div
                key={r.user_id}
                className={`absolute inset-x-0 flex items-center gap-3 sm:gap-4 rounded-xl px-3 sm:px-4 border transition-all duration-700 ease-out ${
                  mine
                    ? "bg-terracotta/10 border-terracotta ring-2 ring-terracotta shadow-sm"
                    : "bg-surface/60 border-line hover:border-black dark:hover:border-white"
                } ${flash === r.user_id ? "animate-pulse ring-2 ring-saffron" : ""}`}
                style={{ top: i * ROW, height: ROW - 8 }}
              >
                {/* Tilted Rank Badge */}
                <div
                  className={`w-9 h-9 shrink-0 flex items-center justify-center font-mono font-black text-sm rounded border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                    i === 0
                      ? "-rotate-2 bg-saffron text-black"
                      : i === 1
                        ? "rotate-1 bg-slate-200 dark:bg-slate-700 text-black dark:text-white"
                        : i === 2
                          ? "-rotate-1 bg-amber-200 dark:bg-amber-800 text-black dark:text-white"
                          : "bg-elevated text-foreground"
                  }`}
                >
                  #{i + 1}
                </div>

                {/* Avatar Initials */}
                <span className="hidden xs:flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-black dark:border-white bg-parchment text-xs font-black shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] text-black">
                  {r.display_name
                    .split(" ")
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join("")}
                </span>

                {/* Participant Details */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-bold text-ink dark:text-white">
                      {r.display_name}
                    </p>
                    {mine && (
                      <span className="inline-flex items-center gap-0.5 rounded px-2 py-0.5 -rotate-1 font-mono text-[10px] font-black uppercase bg-terracotta text-white border border-black shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)]">
                        <Sparkles size={9} /> You
                      </span>
                    )}
                    {isTopThree && (
                      <span className="hidden sm:inline-flex items-center gap-1 font-mono text-[10px] font-bold text-terracotta">
                        {i === 0 ? (
                          <>
                            <Crown size={11} className="text-amber-500 fill-amber-500" />
                            <span>Leader</span>
                          </>
                        ) : i === 1 ? (
                          <>
                            <Medal size={11} className="text-slate-400" />
                            <span>Runner-up</span>
                          </>
                        ) : (
                          <>
                            <Award size={11} className="text-amber-700" />
                            <span>Podium</span>
                          </>
                        )}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-ink-muted">{r.department ?? "Collegiate Attendee"}</p>
                </div>

                {/* Progress Bar */}
                <div className="hidden md:block w-36 lg:w-48">
                  <div className="h-2.5 rounded-full bg-line overflow-hidden border border-black/20 dark:border-white/20">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-saffron to-terracotta transition-all duration-700"
                      style={{
                        width: `${Math.max(6, (r.points / Math.max(1, sorted[0]?.points ?? 1)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Points Tag */}
                <div className="flex items-center gap-1 shrink-0 font-mono text-sm font-bold text-terracotta bg-card px-2.5 py-1 rounded-md border border-line shadow-sm">
                  <Zap size={14} className="text-terracotta fill-terracotta" />
                  <CountUp value={r.points} /> pts
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="flex items-center justify-center gap-1.5 font-mono text-xs text-ink-muted">
        <Zap size={13} className="text-saffron" />
        <span>Live campus rankings update in real time as pass check-ins are verified and badges are unlocked.</span>
      </p>
    </div>
  );
}
