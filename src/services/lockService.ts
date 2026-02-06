import redis from '../cache.js';

export const acquireLock = async (lockKey: string, ttl: number = 10): Promise<boolean> => {
  const result = await redis.set(lockKey, 'locked', 'EX', ttl, 'NX');
  return result === 'OK';
};

export const releaseLock = async (lockKey: string): Promise<void> => {
  await redis.del(lockKey);
};