import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import {
  executeGeminiTool,
  geminiToolDeclarations,
  searchEvents,
  getEventDetails,
  getLiveSeatAvailability,
  searchRangoraFaq,
  type ProposedAction,
  type ToolContext,
} from "@/lib/gemini-tools";

// =========================================================================
// 1. Request Input Validation & Rate Limiter
// =========================================================================

export const chatInput = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(1200),
      })
    )
    .min(1)
    .max(10),
  authToken: z.string().optional(),
});

// Simple in-memory sliding window rate limiter (20 requests/minute per client)
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 20;

function isRateLimited(clientId: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(clientId) || [];
  const validTimestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (validTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }

  validTimestamps.push(now);
  rateLimitMap.set(clientId, validTimestamps);
  return false;
}

if (typeof setInterval !== "undefined") {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of rateLimitMap.entries()) {
      const valid = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
      if (valid.length === 0) {
        rateLimitMap.delete(key);
      } else {
        rateLimitMap.set(key, valid);
      }
    }
  }, 5 * 60 * 1000);
  timer.unref?.();
}

// =========================================================================
// 2. Authentication Context Extraction
// =========================================================================

async function resolveAuthContext(providedToken?: string): Promise<ToolContext> {
  const isDemo =
    process.env["RANGORA_DEMO_MODE"] === "true" || !process.env["DATABASE_URL"];

  try {
    const token = providedToken?.trim();

    if (!token || token.split(".").length !== 3) {
      return { userId: null, isDemo };
    }

    const supabaseUrl =
      process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
    const supabaseAnonKey =
      process.env["SUPABASE_PUBLISHABLE_KEY"] ||
      process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];

    if (!supabaseUrl || !supabaseAnonKey) {
      return { userId: null, isDemo };
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims?.sub) {
      return { userId: null, isDemo };
    }

    return {
      userId: String(data.claims.sub),
      isDemo,
    };
  } catch {
    return { userId: null, isDemo };
  }
}

// =========================================================================
// 3. System Instructions
// =========================================================================

const SYSTEM_INSTRUCTIONS = `You are Rangora AI, the friendly and knowledgeable campus festival concierge for Rangora 2.0 ("Find your kind of celebration").
Your role is to assist students, participants, and visitors with:
1. Exploring published festivals and events across music, dance, theatre, tech, workshops, and gaming.
2. Checking real-time seat availability and capacity status.
3. Reviewing personalized itineraries and pass codes for authenticated participants.
4. Detecting and resolving schedule overlaps (Plan Rescue).
5. Explaining Event Echoes (student memory capsules), achievement badges, and partner discount vouchers.
6. Answering campus festival policies and venue directories.

Operational Rules:
- Answer accurately with factual information. Use Indian Rupee (₹) for pricing.
- For public inquiries, explain schedules, venues, and seat capacity.
- Keep your tone warm, concise, and helpful. Format responses in clean Markdown.`;

export interface ChatResponseResult {
  text: string;
  proposal?: ProposedAction | undefined;
  modelUsed?: string;
}

// =========================================================================
// 4. OpenAI-Compatible API Client (Supports Ollama, NVIDIA NIM, Groq, OpenRouter)
// =========================================================================

async function callOpenAICompatible(
  url: string,
  apiKey: string | undefined,
  model: string,
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string,
  timeoutMs = 6000
): Promise<string | null> {
  try {
    const formattedMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
    ];

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: formattedMessages,
        temperature: 0.7,
        max_tokens: 600,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) return null;
    const json = (await res.json()) as any;
    return json.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

// =========================================================================
// 5. Built-in Campus Concierge Fallback Engine (Zero-Token / Free Offline Heuristic)
// =========================================================================

async function generateLocalConciergeResponse(
  userQuery: string,
  toolContext: ToolContext
): Promise<ChatResponseResult> {
  const q = userQuery.toLowerCase().trim();

  // 1. Upcoming / Flagship events
  if (
    q.includes("coming up") ||
    q.includes("upcoming") ||
    q.includes("events") ||
    q.includes("celebrations") ||
    q.includes("shows") ||
    q.includes("lineup")
  ) {
    const events = await searchEvents({}, toolContext);
    const top = events.slice(0, 4);
    let text = "Here are some of the premier flagship events lined up across our campus festivals:\n\n";
    top.forEach((e) => {
      text += `• **${e.name}** (${e.category})\n  📍 *${e.venue}* · ${e.price === 0 ? "FREE" : `₹${e.price}`} · **${e.availableSeats} of ${e.maxSeats}** seats remaining.\n\n`;
    });
    text += "You can inspect artist lineups, check schedules, and reserve passes directly on the landing page!";
    return { text, modelUsed: "local-concierge" };
  }

  // 2. Event Echoes
  if (
    q.includes("echo") ||
    q.includes("review") ||
    q.includes("photo") ||
    q.includes("reflection")
  ) {
    const faq = await searchRangoraFaq({ query: "echo" });
    const ans =
      faq[0]?.answer ||
      "Event Echoes are student memory capsules! Once you attend a celebration and your pass is verified at the door, you can share acoustics, candid stage photographs, and rate the experience.";
    return {
      text: `**About Rangora Event Echoes:**\n\n${ans}\n\nYou can explore live attendee reflections anytime on the **Event Pulse** page!`,
      modelUsed: "local-concierge",
    };
  }

  // 3. Organising an event
  if (
    q.includes("organise") ||
    q.includes("organize") ||
    q.includes("host") ||
    q.includes("create event")
  ) {
    return {
      text: "To organise a celebration on Rangora:\n\n1. Apply for a **Campus Organiser** account at `/auth?mode=signup` using your institutional email (`.edu` or `.ac`).\n2. Once approved by campus administration, log into your **Organiser Console** at `/dashboard`.\n3. Create your festival lineup, select stage venues, configure seat capacity, design custom SVG collectible badges, and scan pass QR codes at the door!",
      modelUsed: "local-concierge",
    };
  }

  // 4. Clash guardian
  if (q.includes("clash") || q.includes("overlap") || q.includes("conflict")) {
    return {
      text: "Rangora features an **Automated Event Clash Guardian**!\n\n• **For attendees:** If you book passes for celebrations taking place concurrently, you'll be alerted in your Dashboard so you can decide which session to attend in person.\n• **For organisers:** Campus venues and stage schedules are evaluated in real time during event creation to prevent double-booking stages.",
      modelUsed: "local-concierge",
    };
  }

  // 5. Passes / Bookings
  if (
    q.includes("pass") ||
    q.includes("ticket") ||
    q.includes("book") ||
    q.includes("price") ||
    q.includes("cost")
  ) {
    return {
      text: "Passes for all campus festivals can be reserved directly on each event's description page. Every pass features real-time **Seat Pulse** counters so you always know live availability. Free events can be reserved with a single click!",
      modelUsed: "local-concierge",
    };
  }

  // 6. Concession Vouchers & Badges
  if (
    q.includes("voucher") ||
    q.includes("discount") ||
    q.includes("perk") ||
    q.includes("badge")
  ) {
    return {
      text: "Campus concession vouchers provide 15% to 25% savings at festival food courts, campus merchandise kiosks, and cafeteria partners! You can inspect and claim available perks in your **Digital Passport** on `/dashboard`.",
      modelUsed: "local-concierge",
    };
  }

  // 7. Policy FAQ match
  const faqs = await searchRangoraFaq({ query: userQuery });
  if (faqs.length > 0 && faqs[0]) {
    return {
      text: `**${faqs[0].question}**\n\n${faqs[0].answer}`,
      modelUsed: "local-concierge",
    };
  }

  // 8. Event keyword search
  const searchResults = await searchEvents({ query: userQuery }, toolContext);
  if (searchResults.length > 0) {
    let text = `Here are the celebrations matching "**${userQuery}**":\n\n`;
    searchResults.slice(0, 3).forEach((e) => {
      text += `• **${e.name}** (${e.category})\n  📍 ${e.venue} · ${e.price === 0 ? "FREE" : `₹${e.price}`} · ${e.availableSeats} places open\n\n`;
    });
    return { text, modelUsed: "local-concierge" };
  }

  return {
    text: "I'm your Rangora campus festival guide! You can ask me about upcoming flagship events, live seat availability, digital pass check-ins, Event Echoes, or applying to organise a campus fest.",
    modelUsed: "local-concierge",
  };
}

// =========================================================================
// 6. Master Chat Handler (Gemini -> Groq -> NVIDIA NIM -> Ollama -> Local Concierge)
// =========================================================================

export async function handleChatTurn(
  data: z.infer<typeof chatInput>,
  injectedContext?: ToolContext
): Promise<ChatResponseResult> {
  // 1. Rate Limiting Check
  const clientIdentifier = data.authToken
    ? `user-${data.authToken.slice(-16)}`
    : "anonymous-client";

  if (isRateLimited(clientIdentifier)) {
    return {
      text: "You are asking questions a bit quickly. Please wait a moment before sending another message.",
    };
  }

  // 2. Resolve Verified User Context
  const toolContext = injectedContext || (await resolveAuthContext(data.authToken));
  const lastUserMessage = [...data.messages].reverse().find((m) => m.role === "user")?.content || "";

  // 3. Provider A: Groq (Ultra-fast cloud free tier)
  const groqKey = process.env["GROQ_API_KEY"];
  if (groqKey && !groqKey.includes("REPLACE")) {
    const groqModel = process.env["GROQ_MODEL"] || "llama-3.3-70b-versatile";
    const groqReply = await callOpenAICompatible(
      "https://api.groq.com/openai/v1/chat/completions",
      groqKey,
      groqModel,
      data.messages,
      SYSTEM_INSTRUCTIONS
    );
    if (groqReply) {
      return { text: groqReply, modelUsed: `groq/${groqModel}` };
    }
  }

  // 4. Provider B: NVIDIA NIM (Free developer endpoint)
  const nvidiaKey = process.env["NVIDIA_API_KEY"];
  if (nvidiaKey && !nvidiaKey.includes("REPLACE")) {
    const nvidiaModel = process.env["NVIDIA_MODEL"] || "meta/llama-3.1-8b-instruct";
    const nvidiaReply = await callOpenAICompatible(
      "https://integrate.api.nvidia.com/v1/chat/completions",
      nvidiaKey,
      nvidiaModel,
      data.messages,
      SYSTEM_INSTRUCTIONS
    );
    if (nvidiaReply) {
      return { text: nvidiaReply, modelUsed: `nvidia/${nvidiaModel}` };
    }
  }

  // 5. Provider C: Ollama (Free local execution, e.g. llama3.2, mistral)
  if (process.env["OLLAMA_ENABLED"] === "true") {
    const ollamaBase = process.env["OLLAMA_BASE_URL"] || "http://127.0.0.1:11434";
    const ollamaModel = process.env["OLLAMA_MODEL"] || "llama3.2";
    const ollamaReply = await callOpenAICompatible(
      `${ollamaBase}/v1/chat/completions`,
      undefined,
      ollamaModel,
      data.messages,
      SYSTEM_INSTRUCTIONS,
      1500
    );
    if (ollamaReply) {
      return { text: ollamaReply, modelUsed: `ollama/${ollamaModel}` };
    }
  }

  // 6. Provider D: Google Gemini with Function Calling
  const geminiKey = process.env["GEMINI_API_KEY"];
  if (geminiKey && !geminiKey.includes("REPLACE") && geminiKey.startsWith("AIzaSy")) {
    const primaryModel = process.env["GEMINI_MODEL"] || "gemini-2.0-flash";
    const fallbackModel = process.env["GEMINI_FALLBACK_MODEL"] || "gemini-1.5-flash";
    const modelChain = [primaryModel];
    if (fallbackModel && fallbackModel !== primaryModel) {
      modelChain.push(fallbackModel);
    }

    const ai = new GoogleGenAI({
      apiKey: geminiKey,
      httpOptions: { apiVersion: "v1beta", timeout: 12000 },
    });

    const tools = [{ functionDeclarations: geminiToolDeclarations }];
    const contents: any[] = data.messages.map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    }));

    let selectedModel = primaryModel;
    let initialResponse: any = null;

    for (const modelToTry of modelChain) {
      try {
        selectedModel = modelToTry;
        initialResponse = await ai.models.generateContent({
          model: modelToTry,
          contents,
          config: {
            systemInstruction: SYSTEM_INSTRUCTIONS,
            tools,
            temperature: 0.7,
          },
        });
        if (initialResponse) break;
      } catch (err: any) {
        console.warn(`[Rangora Chatbot] Model ${modelToTry} attempt failed: ${err.message?.slice(0, 80)}`);
      }
    }

    if (initialResponse) {
      let currentResponse = initialResponse;
      let iterations = 0;
      let capturedProposal: ProposedAction | undefined = undefined;

      while (
        currentResponse?.functionCalls &&
        currentResponse.functionCalls.length > 0 &&
        iterations < 3
      ) {
        iterations++;
        const candidateContent = currentResponse.candidates?.[0]?.content;
        if (candidateContent) contents.push(candidateContent);

        const toolResponseParts: any[] = [];
        for (const call of currentResponse.functionCalls) {
          try {
            const { result, proposal } = await executeGeminiTool(
              call.name,
              (call.args as Record<string, any>) || {},
              toolContext
            );
            if (proposal) capturedProposal = proposal;
            toolResponseParts.push({
              functionResponse: { name: call.name, response: result },
            });
          } catch (toolErr: any) {
            toolResponseParts.push({
              functionResponse: {
                name: call.name,
                response: { error: `Tool failed: ${toolErr.message}` },
              },
            });
          }
        }

        contents.push({ role: "user", parts: toolResponseParts });
        try {
          currentResponse = await ai.models.generateContent({
            model: selectedModel,
            contents,
            config: { systemInstruction: SYSTEM_INSTRUCTIONS, tools, temperature: 0.7 },
          });
        } catch {
          break;
        }
      }

      const responseText = currentResponse?.text?.trim();
      if (responseText) {
        return {
          text: responseText,
          proposal: capturedProposal,
          modelUsed: selectedModel,
        };
      }
    }
  }

  // 7. Ultimate Resilient Fallback: Built-in Local Campus Concierge Engine
  return generateLocalConciergeResponse(lastUserMessage, toolContext);
}
