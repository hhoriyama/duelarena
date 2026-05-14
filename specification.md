# デュエルアリーナ 仕様書

## 1. プロジェクト概要

**プロジェクト名**：デュエルアリーナ（Duel Arena）

**コンセプト**：
ユーザー同士のマッチング、勝敗登録、レーティング管理を行う対戦管理Webアプリ。実際の対戦は Discord 上で行われることを想定し、Discord連携によりログイン・通話ルーム自動生成までをサポートする。

**主な機能**：
- Discord OAuth ログイン
- レーティングベースのマッチング
- マッチ成立時のトス（受諾/拒否）機能
- 勝敗登録・承認フロー
- Eloレーティング自動計算
- 試合履歴・プロフィール
- Discord 通話ルーム自動生成・削除
- 通報・星評価
- シーズン制（3ヶ月単位）
- 管理画面（紛争裁定、BAN、ダッシュボード）

---

## 2. 技術スタック

### フロントエンド
- **ビルドツール**：Vite
- **言語**：TypeScript
- **UIライブラリ**：React
- **スタイリング**：Tailwind CSS
- **ルーティング**：React Router
- **状態管理**：Zustand（クライアント状態）+ TanStack Query（サーバー状態）
- **WebSocket クライアント**：Socket.IO Client
- **フォーム**：React Hook Form + Zod

### バックエンド
- **ランタイム**：Node.js
- **フレームワーク**：Express
- **言語**：TypeScript
- **ORM**：Prisma
- **WebSocket**：Socket.IO
- **認証**：Discord OAuth 2.0 + JWT（Cookie）
- **バリデーション**：Zod
- **Discord 連携**：discord.js（Bot）

### データベース・ストレージ
- **DB**：PostgreSQL（Supabase）
- **ストレージ**：Supabase Storage（紛争用画像・動画）

### テスト
- **ユニットテスト**：Vitest
- **モック**：Vitest 標準

### デプロイ
- **フロントエンド**：Vercel
- **バックエンド**：Railway
- **データベース・ストレージ**：Supabase

### UI 対応
- スマホ対応（レスポンシブ）

---

## 3. 機能仕様

### 3.1 認証

- **方式**：Discord OAuth 2.0
- 初回ログイン時に `users` テーブルへ自動登録
- セッション管理：JWT を HttpOnly Cookie で保持
- 取得情報：Discord ID、ユーザー名、アバターURL

### 3.2 マッチングシステム

- **エントリー**：プロフィール画面の「対戦相手を見つける」ボタン
- **初期許容レート差**：±100
- **拡張ロジック**：1分経過ごとに +50 拡張
- **タイムアウト**：5分でキューから自動削除
- **連続対戦ブロック**：直近2試合の対戦相手とは再マッチしない
- **同時キュー禁止**：1ユーザーは同時に1キューのみ
- **複数タブ禁止**：最初に接続したタブを有効とし、後から開いたタブはブロック
- **星評価フィルタ**：自分と相手の星評価平均が大きく離れている場合は除外（差の閾値は仮 1.5 とし、運用で調整）

### 3.3 トス機能

マッチ成立時、両プレイヤーに相手情報モーダルを表示し、**承認** または **トス** を選択させる。

- **モーダル表示内容**：相手のユーザー名、アバター、現レート、勝敗数、星評価平均
- **トス受諾側のポイント**：+5（レート加算）
- **トス側のペナルティ**（連続でトスした場合に増加）：
  - 1回目：-3
  - 2回目：-10
  - 3回目：-30
  - 4回目以降：-50
- **ペナルティリセット条件**：実際に対戦を完了するとカウンターがリセット
- **両者承認**：通常の対戦フローへ進む
- **片方トス**：その時点で試合終了として処理

### 3.4 勝敗登録

- **報告者**：勝者が登録
- **承認**：敗者が承認（または拒否）
- **自動承認タイムアウト**：5分
- **食い違い時**：管理者裁定（紛争ステータス）
- **試合キャンセル時**：レート変動なし、なかったことにする
- **試合中断**（切断などで継続不可）：「中断」ステータスとし、続行不可
- **40分タイムアウト**：マッチ成立から40分経過しても両者とも何も報告しない場合、引き分けとして処理（レート変動なし、試合無効化）

### 3.5 レーティング（Elo）

- **初期レート**：1500
- **K値**：
  - Provisional 期間（初回〜10試合）：K=40
  - 通常時：K=32
- **計算式**：標準の Elo 計算式
  - 期待勝率 E_a = 1 / (1 + 10^((R_b - R_a) / 400))
  - 新レート R_a' = R_a + K × (S_a - E_a)
  - S_a：勝ち=1、負け=0
- **引き分け**：基本なし（40分タイムアウトのみ引き分けだがレート変動なし）

### 3.6 通報・星評価

- **発生タイミング**：試合終了後
- **通報**：理由カテゴリ＋自由記述、画像/動画添付可
- **星評価**：1〜5
- **荒らし対策**：自分が相手につけた点数も記録し、極端に偏った評価をするユーザーを検知。低評価を連続でつけているユーザーは管理者画面に表示。

### 3.7 シーズン制

- **シーズン期間**：3ヶ月
- **シーズン終了時**：
  - レート完全リセット（全員 1500 に戻る）
  - シーズン終了時の順位に応じた**称号**を付与（プロフィールに表示）
- **月間ランキング**：1ヶ月ごとの最多勝利者などを表示

### 3.8 管理画面

- **紛争中の試合裁定**：通報内容、提出された画像・動画を閲覧し、勝者を確定
- **ユーザー検索**：Discord ID、ユーザー名で検索
- **BAN機能**：ユーザーをアプリから締め出し
- **試合履歴閲覧**：全試合の履歴
- **ダッシュボード**：DAU、進行中マッチ数、紛争件数、月間統計
- **管理者指定**：`.env` に `ADMIN_DISCORD_IDS` として Discord ID をカンマ区切りで指定

### 3.9 試合終了後の挙動

- 自動的にキューに戻さず、ユーザーが手動で再エントリー

---

## 4. データベーススキーマ

### users
- id (UUID, PK)
- discord_id (string, unique)
- username (string)
- avatar_url (string)
- current_rating (int, default 1500)
- highest_rating (int, default 1500)
- wins (int, default 0)
- losses (int, default 0)
- draws (int, default 0)
- match_count (int, default 0) — Provisional判定用
- consecutive_toss_count (int, default 0)
- average_star_rating (float, nullable)
- is_banned (boolean, default false)
- created_at, updated_at

### matches
- id (UUID, PK)
- player1_id (FK → users)
- player2_id (FK → users)
- status (enum: PENDING_TOSS / IN_PROGRESS / WAITING_APPROVAL / DISPUTED / COMPLETED / CANCELLED / DRAW / INTERRUPTED)
- winner_id (FK → users, nullable)
- season_id (FK → seasons)
- discord_voice_channel_id (string, nullable)
- toss_by_id (FK → users, nullable)
- started_at
- ended_at (nullable)
- created_at

### match_reports
- id (UUID, PK)
- match_id (FK → matches)
- reporter_id (FK → users)
- reported_winner_id (FK → users)
- reported_at

### rating_histories
- id (UUID, PK)
- user_id (FK → users)
- match_id (FK → matches, nullable) — トスでも記録
- rating_before
- rating_after
- delta
- reason (enum: MATCH / TOSS_RECEIVED / TOSS_PENALTY / SEASON_RESET / ADMIN_ADJUST)
- created_at

### queue_entries
- id (UUID, PK)
- user_id (FK → users, unique)
- rating_at_entry
- entered_at
- current_range (int) — 動的に拡張
- socket_id (string)

### recent_opponents
- id (UUID, PK)
- user_id (FK → users)
- opponent_id (FK → users)
- match_id (FK → matches)
- created_at
（直近2試合判定用、SELECTで最新2件取得）

### disputes
- id (UUID, PK)
- match_id (FK → matches)
- raised_by_id (FK → users)
- description (text)
- evidence_urls (string[])
- status (enum: OPEN / RESOLVED)
- resolved_winner_id (FK → users, nullable)
- resolved_by_admin_id (string, nullable)
- created_at, resolved_at

### reports
- id (UUID, PK)
- match_id (FK → matches)
- reporter_id (FK → users)
- target_id (FK → users)
- category (enum: CHEAT / HARASSMENT / NO_SHOW / OTHER)
- description (text)
- evidence_urls (string[])
- created_at

### star_ratings
- id (UUID, PK)
- match_id (FK → matches)
- rater_id (FK → users)
- rated_id (FK → users)
- stars (int 1〜5)
- created_at

### seasons
- id (UUID, PK)
- name (string)
- start_at, end_at
- is_active (boolean)

### season_titles
- id (UUID, PK)
- season_id (FK → seasons)
- user_id (FK → users)
- rank (int)
- title (string) — 例：「シーズン1王者」「シーズン1上位10%」

### bans
- id (UUID, PK)
- user_id (FK → users)
- reason (text)
- banned_by (string) — 管理者の Discord ID
- created_at

---

## 5. API 設計（主要エンドポイント）

### 認証
- `GET /api/auth/discord` — Discord OAuth リダイレクト
- `GET /api/auth/discord/callback` — コールバック
- `POST /api/auth/logout`
- `GET /api/auth/me` — 現在のユーザー情報

### プロフィール
- `GET /api/users/:id` — プロフィール取得
- `GET /api/users/:id/history` — 試合履歴
- `PATCH /api/users/me` — プロフィール更新

### マッチング
- `POST /api/queue/enter` — キューに入る
- `POST /api/queue/leave` — キャンセル
- `GET /api/queue/status` — 現在のキュー状態

### 試合
- `POST /api/matches/:id/toss` — トスする
- `POST /api/matches/:id/accept` — 承認（対戦開始）
- `POST /api/matches/:id/report` — 勝敗報告
- `POST /api/matches/:id/approve` — 報告承認
- `POST /api/matches/:id/reject` — 報告拒否（紛争へ）
- `GET /api/matches/:id` — 試合詳細

### 通報・評価
- `POST /api/matches/:id/report-user` — 通報
- `POST /api/matches/:id/star-rating` — 星評価

### シーズン
- `GET /api/seasons/current` — 現シーズン情報
- `GET /api/seasons/:id/leaderboard` — ランキング
- `GET /api/seasons/:id/monthly-stats` — 月間統計

### 管理者
- `GET /api/admin/disputes` — 紛争一覧
- `POST /api/admin/disputes/:id/resolve` — 裁定
- `GET /api/admin/users/search` — ユーザー検索
- `POST /api/admin/users/:id/ban` — BAN
- `GET /api/admin/dashboard` — ダッシュボード

---

## 6. WebSocket イベント

### サーバー → クライアント
- `match:found` — マッチ成立通知（相手情報を含む）
- `match:tossed` — 相手がトスした通知
- `match:started` — 両者承認・対戦開始
- `match:report-received` — 相手から勝敗報告
- `match:approved` — 報告が承認された
- `match:disputed` — 紛争状態に
- `match:ended` — 試合終了
- `queue:expanded` — 許容レート差が拡大した

### クライアント → サーバー
- `queue:enter`
- `queue:leave`
- `match:toss`
- `match:accept`

---

## 7. Discord 連携

### Bot 機能
- マッチ成立時、対戦用ボイスチャンネルを自動生成
- 対象2ユーザーのみが閲覧・接続可能（権限設定）
- 試合終了時にチャンネル削除

### 必要な Bot 権限
- View Channels
- Manage Channels
- Connect
- Move Members（必要に応じて）

### 必要な事前準備
- Discord Developer Portal でアプリケーション登録
- Bot 作成・トークン取得
- 対戦用 Discord サーバーへの Bot 招待
- ボイスチャンネル作成カテゴリ ID の設定

---

## 8. 画面構成

### 一般ユーザー
- ログイン画面
- ダッシュボード（自分のレート、戦績、現シーズン情報、再エントリーボタン）
- マッチング待機画面（キュー状態、許容レート差、待機時間）
- マッチ成立モーダル（相手情報、承認/トス）
- 対戦中画面（試合状態、勝敗報告ボタン）
- 勝敗承認画面
- 紛争申請画面（証拠アップロード）
- 試合履歴画面
- プロフィール画面
- 通報・星評価画面
- ランキング画面
- 月間統計画面

### 管理者
- 管理ダッシュボード
- 紛争裁定画面
- ユーザー管理（検索・BAN）
- 試合履歴全件
- 通報一覧

---

## 9. 環境変数

### バックエンド (.env)
```
DATABASE_URL=postgresql://...
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_BOT_TOKEN=
DISCORD_GUILD_ID=
DISCORD_VOICE_CATEGORY_ID=
DISCORD_REDIRECT_URI=
JWT_SECRET=
ADMIN_DISCORD_IDS=123456789,987654321
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
FRONTEND_URL=
PORT=3001
```

### フロントエンド (.env)
```
VITE_API_BASE_URL=
VITE_SOCKET_URL=
```

---

## 10. ディレクトリ構成（予定）

```
duel-arena/
├── frontend/               # Vite + React + TypeScript
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── stores/         # Zustand
│   │   ├── api/            # TanStack Query
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── types/
│   ├── tests/
│   └── ...
├── backend/                # Express + TypeScript
│   ├── src/
│   │   ├── routes/
│   │   ├── services/       # Elo, matchmaking, discord 等
│   │   ├── middleware/
│   │   ├── sockets/
│   │   ├── prisma/
│   │   └── lib/
│   ├── tests/
│   ├── prisma/
│   │   └── schema.prisma
│   └── ...
├── shared/                 # 型定義・定数を共有
└── specification.md
```

---

## 11. 開発ロードマップ

| フェーズ | 内容 |
|---------|------|
| ① 仕様確定 | 本仕様書（完了） |
| ② 雛形生成 | Vite/Express プロジェクト初期化、Prisma スキーマ定義 |
| ③ 認証 | Discord OAuth 実装 |
| ④ コアロジック | マッチング、トス、勝敗登録、Elo計算 |
| ⑤ Discord Bot | ボイスチャンネル自動生成・削除 |
| ⑥ 通報・評価・シーズン | 関連機能 |
| ⑦ 管理画面 | 紛争裁定、BAN、ダッシュボード |
| ⑧ ユニットテスト | Vitest による主要ロジックテスト |
| ⑨ デプロイ準備 | Vercel/Railway/Supabase セットアップ、CI/CD |

---

## 12. ユーザー側で事前に準備が必要なもの

- Discord Developer Portal でアプリ登録（Client ID/Secret）
- Discord Bot 作成（Bot Token、対戦用サーバーへの招待）
- 対戦用 Discord サーバーの用意とカテゴリ ID 取得
- Supabase アカウント・プロジェクト作成（DATABASE_URL、Service Role Key）
- Vercel アカウント
- Railway アカウント
- GitHub リポジトリ
