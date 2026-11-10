import React from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Ticket, CheckCircle2 } from "lucide-react";

export interface VoucherTicketProps {
  voucher: {
    id: string;
    code: string;
    campaign_id?: number | null;
    redeemed?: boolean;
    created_at?: string;
  };
  campaign?: {
    id: number;
    title: string;
    description: string;
    type?: string;
    pct?: number;
    code?: string;
  } | null | undefined;
  onRedeem?: (() => void) | undefined;
  redeemPending?: boolean | undefined;
  className?: string | undefined;
}

export function VoucherSvgTicket({
  voucher,
  campaign,
  onRedeem,
  redeemPending = false,
  className = "",
}: VoucherTicketProps) {
  const isRedeemed = Boolean(voucher.redeemed);
  const discountLabel = campaign?.pct ? `${campaign.pct}% OFF` : campaign?.type === "pass" ? "100% FREE" : "CAMPUS PERK";

  return (
    <div
      className={`relative rounded-2xl border-2 border-black dark:border-white bg-[#FFFDF8] dark:bg-[#1E293B] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#fff] overflow-hidden transition-all duration-200 hover:-translate-y-0.5 ${
        isRedeemed ? "opacity-60 grayscale-[30%]" : ""
      } ${className}`}
    >
      {/* Neo-brutalist ticket layout: Main body + Perforated Stub */}
      <div className="flex flex-col sm:flex-row min-h-[170px]">
        {/* Main Ticket Area */}
        <div className="relative flex-1 p-5 flex flex-col justify-between gap-3">
          {/* Top header row */}
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] font-extrabold uppercase tracking-widest text-terracotta flex items-center gap-1">
              <Ticket size={13} />
              {campaign?.type ?? "Festival Voucher"} · 2026
            </span>
            <span className="inline-block px-2.5 py-0.5 font-mono text-[10px] font-black uppercase bg-saffron text-black rounded border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] -rotate-1">
              {discountLabel}
            </span>
          </div>

          {/* Title and description */}
          <div>
            <h4 className="serif-heading text-lg sm:text-xl font-bold text-ink dark:text-white leading-tight">
              {campaign?.title ?? "Rangora Campus Reward"}
            </h4>
            <p className="mt-1 text-xs text-ink-muted dark:text-slate-300 line-clamp-2 leading-relaxed">
              {campaign?.description ?? "Valid across partner campus stalls and registered festival concessions."}
            </p>
          </div>

          {/* Validity stamp */}
          <div className="flex items-center justify-between pt-2 border-t border-black/10 dark:border-white/10 text-[10px] font-mono text-ink-muted dark:text-slate-400">
            <span className="flex items-center gap-1 font-bold text-terracotta">
              <Sparkles size={11} /> VALID UNTIL 31 DEC 2026
            </span>
            {isRedeemed && (
              <span className="flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={12} /> REDEEMED
              </span>
            )}
          </div>
        </div>

        {/* Perforated Separator with Cutout Notches */}
        <div className="relative hidden sm:flex flex-col items-center justify-between w-6 shrink-0 bg-transparent">
          {/* Top circular notch */}
          <div className="w-5 h-5 -mt-3 rounded-full bg-background border-2 border-black dark:border-white z-10" />
          
          {/* Vertical dashed tear line */}
          <div className="h-full w-0 border-r-2 border-dashed border-black/40 dark:border-white/40 my-1" />
          
          {/* Bottom circular notch */}
          <div className="w-5 h-5 -mb-3 rounded-full bg-background border-2 border-black dark:border-white z-10" />
        </div>

        {/* Horizontal separator for mobile screens */}
        <div className="relative sm:hidden flex items-center justify-between h-6 bg-transparent">
          <div className="w-5 h-5 -ml-3 rounded-full bg-background border-2 border-black dark:border-white z-10" />
          <div className="w-full h-0 border-b-2 border-dashed border-black/40 dark:border-white/40 mx-1" />
          <div className="w-5 h-5 -mr-3 rounded-full bg-background border-2 border-black dark:border-white z-10" />
        </div>

        {/* Ticket Stub Area */}
        <div className="sm:w-44 p-4 bg-parchment/60 dark:bg-slate-800/80 flex flex-col items-center justify-between text-center gap-3 shrink-0">
          {/* Authentic Barcode SVG */}
          <div className="w-full flex flex-col items-center">
            <svg
              className="w-full h-9 stroke-black dark:stroke-white max-w-[130px]"
              viewBox="0 0 100 28"
              preserveAspectRatio="none"
              aria-label="Ticket barcode"
            >
              <line x1="2" y1="0" x2="2" y2="28" strokeWidth="2.5" />
              <line x1="7" y1="0" x2="7" y2="28" strokeWidth="1.2" />
              <line x1="11" y1="0" x2="11" y2="28" strokeWidth="3" />
              <line x1="16" y1="0" x2="16" y2="28" strokeWidth="1" />
              <line x1="20" y1="0" x2="20" y2="28" strokeWidth="2" />
              <line x1="24" y1="0" x2="24" y2="28" strokeWidth="3.5" />
              <line x1="30" y1="0" x2="30" y2="28" strokeWidth="1" />
              <line x1="33" y1="0" x2="33" y2="28" strokeWidth="2" />
              <line x1="38" y1="0" x2="38" y2="28" strokeWidth="4" />
              <line x1="45" y1="0" x2="45" y2="28" strokeWidth="1" />
              <line x1="48" y1="0" x2="48" y2="28" strokeWidth="2.5" />
              <line x1="53" y1="0" x2="53" y2="28" strokeWidth="1" />
              <line x1="56" y1="0" x2="56" y2="28" strokeWidth="3" />
              <line x1="62" y1="0" x2="62" y2="28" strokeWidth="1.5" />
              <line x1="66" y1="0" x2="66" y2="28" strokeWidth="3" />
              <line x1="72" y1="0" x2="72" y2="28" strokeWidth="1" />
              <line x1="75" y1="0" x2="75" y2="28" strokeWidth="2" />
              <line x1="80" y1="0" x2="80" y2="28" strokeWidth="4" />
              <line x1="87" y1="0" x2="87" y2="28" strokeWidth="1.5" />
              <line x1="91" y1="0" x2="91" y2="28" strokeWidth="2.5" />
              <line x1="97" y1="0" x2="97" y2="28" strokeWidth="2" />
            </svg>
            <span className="font-mono text-[10px] tracking-wider text-ink dark:text-slate-200 font-extrabold mt-1 select-all bg-card px-1.5 py-0.5 rounded border border-black/20 dark:border-white/20">
              {voucher.code}
            </span>
          </div>

          {/* Action / Redeem button */}
          {onRedeem && !isRedeemed ? (
            <Button
              size="sm"
              disabled={redeemPending}
              onClick={onRedeem}
              className="w-full text-xs font-bold bg-terracotta text-white hover:bg-terracotta/90 border-2 border-black dark:border-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_#fff]"
            >
              {redeemPending ? "Redeeming…" : "Redeem Stub"}
            </Button>
          ) : (
            <span className="text-[10px] font-mono font-bold text-ink-muted dark:text-slate-400">
              {isRedeemed ? "CLAIMED" : "SHOW AT STALL"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
