import { newAttemptId } from './attempt-id';

describe('newAttemptId', () => {
  it('returns a version 4 UUID that the backend can parse', () => {
    expect(newAttemptId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('returns a different ID each time', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newAttemptId()));
    expect(ids.size).toBe(50);
  });
});
