import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { executeEventBooking } from "@/lib/api.functions";
import { getStoredDemoSession } from "@/lib/use-auth";

export function useBooking(userId: string | undefined) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async ({ eventId, kind }: { eventId: number; kind: "booked" | "planned" }) => {
      let targetUserId = userId;

      if (!targetUserId) {
        const demo = getStoredDemoSession();
        if (demo?.role === "participant") {
          targetUserId = demo.userId;
        } else {
          toast.info("Sign in with a student account or try Demo Participant to book passes.");
          navigate({ to: "/auth", search: { mode: "login" } });
          throw new Error("signin");
        }
      }

      const res = await executeEventBooking({
        data: {
          userId: targetUserId,
          eventId,
          kind,
        },
      });

      return { kind, passCode: "passCode" in res ? res.passCode : undefined };
    },
    onSuccess: (result) => {
      toast.success(
        result.kind === "booked"
          ? `Pass reserved! Your pass code is ${result.passCode || "confirmed"}. View it in your passes.`
          : "Added to your festival plan."
      );
      void qc.invalidateQueries({ queryKey: ["seat-counts"] });
      void qc.invalidateQueries({ queryKey: ["event-registration"] });
      void qc.invalidateQueries({ queryKey: ["demo-workspace-state"] });
    },
    onError: (e: Error & { code?: string }) => {
      if (e.message === "signin") return;
      toast.error(
        e.message.includes("capacity") || e.message.includes("full")
          ? "This event has reached full capacity."
          : e.message || "Could not save booking. Please try again."
      );
    },
  });
}
