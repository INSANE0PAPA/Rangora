import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { askRangora } from "@/lib/chat.functions";
import { supabase } from "@/integrations/supabase/client";

type ChatMessage = { role: "user" | "assistant"; content: string };

const suggestions = ["What events are coming up?", "How do Event Echoes work?", "How can I organise an event?"];

export function Chatbot() {
  const ask = useServerFn(askRangora);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Hi! I'm your Rangora guide. Ask me about campus festivals, passes, or creating an event." },
  ]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const openChat = () => setOpen(true);
    window.addEventListener("rangora:open-chat", openChat);
    return () => window.removeEventListener("rangora:open-chat", openChat);
  }, []);

  async function sendMessage(content: string) {
    const clean = content.trim();
    if (!clean || busy) return;
    const next = [...messages, { role: "user" as const, content: clean }].slice(-10);
    setMessages(next);
    setDraft("");
    setBusy(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const payload: {
        data: {
          messages: typeof next;
          authToken?: string;
        };
        headers?: Record<string, string>;
      } = {
        data: {
          messages: next,
          ...(token ? { authToken: token } : {}),
        },
      };
      if (token) {
        payload.headers = { Authorization: `Bearer ${token}` };
      }
      const reply = await ask(payload);
      setMessages((current) => [...current, { role: "assistant" as const, content: reply.text }].slice(-12));
    } catch {
      setMessages((current) => [...current, { role: "assistant" as const, content: "I couldn't reach the festival guide. Please try again." }].slice(-12));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rangora-chat-widget">
      {open && (
        <section className="chatbot-shell" aria-label="Rangora festival concierge">
          <header className="flex items-center justify-between border-b border-line px-4 py-3">
            <div><p className="font-mono text-[10px] uppercase tracking-widest text-terracotta">Rangora guide</p><h2 className="serif-heading text-lg">Ask the festival desk</h2></div>
            <Button variant="ghost" size="icon" aria-label="Close chat" onClick={() => setOpen(false)}><X size={18} /></Button>
          </header>
          <div className="chatbot-messages-area" aria-live="polite">
            {messages.map((message, index) => <p key={`${index}-${message.role}`} className={message.role === "user" ? "chat-bubble-user" : "chat-bubble-bot"}>{message.content}</p>)}
            {busy && <p className="chat-bubble-bot" role="status">Finding the right details…</p>}
          </div>
          <div className="flex flex-wrap gap-2 px-3 pt-3">{suggestions.map((suggestion) => <Button key={suggestion} variant="outline" size="sm" className="h-auto whitespace-normal px-2 py-1 text-xs" onClick={() => void sendMessage(suggestion)} disabled={busy}>{suggestion}</Button>)}</div>
          <form onSubmit={(event) => { event.preventDefault(); void sendMessage(draft); }} className="flex items-center gap-2 p-3">
            <label className="sr-only" htmlFor="rangora-chat-input">Ask Rangora</label>
            <input id="rangora-chat-input" value={draft} maxLength={1200} onChange={(event) => setDraft(event.target.value)} placeholder="Ask about an event…" className="h-10 min-w-0 flex-1 rounded-md border border-input bg-elevated px-3 text-sm" />
            <Button type="submit" size="icon" aria-label="Send message" disabled={busy || !draft.trim()}><Send size={16} /></Button>
          </form>
        </section>
      )}
      <Button className="floating-chat-launcher" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={open ? "Close Rangora chat" : "Open Rangora chat"}>
        {open ? <X size={16} /> : <MessageCircle size={16} />}<span>{open ? "Close" : "Ask Rangora"}</span>
      </Button>
    </div>
  );
}