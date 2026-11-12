import { describe, it, expect } from 'vitest';
import { handleChatTurn } from '@/lib/chat.server';

describe('Server-Side Live Gemini Integration Test', () => {
  it('should answer public query through Gemini with tool calling', async () => {
    const res = await handleChatTurn({
      messages: [
        { role: 'user', content: 'What music events are featured in Rangora?' }
      ]
    });

    expect(res).toBeDefined();
    expect(typeof res.text).toBe('string');
    expect(res.text.length).toBeGreaterThan(10);
    // Verify it doesn't leak secrets or raw database credentials
    expect(res.text).not.toContain('postgres://');
    expect(res.text).not.toContain('AIzaSy');
    expect(res.text).not.toContain('SELECT ');
  }, 30000);

  it('should handle seat availability queries with function calling', async () => {
    const res = await handleChatTurn({
      messages: [
        { role: 'user', content: 'What is the seat availability for event #4?' }
      ]
    });

    expect(res).toBeDefined();
    expect(typeof res.text).toBe('string');
    expect(res.text.length).toBeGreaterThan(10);
    expect(res.text).not.toContain('AIzaSy');
  }, 30000);
});
