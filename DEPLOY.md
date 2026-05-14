# デュエルアリーナ デプロイ手順

## アーキテクチャ

```
┌─────────────────┐
│ Vercel          │  ← フロントエンド（React + Vite）
│ frontend/       │
└─────────────────┘
         │ HTTPS / WebSocket
         ▼
┌─────────────────┐      ┌─────────────────┐
│ Railway         │ ───▶ │ Supabase        │
│ backend/        │ PG    │ (PostgreSQL)    │
│ (Node + Express)│      └─────────────────┘
└─────────────────┘
         │
         │ Discord API
         ▼
┌─────────────────┐
│ Discord         │
│ (Bot + OAuth)   │
└─────────────────┘
```

## 1. データベース：Supabase

すでにローカル開発で使っているSupabaseプロジェクトをそのまま使用できます。

### 必要な接続文字列
- `DATABASE_URL`：Session Pooler の URL（ポート5432）
- `DIRECT_URL`：（任意）マイグレーション専用に Direct Connection を分けたい場合

### Storage（任意）
通報・紛争のエビデンスを保存する場合、Supabase Storage の Bucket を作成。
将来的に画像アップロード機能を追加する場合に使用。

## 2. バックエンド：Railway

### セットアップ
1. https://railway.app でアカウント作成
2. **New Project → Deploy from GitHub repo** を選択
3. リポジトリと `backend/` ディレクトリを指定
4. **Settings** → **Service**:
   - Build: Dockerfile が自動検出される
   - Start command: railway.toml で設定済み
5. **Variables** に環境変数を追加（後述）

### 環境変数（Railway）
```env
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://your-frontend.vercel.app

DATABASE_URL=postgresql://postgres.xxx:PASSWORD@aws-x.pooler.supabase.com:5432/postgres

JWT_SECRET=（長いランダム文字列）
JWT_EXPIRES_IN=7d

DISCORD_CLIENT_ID=xxx
DISCORD_CLIENT_SECRET=xxx
DISCORD_BOT_TOKEN=xxx
DISCORD_GUILD_ID=xxx
DISCORD_VOICE_CATEGORY_ID=xxx
DISCORD_REDIRECT_URI=https://your-backend.railway.app/api/auth/discord/callback

ADMIN_DISCORD_IDS=111,222
```

### デプロイ
ブランチに push すると自動的にビルド＆デプロイされます。
初回起動時、`prisma migrate deploy` で本番DBにマイグレーションが適用されます。

### Discord Developer Portal の更新
本番のリダイレクトURIを **OAuth2 → Redirects** に追加：
```
https://your-backend.railway.app/api/auth/discord/callback
```

## 3. フロントエンド：Vercel

### セットアップ
1. https://vercel.com でアカウント作成
2. **Add New Project → Import Git Repository**
3. リポジトリを選択し、**Root Directory** に `frontend` を指定
4. Framework Preset は自動で **Vite** が選択される
5. **Environment Variables** を追加

### 環境変数（Vercel）
```env
VITE_API_BASE_URL=https://your-backend.railway.app
VITE_SOCKET_URL=https://your-backend.railway.app
```

### デプロイ
ブランチに push すると自動的にビルド＆デプロイ。
プレビューデプロイ（PRごと）も有効。

## 4. 動作確認

### スモークテスト
1. **GET** `https://your-backend.railway.app/api/health` → `{"status":"ok",...}` が返る
2. ブラウザで `https://your-frontend.vercel.app/login` を開いて Discord ログイン
3. ログイン後ダッシュボードが表示される
4. ボタン操作（マッチング → トス / 対戦 → 履歴 → ランキング）

### 主要な確認ポイント
- [ ] CORS：`Access-Control-Allow-Origin` がフロントURLで返っている
- [ ] Cookie：Discord OAuth コールバック後、`duel_arena_token` が **HttpOnly + Secure** で設定される
- [ ] WebSocket：DevTools の Network → WS タブで接続が確立される
- [ ] Discord Bot：マッチ成立時にVCが生成され、終了時に削除される

## 5. 本番運用上の注意

### Cookieとセキュリティ
本番では `secure: true` （HTTPS必須）になります。`backend/src/config/env.ts` の `isProduction` が `NODE_ENV=production` で判定。

### サブドメイン構成
フロントとバックを別ドメインで運用する場合、**SameSite=Lax** では Cross-Site の WebSocket 接続が制限される可能性があります。同じトップレベルドメインのサブドメインを推奨：
- `app.example.com`（フロント）
- `api.example.com`（バック）

### スケーリング
現在の実装は **シングルプロセス前提** です。複数インスタンスでスケールする場合、以下に対応が必要：
- WebSocket: Redis アダプタ（`socket.io-redis-adapter`）
- ConnectionTracker: Redis ベースに置き換え
- マッチング tick: 単一インスタンスでのみ実行（リーダー選出 or 別ワーカー）

### ログ＆モニタリング
- Railway 標準のログを使用
- 将来的に Sentry / DataDog 等を統合する場合は `Sentry` SDK を `src/index.ts` で初期化

### バックアップ
Supabase は **Free プランで Point-in-Time Recovery 不可**。Pro プランへのアップグレード、または定期 `pg_dump` の cron 化を検討。

## 6. ロールバック手順

### バックエンド
1. Railway ダッシュボード → Service → Deployments
2. 巻き戻したいデプロイの「**Rollback**」をクリック

### フロントエンド
1. Vercel ダッシュボード → Project → Deployments
2. 過去のデプロイの「**Promote to Production**」をクリック

### DB マイグレーション
ロールバック前提のマイグレーションは Prisma では基本不可。重要な変更前にスナップショットを取得。

## 7. CI/CD

`.github/workflows/ci.yml` で以下が自動実行：
- バックエンド：型チェック + Vitest
- フロントエンド：型チェック + Vitest + 本番ビルド

PR が green になったら main に merge → Railway / Vercel が自動デプロイ。

## 8. ローカルでの本番ビルド確認

### バックエンド
```powershell
cd backend
npm run build
# .env で NODE_ENV=production にして
node dist/index.js
```

### フロントエンド
```powershell
cd frontend
npm run build
npm run preview
```
