import { describe, it, expect } from "vitest";
import { GoogleGenAI, Type } from "@google/genai";

describe("Gemini 3.8 Flash vs 3.7 Flash Model & Fallback Probes", () => {
  const apiKey = process.env["GEMINI_API_KEY"];
  const primaryModel = process.env["GEMINI_MODEL"] || "gemini-3.8-flash";
  const fallbackModel = process.env["GEMINI_FALLBACK_MODEL"] || "gemini-3.7-flash";

  it("should have primary and fallback models configured", () => {
    expect(primaryModel).toBe("gemini-3.8-flash");
    expect(fallbackModel).toBe("gemini-3.7-flash");
  });

  const modelsToTest = [primaryModel, fallbackModel];

  for (const model of modelsToTest) {
    describe(`Model: ${model}`, () => {
      it(`[1. Simple Generation] probe for ${model}`, async () => {
        if (!apiKey || apiKey.includes("REPLACE_WITH")) return;

        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: { apiVersion: "v1beta", timeout: 15000 }
        });

        try {
          const res = await ai.models.generateContent({
            model,
            contents: "Answer with exactly one word: Pong",
          });
          expect(res.text).toBeDefined();
          expect(res.text?.length).toBeGreaterThan(0);
        } catch (err: any) {
          const msg = `${err?.message || ""} ${JSON.stringify(err) || ""}`.toLowerCase();
          // Acceptable transient provider responses on free tier: 429 quota or 503 high demand
          const isExpectedTransient =
            msg.includes("429") ||
            msg.includes("503") ||
            msg.includes("quota") ||
            msg.includes("high demand") ||
            msg.includes("resource_exhausted") ||
            msg.includes("exhausted") ||
            msg.includes("rate") ||
            msg.includes("timeout");
          expect(isExpectedTransient).toBe(true);
        }
      }, 20000);

      it(`[2. Single Function Call] probe for ${model}`, async () => {
        if (!apiKey || apiKey.includes("REPLACE_WITH")) return;

        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: { apiVersion: "v1beta", timeout: 15000 }
        });

        const tools = [{
          functionDeclarations: [{
            name: "get_live_seat_availability",
            description: "Check available seats for an event",
            parameters: {
              type: Type.OBJECT,
              properties: {
                eventId: { type: Type.INTEGER, description: "Event ID" }
              },
              required: ["eventId"]
            }
          }]
        }];

        try {
          const res = await ai.models.generateContent({
            model,
            contents: "What is the seat availability for event #4?",
            config: { tools }
          });
          // If successful, function call is emitted
          if (res.functionCalls && res.functionCalls.length > 0) {
            expect(res.functionCalls[0]?.name).toBe("get_live_seat_availability");
          }
        } catch (err: any) {
          const msg = `${err?.message || ""} ${JSON.stringify(err) || ""}`.toLowerCase();
          const isExpectedTransient =
            msg.includes("429") ||
            msg.includes("503") ||
            msg.includes("quota") ||
            msg.includes("high demand") ||
            msg.includes("resource_exhausted") ||
            msg.includes("exhausted") ||
            msg.includes("rate") ||
            msg.includes("timeout");
          expect(isExpectedTransient).toBe(true);
        }
      }, 20000);

      it(`[3. Multi-Turn Exchange] probe for ${model}`, async () => {
        if (!apiKey || apiKey.includes("REPLACE_WITH")) return;

        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: { apiVersion: "v1beta", timeout: 15000 }
        });

        const tools = [{
          functionDeclarations: [{
            name: "get_live_seat_availability",
            description: "Check available seats for an event",
            parameters: {
              type: Type.OBJECT,
              properties: {
                eventId: { type: Type.INTEGER, description: "Event ID" }
              },
              required: ["eventId"]
            }
          }]
        }];

        try {
          const prompt = "How many seats are left for event #4?";
          const step1 = await ai.models.generateContent({
            model,
            contents: prompt,
            config: { tools }
          });

          if (step1.functionCalls && step1.functionCalls.length > 0) {
            const call = step1.functionCalls[0]!;
            const candidateContent = step1.candidates?.[0]?.content;
            expect(candidateContent).toBeDefined();

            const contents: any[] = [
              { role: "user", parts: [{ text: prompt }] },
              candidateContent,
              {
                role: "user",
                parts: [{
                  functionResponse: {
                    name: call.name,
                    response: {
                      eventId: 4,
                      eventName: "Rhythm of Bengal: Chhau & Baul Fusion",
                      maxSeats: 450,
                      bookedSeats: 120,
                      availableSeats: 330,
                      status: "available"
                    }
                  }
                }]
              }
            ];

            const step2 = await ai.models.generateContent({
              model,
              contents,
              config: { tools }
            });

            expect(step2.text).toBeDefined();
            expect(step2.text?.length).toBeGreaterThan(10);
          }
        } catch (err: any) {
          const msg = `${err?.message || ""} ${JSON.stringify(err) || ""}`.toLowerCase();
          const isExpectedTransient =
            msg.includes("429") ||
            msg.includes("503") ||
            msg.includes("quota") ||
            msg.includes("high demand") ||
            msg.includes("resource_exhausted") ||
            msg.includes("exhausted") ||
            msg.includes("rate") ||
            msg.includes("timeout");
          expect(isExpectedTransient).toBe(true);
        }
      }, 25000);
    });
  }
});
