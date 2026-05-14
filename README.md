# デュエルアリーナ

Discord連携の対戦管理Webアプリ。マッチング、勝敗登録、Eloレーティング、シーズン制を提供する。

実際の対戦はDiscord上で行うことを想定。Botが対戦用ボイスチャンネルを自動生成する。

## 技術スタック

| 領域 | スタック |
|---|---|
| フロント | Vite + React + TypeScript + Tailwind CSS + React Router + Zustand + TanStack Query + Socket.IO Client |
| バック | Node.js + Express + TypeScript + Prisma + Socket.IO + discord.js |
| DB | PostgreSQL (Supabase) |
| デプロイ | Vercel (フロント) / Railway (バック) / Supabase (DB) |
| テスト | Vitest |

詳しい仕様は [specification.md](./specification.md) を参照。

## セットアップ

### 前提
- Node.js 22+
- Supabaseアカウント
- Discord Developer Portal アプリ（OAuth + Bot）

### 1. 依存インストール

```powershell
cd C:\project\duel-arena
npm run install:all
```

### 2. .env の作成

```powershell
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env
```

`backend\.env` を以下のように設定：
- `DATABASE_URL`：Supabase Session Pooler の URL（ポート5432）
- `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET`：Discord OAuth2
- `DISCORD_BOT_TOKEN`：Bot Token（任意・未設定でも動作）
- `DISCORD_GUILD_ID`：BotがいるDiscordサーバーのID
- `DISCORD_VOICE_CATEGORY_ID`：VC作成先カテゴリのID（任意）
- `ADMIN_DISCORD_IDS`：管理者のDiscord IDをカンマ区切り
- `JWT_SECRET`：適当な長いランダム文字列

### 3. DBマイグレーション

```powershell
cd backend
npm run prisma:generate
npm run prisma:migrate
```

### 4. 開発サーバー起動

```powershell
# ターミナル1
npm run dev:backend

# ターミナル2
npm run dev:frontend
```

→ http://localhost:5173

## テスト実行

```powershell
# 全体
npm test

# バックエンドのみ
npm run test:backend

# フロントエンドのみ
npm run test:frontend
```

## ディレクトリ構成

```
duel-arena/
├── backend/                  # Express + Prisma サーバー
│   ├── src/
│   │   ├── config/           # 環境変数
│   │   ├── discord/          # Discord Bot連携
│   │   ├── lib/              # 共通ライブラリ
│   │   ├── middleware/       # 認証など
│   │   ├── routes/           # REST API
│   │   ├── services/         # ビジネスロジック
│   │   └── sockets/          # Socket.IO
│   ├── tests/                # Vitestテスト
│   └── prisma/               # スキーマ・マイグレーション
├── frontend/                 # Vite + React
│   ├── src/
│   │   ├── api/              # APIクライアント
│   │   ├── components/       # 共通コンポーネント
│   │   ├── hooks/            # カスタムフック
│   │   ├── lib/              # ユーティリティ
│   │   ├── pages/            # ルートごとのページ
│   │   └── stores/           # Zustand
│   └── tests/                # Vitestテスト
├── shared/                   # 共通型定義
├── .github/workflows/        # CI設定
├── specification.md          # 仕様書
└── DEPLOY.md                 # デプロイ手順
```

## ライセンス

未設定。
