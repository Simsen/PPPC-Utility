import { describe, it, expect } from 'vitest';
import { defaultCodeRequirement } from './codeRequirement';

describe('defaultCodeRequirement', () => {
  it('builds an anchor-apple-generic requirement for the given bundle ID', () => {
    expect(defaultCodeRequirement('com.example.app')).toBe(
      'identifier "com.example.app" and anchor apple generic',
    );
  });
});
