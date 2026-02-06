import { Redis } from 'ioredis'; // 加大括號

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  // 可以在這裡加上重連策略
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

redis.on('connect', () => {
  console.log('🚀 Successfully connected to Valkey');
});

redis.on('error', (err) => {
  console.error('❌ Valkey connection error:', err);
});

export default redis;