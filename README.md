# Node.js 後端開發培訓實戰專案

本專案是一個基於 Node.js 的後端系統，從基礎的 API 開發、資料庫管理，進階到快取優化、分散式系統與 Kubernetes 部署。

## 技術

* **Runtime**: Node.js (TypeScript)
* **Framework**: Express 5.x
* **Database**: PostgreSQL 16 (實作 UUIDv7, Indexing, Joins)
* **Cache**: Valkey 7.2 (實作 Hash 數據型態, 快取防護機制)
* **Documentation**: OpenAPI / Swagger UI
* **Infrastructure**: Docker & Docker Compose

## 快速啟動

### 1. 環境變數設定
請在專案根目錄建立 `.env` 檔案，參考以下配置（具體數值請依據個人環境調整）：
```env
DB_USER=admin
DB_PASSWORD=mysecretpassword
DB_NAME=learning_db
DB_HOST=localhost
DB_PORT=5432
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 2. 啟動基礎設施

使用 Docker 一鍵啟動 PostgreSQL 與 Valkey：
```
docker compose up -d
```

### 3. 安裝依賴並啟動開發伺服器
```
npm install
npm run dev
```
伺服器將運行於 http://localhost:3000，API 文件位於 http://localhost:3000/api-docs。

## 目前開發進度 (Week 3)
### Week 1: 環境建置與基礎

    [x] Debian 13 虛擬機環境設定
    [x] Docker / Docker Compose 基礎應用

### Week 2: 資料庫設計與 API 實作
    [x] PostgreSQL 與 Node.js 連線 (Connection Pool)
    [x] 採用 UUIDv7 作為資料主鍵
    [x] 實作 Users 與 Posts 的一對多關聯
    [x] 資料庫索引優化 (Unique Index)
    [x] 資料備份與恢復腳本實作

### Week 3: 快取進階與系統防護 (進行中)

    [x] Valkey Hash 數據型態應用 (HSET/HGETALL)
    [x] 快取穿透防禦：存儲空值標記避免無效請求直擊 DB
    [x] 一致性策略：實作 Cache-Aside (Invalidation) 模式
    [x] 基礎分散式鎖實作 
    [x] **進階安全鎖**：實作隨機 Token 與 Lua 腳本原子化釋放鎖

## API 概覽

    Users: 註冊 (POST /api/users)、取得資料 (GET /api/users/:id)、更新 (PATCH /api/users/:id)、刪除 (DELETE /api/users/:id)。

    Posts: 發布文章 (POST /api/posts)、取得使用者所有文章 (GET /api/users/:id/posts)。

    Debug: Hash 快取測試 (POST /api/debug/hash-user/:id)。

## 專案結構
```text
src/
├── routes/          # API 路由定義 (userRoutes.ts,postRoutes.ts)
├── services/        # 業務邏輯服務 (lockService.ts)
├── db.ts            # PostgreSQL 連線配置
├── cache.ts         # Valkey 連線配置
├── swagger.json     # OpenAPI 規格文件
└── index.ts         # 伺服器啟動與路由掛載
```

## 資料庫工具

    備份資料庫: npm run db:backup
    還原資料庫: npm run db:restore