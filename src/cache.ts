import { Redis } from 'ioredis'; // 加大括號

const redis = new Redis({
  host: '127.0.0.1',
  port: 6379,
  retryStrategy(times) {
    return Math.min(times * 50, 2000);
  },
});

redis.on('connect', () => {
  console.log('🚀 Successfully connected to Valkey');
});

redis.on('error', (err) => {
  console.error('❌ Valkey connection error:', err);
});

export default redis;