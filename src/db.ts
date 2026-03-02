import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  // 增加連線逾時設定，防止無限期等待
  connectionTimeoutMillis: 5000, 
});

// 核心修正：監聽錯誤，防止進程崩潰
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// 測試連線的正確函式（這才是主動測試）
export const testConnection = async () => {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT NOW()');
    console.log('資料庫連線成功，伺服器時間：', res.rows[0].now);
  } finally {
    client.release(); // 記得釋放連線回池子
  }
};

export const query = (text: string, params?: any[]) => pool.query(text, params);