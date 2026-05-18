import { describe, it, expect } from 'vitest';

// 导入需要测试的验证函数（从 gameController.js 提取）
const validateMoveInput = (boardId, x, y, player) => {
  if (!Number.isInteger(boardId) || boardId <= 0) {
    return { valid: false, message: "棋盘ID必须是正整数", status: 400 };
  }
  if (!Number.isInteger(x) || x < 0 || x > 14) {
    return { valid: false, message: "x 坐标必须在 0-14 范围内", status: 400 };
  }
  if (!Number.isInteger(y) || y < 0 || y > 14) {
    return { valid: false, message: "y 坐标必须在 0-14 范围内", status: 400 };
  }
  if (!Number.isInteger(player) || player < 1 || player > 2) {
    return { valid: false, message: "player 必须是 1(黑子) 或 2(白子)", status: 400 };
  }
  return { valid: true };
};

describe('validateMoveInput', () => {
  it('应该接受有效的输入', () => {
    const result = validateMoveInput(1, 7, 7, 1);
    expect(result.valid).toBe(true);
  });

  it('应该拒绝负数 boardId', () => {
    const result = validateMoveInput(-1, 7, 7, 1);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('棋盘ID');
    expect(result.status).toBe(400);
  });

  it('应该拒绝零 boardId', () => {
    const result = validateMoveInput(0, 7, 7, 1);
    expect(result.valid).toBe(false);
  });

  it('应该拒绝非整数 boardId', () => {
    const result = validateMoveInput(1.5, 7, 7, 1);
    expect(result.valid).toBe(false);
  });

  it('应该拒绝超出范围的 x 坐标', () => {
    const result = validateMoveInput(1, 15, 7, 1);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('x 坐标');
  });

  it('应该拒绝负数 x 坐标', () => {
    const result = validateMoveInput(1, -1, 7, 1);
    expect(result.valid).toBe(false);
  });

  it('应该拒绝超出范围的 y 坐标', () => {
    const result = validateMoveInput(1, 7, 15, 1);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('y 坐标');
  });

  it('应该拒绝无效的 player 值', () => {
    const result = validateMoveInput(1, 7, 7, 3);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('player');
  });

  it('应该拒绝字符串类型的坐标', () => {
    const result = validateMoveInput(1, "7", 7, 1);
    expect(result.valid).toBe(false);
  });
});
