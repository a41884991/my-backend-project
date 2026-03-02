import express from 'express';
import { testConnection } from './db.js';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import userRouter from './routes/userRoutes.js';
import postRouter from './routes/postRoutes.js'
import redis from './cache.js';
import { query } from './db.js';

const swaggerDocument = JSON.parse(fs.readFileSync('./src/swagger.json', 'utf8'));
const app = express();
const PORT = 3000;

app.use(express.json());
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// 掛載模塊化路由
app.use('/api/users', userRouter);
app.use('/api/posts', postRouter);

const warmupCache = async () => {
  console.log('開始快取預熱...');
  try {
    // 假設我們預熱最近活躍的 5 位使用者
    const hotUsers = await query('SELECT * FROM users ORDER BY created_at DESC LIMIT 5');
    
    for (const user of hotUsers.rows) {
      const cacheKey = `user:${user.id}`;
      const userToCache = { 
        ...user, 
        created_at: user.created_at?.toISOString() || '' 
      };
      await redis.hset(cacheKey, userToCache);
      await redis.expire(cacheKey, 3600 + Math.floor(Math.random() * 600));
    }
    console.log(`預熱完成，已快取 ${hotUsers.rows.length} 筆資料`);
  } catch (err) {
    console.error('預熱失敗:', err);
  }
};

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Server at http://localhost:${PORT}`);
  await testConnection();
  await warmupCache();
});