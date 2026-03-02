import redis from '../cache.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * 獲取帶有隨機標記的安全鎖
 * @returns 成功回傳 token (string)，失敗回傳 null
 */
export const acquireLock = async (lockKey: string, ttl: number = 10): Promise<string | null> => {
  const token = uuidv4();
  // 使用 NX (不存在才設定) 與 EX (過期時間)
  const result = await redis.set(lockKey, token, 'EX', ttl, 'NX');
  return result === 'OK' ? token : null;
};

/**
 * 使用 Lua 腳本安全釋放鎖
 * 只有當 Key 存在且 Value 等於傳入的 token 時才刪除
 */
export const releaseLock = async (lockKey: string, token: string): Promise<boolean> => {
  const luaScript = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;

  const result = await redis.eval(luaScript, 1, lockKey, token);
  return result === 1;
};