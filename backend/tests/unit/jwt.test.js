import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../../config/jwt.js';

describe('JWT Config', () => {
  it('应该有定义的 JWT_SECRET', () => {
    expect(JWT_SECRET).toBeDefined();
    expect(typeof JWT_SECRET).toBe('string');
    expect(JWT_SECRET.length).toBeGreaterThan(0);
  });

  it('应该有定义的 JWT_EXPIRES_IN', () => {
    expect(JWT_EXPIRES_IN).toBeDefined();
    expect(JWT_EXPIRES_IN).toBe('7d');
  });

  it('应该能正确签名和验证 token', () => {
    const payload = { id: 1, username: 'testuser' };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    expect(token).toBeDefined();
    expect(token.split('.')).toHaveLength(3); // JWT 有三部分

    const decoded = jwt.verify(token, JWT_SECRET);
    expect(decoded.id).toBe(payload.id);
    expect(decoded.username).toBe(payload.username);
  });

  it('应该用错误密钥验证失败', () => {
    const payload = { id: 1, username: 'testuser' };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    expect(() => {
      jwt.verify(token, 'wrong-secret');
    }).toThrow();
  });
});
