import { Link } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";

const resources = ["Organizer Host Handbook", "Seat Pulse & Capacity Guide", "Festival Passport Guide", "Campus Venue Accessibility"];
const legal = [
  "Terms & Conditions",
  "Privacy Policy",
  "Refund & Cancellation Policy",
  "Cookie & Session Policy",
  "Participant Code of Conduct",
  "Security & Data Governance",
];

function openChat() {
  window.dispatchEvent(new CustomEvent("rangora:open-chat"));
}

export function SiteFooter() {
  const item = "transition-colors hover:text-white text-slate-300";
  return (
    <footer className="mt-12 border-t-2 border-black dark:border-white bg-[#0F172A] pb-10 pt-14 text-white relative z-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 border-b border-slate-700/60 pb-10 md:grid-cols-2 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-4">
            <Link to="/" className="inline-flex items-start font-display text-2xl font-extrabold tracking-tight text-white hover:opacity-90">
              <span>RANGORA</span>
              <span className="-mt-1 ml-0.5 text-base text-terracotta">R</span>
            </Link>
            <p className="max-w-sm text-xs leading-relaxed text-slate-300">
              Find your kind of celebration. Rangora is the campus festival discovery, ACID-protected pass registration, and live occupancy platform built for cultural fests, hackathons, workshops, and student communities.
            </p>
            <div className="flex flex-wrap gap-2 pt-2 font-mono text-[11px] text-[#D6FD52]">
              <span>● Seat Pulse Live</span><span>·</span><span>● Campus Festivals</span>
            </div>
          </div>

          <div className="space-y-2.5 text-xs lg:col-span-2">
            <h3 className="font-sans text-xs font-extrabold uppercase tracking-wider text-white">Explore</h3>
            <ul className="space-y-2">
              <li><Link to="/" hash="featured-events-today" className={item}>Featured Events</Link></li>
              <li><Link to="/" hash="categories" className={item}>Experience Categories</Link></li>
              <li><Link to="/" hash="beyond-the-hype" className={item}>Beyond the Hype</Link></li>
              <li><Link to="/" hash="festival-highlights" className={item}>Festival Lineups</Link></li>
              <li><Link to="/pulse" className={item}>Event Pulse Gallery</Link></li>
            </ul>
          </div>

          <div className="space-y-2.5 text-xs lg:col-span-2">
            <h3 className="font-sans text-xs font-extrabold uppercase tracking-wider text-white">Resources</h3>
            <ul className="space-y-2">
              {resources.map((r) => (
                <li key={r}><Link to="/" hash="faqs" className={item}>{r}</Link></li>
              ))}
            </ul>
          </div>

          <div className="space-y-2.5 text-xs lg:col-span-2">
            <h3 className="font-sans text-xs font-extrabold uppercase tracking-wider text-white">Legal &amp; Terms</h3>
            <ul className="space-y-2">
              {legal.map((r) => (
                <li key={r}><Link to="/" hash="faqs" className={item}>{r}</Link></li>
              ))}
            </ul>
          </div>

          <div className="space-y-2.5 text-xs lg:col-span-2">
            <h3 className="font-sans text-xs font-extrabold uppercase tracking-wider text-white">Help &amp; Contact</h3>
            <ul className="space-y-2">
              <li>
                <button
                  type="button"
                  onClick={openChat}
                  className={`${item} text-left flex items-center gap-1.5 font-bold text-saffron hover:underline`}
                >
                  <MessageSquare size={13} className="text-saffron shrink-0" />
                  <span>Live Concierge Chatbot</span>
                </button>
              </li>
              <li><Link to="/" hash="faqs" className={item}>Help Center &amp; FAQs</Link></li>
              <li><a href="mailto:support@rangora.in" className={item}>support@rangora.in</a></li>
              <li><span className="text-slate-300 font-mono">+91 33 4020 8890</span></li>
              <li className="text-[11px] text-slate-400">Salt Lake Campus, Kolkata</li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 pt-6 text-xs text-slate-400 sm:flex-row">
          <p>© 2026 Rangora Campus Event Discovery Platform. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/" hash="faqs" className="hover:text-white transition-colors">Terms &amp; Conditions</Link><span>·</span>
            <Link to="/" hash="faqs" className="hover:text-white transition-colors">Privacy Policy</Link><span>·</span>
            <Link to="/" hash="faqs" className="hover:text-white transition-colors">Cookies</Link><span>·</span>
            <Link to="/" hash="faqs" className="hover:text-white transition-colors">Refunds</Link><span>·</span>
            <button type="button" onClick={openChat} className="hover:text-white transition-colors">Contact Us</button>
          </div>
        </div>
      </div>
    </footer>
  );
}
