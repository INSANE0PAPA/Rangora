import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { Chatbot } from "@/components/Chatbot";
import {
  executeGeminiTool,
  searchEvents,
  getEventDetails,
  getLiveSeatAvailability,
  searchRangoraFaq,
  getMyRegistrationStatus,
} from "@/lib/gemini-tools";

describe("Browser Chatbot UI and Conversational Scenarios", () => {
  // -------------------------------------------------------------------------
  // 1. Five Conversational Scenarios (A - E) Tool & Resolution Flow
  // -------------------------------------------------------------------------
  describe("Conversational Scenarios (A - E) Data & Policy Flow", () => {
    it("Scenario A: 'Find upcoming robotics events.' -> searches robotics/tech events", async () => {
      const results = await searchEvents({ query: "robot" }, { isDemo: true });
      expect(results.length).toBeGreaterThan(0);
      const rover = results.find(e => e.name.toLowerCase().includes("rover") || e.name.toLowerCase().includes("robot"));
      expect(rover).toBeDefined();
      expect(rover?.name).toContain("Rover");
      expect(rover?.venue).toBeDefined();
    });

    it("Scenario B: 'Show me details about this event.' -> retrieves full event specs", async () => {
      const details = await getEventDetails({ eventId: 13 }, { isDemo: true });
      expect(details).not.toBeNull();
      expect(details?.id).toBe(13);
      expect(details?.name).toContain("Rover");
      expect(details?.description).toBeDefined();
      expect(details?.maxSeats).toBeGreaterThan(0);
      expect(details?.terms).toBeDefined();
    });

    it("Scenario C: 'How many seats are still available?' -> calculates live Seat Pulse", async () => {
      const availability = await getLiveSeatAvailability({ eventId: 1 }, { isDemo: true });
      expect("error" in availability).toBe(false);
      if (!("error" in availability)) {
        expect(availability.eventId).toBe(1);
        expect(availability.maxSeats).toBeGreaterThan(0);
        expect(availability.availableSeats).toBeGreaterThanOrEqual(0);
        expect(["available", "warm", "critical", "sold_out"]).toContain(availability.status);
      }
    });

    it("Scenario D: 'What is the difference between a registration and verified attendance?' -> FAQ guidance", async () => {
      const faqResults = await searchRangoraFaq({ query: "Echo" });
      expect(faqResults.length).toBeGreaterThan(0);
      const echoFaq = faqResults.find(f => f.category === "echoes");
      expect(echoFaq?.answer).toContain("confirmed booking");
      expect(echoFaq?.answer).toContain("verified on-site");
      expect(echoFaq?.answer).toContain("consent");
    });

    it("Scenario E: While signed out, ask: 'Show me my registrations.' -> requests sign-in", async () => {
      // Unauthenticated context (userId = null)
      const res = await getMyRegistrationStatus({ eventId: 1 }, { userId: null, isDemo: false });
      expect(res.authenticated).toBe(false);
      expect(res.message).toContain("sign in");
      expect(res.registered).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // 2. Chatbot React Component Lifecycle & Interaction
  // -------------------------------------------------------------------------
  describe("Chatbot Component UI & Responsive Behavior", () => {
    it("should render floating chat launcher button", () => {
      render(<Chatbot />);
      const launcher = screen.getByRole("button", { name: /open rangora chat/i });
      expect(launcher).toBeInTheDocument();
    });

    it("should toggle open and display messages area, header, and suggestions", () => {
      render(<Chatbot />);
      const launcher = screen.getByRole("button", { name: /open rangora chat/i });

      // Click to open
      fireEvent.click(launcher);

      // Verify header
      expect(screen.getByText("Ask the festival desk")).toBeInTheDocument();
      expect(screen.getByText("Rangora guide")).toBeInTheDocument();

      // Verify initial greeting message
      expect(screen.getByText(/Hi! I'm your Rangora guide/i)).toBeInTheDocument();

      // Verify suggestion chips
      expect(screen.getByRole("button", { name: /what events are coming up\?/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /how do event echoes work\?/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /how can i organise an event\?/i })).toBeInTheDocument();

      // Verify input field and send button
      const input = screen.getByPlaceholderText(/ask about an event…/i);
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute("maxLength", "1200");

      // Verify close button in header
      const closeBtn = screen.getByRole("button", { name: /close chat/i });
      expect(closeBtn).toBeInTheDocument();

      // Click to close
      fireEvent.click(closeBtn);
      expect(screen.queryByText("Ask the festival desk")).not.toBeInTheDocument();
    });

    it("should allow entering draft text and submitting message", () => {
      render(<Chatbot />);
      const launcher = screen.getByRole("button", { name: /open rangora chat/i });
      fireEvent.click(launcher);

      const input = screen.getByPlaceholderText(/ask about an event…/i) as HTMLInputElement;
      fireEvent.change(input, { target: { value: "Tell me about upcoming music" } });
      expect(input.value).toBe("Tell me about upcoming music");

      const sendBtn = screen.getByRole("button", { name: /send message/i });
      expect(sendBtn).not.toBeDisabled();
    });
  });
});
