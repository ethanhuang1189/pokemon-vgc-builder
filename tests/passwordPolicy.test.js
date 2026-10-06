import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { passwordProblem, MIN_PASSWORD_LENGTH, MAX_PASSWORD_BYTES } from '../src/domain/passwordPolicy.js';

describe('passwordProblem', () => {
  it('accepts reasonable passwords and passphrases, with no composition rules', () => {
    for (const pw of ['correcthorse', 'all lowercase words here', '12345678ab', 'ÜnïcødePässwörd']) {
      assert.equal(passwordProblem(pw), null, pw);
    }
  });

  it('requires the minimum length', () => {
    assert.match(passwordProblem('a'.repeat(MIN_PASSWORD_LENGTH - 1)), /at least 8/);
    assert.equal(passwordProblem('a'.repeat(MIN_PASSWORD_LENGTH)), null);
  });

  it('limits by bytes, since bcrypt ignores anything past 72', () => {
    assert.equal(passwordProblem('a'.repeat(MAX_PASSWORD_BYTES)), null);
    assert.match(passwordProblem('a'.repeat(MAX_PASSWORD_BYTES + 1)), /at most 72/);
    assert.match(passwordProblem('é'.repeat(37)), /at most 72/); // 2 bytes each → 74 bytes
  });

  it('rejects using the email as the password', () => {
    assert.match(passwordProblem('Ash@Example.com', 'ash@example.com'), /email/);
    assert.equal(passwordProblem('ash@example.com!', 'ash@example.com'), null);
  });
});
