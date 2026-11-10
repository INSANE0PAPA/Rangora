import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const faqs = [
  { q: "How do I book a festival pass?", a: "Create a free participant account, open any event and press Book Pass. Your pass code appears instantly under My Registrations & Passes in your dashboard." },
  { q: "Are passes free?", a: "Many workshops, labs and community gatherings are free. Paid passes show their price on the event card. Vouchers you earn can bring the price down or make entry free." },
  { q: "What is the Signature Engine?", a: "It reads the experience preferences you pick when you sign up (Music, Workshops, Tech and so on) and builds a personal 'Matched to You' shelf on the home page and in your dashboard." },
  { q: "What does Seat Pulse show?", a: "Seat Pulse is the live bar on every event card. Green means plenty of places, amber means filling fast, red means almost full and grey means sold out." },
  { q: "How do I earn badges and stamps?", a: "Badges and stamps unlock automatically as you book: your first pass, three passes, three different categories, and one badge for each experience category you explore." },
  { q: "How do vouchers work?", a: "Vouchers are issued automatically when you reach milestones (for example your first booking or three bookings). You can see each voucher's code and expiry in the Vouchers section of your dashboard." },
  { q: "Who can see the leaderboard?", a: "The leaderboard is only visible to signed-in participants. Points update live as people book events and unlock badges." },
  { q: "Can I change my preferences later?", a: "Yes. Open My Profile & Settings in your dashboard and update your preferences, department, course or contact details at any time." },
  { q: "What is the refund and cancellation policy?", a: "Free passes can be cancelled any time. Paid passes are refundable up to 24 hours before the event starts. Contact support@rangora.in for help." },
  { q: "I want to host an event. What do I do?", a: "Create an organiser account with your institutional details. An administrator reviews the application before event-management access is enabled." },
];

export function Faqs() {
  return (
    <section id="faqs" className="mx-auto max-w-7xl scroll-mt-24 border-t border-line px-4 py-14 sm:px-6 lg:px-8 relative z-10">
      <div className="rounded-2xl border-2 border-black dark:border-white bg-card p-6 sm:p-10 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_#fff]">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <span className="inline-block rounded-full border border-ink bg-saffron-soft px-3 py-1 text-xs font-bold uppercase tracking-wider text-saffron">Help Center</span>
            <h2 className="serif-heading mt-3 text-3xl sm:text-4xl">
              Frequently asked <span className="inline-block px-2.5 py-0.5 -rotate-1 bg-saffron text-black rounded border-2 border-black dark:border-white shadow-[2.5px_2.5px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2.5px_2.5px_0px_0px_#fff]">questions</span>
            </h2>
            <p className="mt-2 text-sm text-ink-body leading-relaxed">Everything about passes, badges, vouchers and your account. Still stuck? Ask the Concierge in the corner.</p>
          </div>
          <div className="rounded-xl border border-line bg-parchment p-3 sm:p-5 lg:col-span-8 shadow-xs">
            <Accordion type="single" collapsible defaultValue="faq-0">
              {faqs.map((f, i) => (
                <AccordionItem key={f.q} value={`faq-${i}`} className="border-line px-3">
                  <AccordionTrigger className="text-left text-sm font-bold text-ink hover:no-underline">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-sm leading-relaxed text-ink-body">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </div>
    </section>
  );
}
