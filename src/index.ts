import express from 'express';
import { testConnection } from './db.js';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import userRouter from './routes/userRoutes.js';
import postRouter from './routes/postRoutes.js'

const swaggerDocument = JSON.parse(fs.readFileSync('./src/swagger.json', 'utf8'));
const app = express();
const PORT = 3000;

app.use(express.json());
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// 掛載模塊化路由
app.use('/api/users', userRouter);
app.use('/api/posts', postRouter);

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Server at http://localhost:${PORT}`);
  await testConnection();
});