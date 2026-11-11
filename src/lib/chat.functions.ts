import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ChatResponseResult } from "@/lib/chat.server";

const chatInput = z.object({
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

export const askRangora = createServerFn({ method: "POST" })
  .validator((input: unknown) => chatInput.parse(input))
  .handler(async ({ data }): Promise<ChatResponseResult> => {
    const { handleChatTurn } = await import("@/lib/chat.server");
    return handleChatTurn(data);
  });
