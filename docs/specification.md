# デュエルアリーナ 仕様書（実装版）

> 本ドキュメントは実装完了後の最終仕様。初期構想版 `/specification.md` に対して、開発過程で確定・修正された内容を反映している。

## 1. プロジェクト概要

**プロジェクト名**：デュエルアリーナ（Duel Arena）

**コンセプト**：Discord連携の対戦管理Webアプリ。ユーザー同士のマッチング、勝敗登録、Eloレーティング、シーズン制を提供する。実際の対戦はDiscord上で行うことを想定し、Botが対戦用ボイスチャンネルを自動生成する。

## 2. 技術スタック

### フロントエンド
- **ビルド**：Vite
- **言語**：TypeScript
- **UI**：React 18 + Tailwind CSS
- **ルーティング**：React Router v6
- **状態管理**：Zustand（クライアント状態）+ TanStack Query（サーバー状態）
- **リアルタイム通信**：Socket.IO Client
- **テスト**：Vitest + Testing Library + jsdom

### バックエンド
- **ランタイム**：Node.js 22
- **フレームワーク**：Express
- **言語**：TypeScript（CommonJS）
- **ORM**：Prisma
- **DB**：PostgreSQL（Supabase）
- **WebSocket**：Socket.IO
- **認証**：Discord OAuth 2.0 + JWT（HttpOnly Cookie）
- **Discord連携**：discord.js v14
- **バリデーション**：Zod
- **テスト**：Vitest + Supertest

### インフラ
- **フロント**：Vercel
- **バック**：Railway（Docker）
- **DB / Storage**：Supabase
- **CI/CD**：GitHub Actions

## 3. 機能仕様

### 3.1 認証

- **方式**：Discord OAuth 2.0（`identify` スコープ）
- **セッション**：JWT を HttpOnly Cookie で保持（7日間有効）
- 初回ログイン時に `users` テーブルに自動登録
- 取得情報：Discord ID、ユーザー名、アバターURL
- 管理者は `.env` の `ADMIN_DISCORD_IDS` で指定（カンマ区切り）

### 3.2 マッチング

| パラメータ | 値 |
|---|---|
| 初期許容レート差 | ±100 |
| 拡張ペース | 1分ごとに +50 |
| タイムアウト | 5分でキューから自動削除 |
| 連続対戦ブロック | 直近2試合の対戦相手は再マッチ不可 |
| 同時キュー禁止 | 1ユーザーは同時に1キューのみ |
| 複数タブ禁止 | 最初に接続したタブのみ有効 |
| 星評価フィルタ | 平均星評価の差が ±1.5 を超える相手を除外（未評価ユーザーはフィルタ対象外） |

**マッチング選択ロジック**：候補が複数いる場合は、最もレート差が小さい相手を選択。同点なら待機時間が長い方を優先。

### 3.3 トス機能

マッチ成立直後、両プレイヤーに相手情報モーダルを表示し「承認」か「トス（拒否）」を選択させる。

| 連続トス回数 | ペナルティ |
|---|---|
| 1回目 | -3 |
| 2回目 | -10 |
| 3回目 | -30 |
| 4回目以降 | -50 |

- トスを受けた側は **+5** のレートボーナス
- 連続トスカウンタは **対戦完了時にリセット**
- 両者が承認すると `IN_PROGRESS` に遷移
- どちらかがトスするとその時点で `COMPLETED`（試合は無効化されず履歴に残る）

### 3.4 勝敗登録（新フロー）

仕様策定後、以下の方針に変更：

- **報告は両者がそれぞれ独立して登録可能**
- **承認は相手側のみが可能**（自分の報告を自分で承認はできない）
- **両者の報告内容が一致**：そのまま COMPLETED に確定（Elo適用）
- **両者の報告内容が不一致**：自動的に DISPUTED へ
- **片方のみ報告 → 5分経過**：自動承認で確定
- **両者報告なし → 40分経過**：DRAW（レート変動なし）

#### 状態遷移
```
PENDING_TOSS ─[両者承認]──▶ IN_PROGRESS
       │                       │
       │[片方トス]              │[片方報告]
       ▼                       ▼
   COMPLETED              WAITING_APPROVAL ──[相手承認 or 5分経過]──▶ COMPLETED
                               │
                               │[相手が異なる結果を報告 or 異議申し立て]
                               ▼
                          DISPUTED ──[管理者裁定]──▶ COMPLETED または CANCELLED

IN_PROGRESS ──[40分両者報告なし]──▶ DRAW
```

### 3.5 Eloレーティング

- **初期レート**：1500
- **K値**：Provisional期間（10試合未満）は40、それ以降は32
- **計算式**：標準のElo
  - 期待勝率 `E_a = 1 / (1 + 10^((R_b - R_a) / 400))`
  - 新レート `R_a' = R_a + K × (S_a - E_a)`（四捨五入）
- **下限**：0（負数にならない）
- **引き分け**：通常の試合では発生しない（40分タイムアウトのみ DRAW、レート変動なし）

### 3.6 通報・星評価

#### 星評価（1〜5）
- 試合終了時に相手の試合マナーを評価
- 1試合につき1人1回まで
- ユーザーの平均評価は新規評価のたびに再計算
- 平均評価はプロフィールに表示・マッチングフィルタに使用
- 自分が相手につけた評価は記録され、荒らし対策の検知に使用予定（管理画面側で実装余地）

#### 通報
- 試合終了後、`COMPLETED` / `DRAW` / `DISPUTED` / `CANCELLED` 状態で通報可能
- カテゴリ：`CHEAT` / `HARASSMENT` / `NO_SHOW` / `OTHER`
- 詳細記述：最大2000文字
- エビデンスURL：任意で最大5件まで（外部画像URL等）
- 同じ試合に対する重複通報は許容

### 3.7 シーズン制

- **期間**：3ヶ月
- **シーズン終了**：管理者が手動で `endSeasonAndStartNew` を呼ぶ（または将来的に自動化）
  - 全ユーザーのレートを1500にリセット
  - 試合数・勝敗・連続トスカウンタもリセット
  - 順位に応じた称号を付与
    - 1位：「シーズンX王者」
    - 上位10%：「シーズンX上位10%」
    - 上位30%：「シーズンX上位30%」
- **月間ランキング**：指定月の最多勝利者を集計
- **初回起動時**：アクティブシーズンが無ければ自動で「シーズン1」を作成

### 3.8 Discord Bot 連携

- **マッチ成立時**：2人専用のボイスチャンネルを自動生成（`match-XXXXXXXX`）
  - @everyone：閲覧・接続を deny
  - 当該2プレイヤー：View / Connect / Speak を allow
  - Bot自身：View / Manage / Connect を allow（自己アクセス確保）
- **試合終了時**：チャンネルを自動削除（COMPLETED / DRAW / トスのいずれでも）
- **Bot未設定時**：機能無効モードで動作（マッチング・対戦自体は動作）

### 3.9 管理画面

#### ダッシュボード
- 登録ユーザー数
- アクティブユーザー数（試合経験あり、BAN除外）
- BAN中ユーザー数
- キュー待機者数
- 進行中／承認待ち／紛争中の試合数
- 本日の試合数
- 30秒ごとに自動更新

#### 紛争裁定
- オープン中の紛争一覧
- 通報内容・エビデンスURL・プレイヤー報告内容を確認
- 勝者を選んで確定（Elo自動適用）
- 試合無効化（レート変動なし）も選択可

#### ユーザー管理
- ユーザー名 / Discord ID で検索
- BAN / BAN解除
- レート手動調整（履歴記録）

## 4. データベーススキーマ

`backend/prisma/schema.prisma` 参照。主要モデル：

| モデル | 用途 |
|---|---|
| `User` | ユーザー（Discord ID, レート, 戦績, BANフラグ等） |
| `Match` | 試合（プレイヤー2人, ステータス, トス情報, 承認状態, VCチャンネルID） |
| `MatchReport` | 個別プレイヤーの勝敗報告 |
| `RatingHistory` | レート変動履歴（MATCH / TOSS / SEASON_RESET / ADMIN_ADJUST） |
| `QueueEntry` | マッチング待機列（ユーザーごと1件） |
| `RecentOpponent` | 直近の対戦相手（連続マッチブロック用） |
| `Dispute` | 紛争（裁定待ち） |
| `Report` | 通報（カテゴリ + 詳細 + エビデンス） |
| `StarRating` | 1〜5星評価（同一試合内で1人1回） |
| `Season` | シーズン（期間, アクティブフラグ） |
| `SeasonTitle` | 称号（シーズン終了時に付与） |
| `Ban` | BAN履歴 |

## 5. REST API

### 認証
- `GET /api/auth/discord` — Discord 認可ページへリダイレクト
- `GET /api/auth/discord/callback` — OAuth コールバック
- `POST /api/auth/logout`

### ユーザー
- `GET /api/users/me` — 自身の情報

### 試合
- `GET /api/matches/:id` — 試合詳細（参加者または管理者のみ）
- `GET /api/matches/me/history` — 自分の試合履歴
- `GET /api/matches/me/active` — 進行中の試合（あれば）
- `POST /api/matches/:id/star-rating` — 星評価
- `POST /api/matches/:id/report-user` — 通報

### シーズン
- `GET /api/seasons/current`
- `GET /api/seasons/leaderboard`
- `GET /api/seasons/monthly?year=&month=`
- `GET /api/seasons/me/titles`

### 管理（管理者のみ）
- `GET /api/admin/dashboard`
- `GET /api/admin/users/search?q=`
- `POST /api/admin/users/:id/ban`
- `POST /api/admin/users/:id/unban`
- `POST /api/admin/users/:id/adjust-rating`
- `GET /api/admin/disputes`
- `POST /api/admin/disputes/:id/resolve`

### システム
- `GET /api/health`

## 6. WebSocket イベント

### クライアント → サーバー
- `queue:enter` — キューに入る
- `queue:leave` — キューから出る
- `queue:status` — 現在のキュー状態問い合わせ
- `match:accept` — 試合を承認
- `match:toss` — 試合をトス
- `match:report` — 勝敗報告
- `match:approve` — 相手の報告を承認
- `match:reject` — 異議申し立て

### サーバー → クライアント
- `queue:entered` — キュー入り成功
- `queue:left` — キューから出た
- `queue:status` — キュー状態
- `queue:timeout` — 5分タイムアウト
- `queue:error` — エラー
- `match:found` — マッチ成立通知
- `match:updated` — 試合状態が更新された
- `match:ended` — 試合終了（COMPLETED / DRAW）
- `match:error` — エラー
- `error:duplicate-tab` — 複数タブブロック通知

## 7. 環境変数

### バックエンド（`backend/.env`）
```env
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:5173

DATABASE_URL=postgresql://...

JWT_SECRET=（長いランダム文字列）
JWT_EXPIRES_IN=7d

DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_BOT_TOKEN=
DISCORD_GUILD_ID=
DISCORD_VOICE_CATEGORY_ID=
DISCORD_REDIRECT_URI=http://localhost:3001/api/auth/discord/callback

ADMIN_DISCORD_IDS=111,222

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

### フロントエンド（`frontend/.env`）
```env
VITE_API_BASE_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3001
```

## 8. フロントエンド画面

| パス | コンポーネント | 用途 |
|---|---|---|
| `/login` | `LoginPage` | Discord ログイン入口 |
| `/auth/success` | `AuthSuccessPage` | OAuth成功後の経由ページ |
| `/auth/error` | `AuthErrorPage` | 認証失敗 |
| `/` | `DashboardPage` | プロフィール、対戦開始、ナビ |
| `/queue` | `QueueWaitingPage` | マッチング待機 |
| `/match/:matchId` | `MatchPage` | 試合進行（トス／対戦中／承認／結果） |
| `/history` | `MatchHistoryPage` | 試合履歴 |
| `/leaderboard` | `LeaderboardPage` | シーズン情報＋ランキング |
| `/admin` | `AdminDashboardPage` | 管理ダッシュボード |
| `/admin/disputes` | `AdminDisputesPage` | 紛争裁定 |
| `/admin/users` | `AdminUsersPage` | ユーザー検索・BAN・レート調整 |

## 9. ディレクトリ構成

`README.md` 参照。

## 10. デプロイ

`DEPLOY.md` 参照。

## 11. 既知の未実装事項

将来的に追加検討の機能：

- 自動シーズン終了（現在は管理者が手動操作）
- ファイルアップロード対応（現状エビデンスURLはテキスト）
- 星評価による「荒らし検知」自動化
- Sentry / モニタリング統合
- マルチインスタンス対応（Socket.IO Redis アダプタ、tick の単一実行）
- 詳細な監査ログ
- 利用規約 / プライバシーポリシーページ
- 多言語対応（現状日本語のみ）

## 12. 仕様変更履歴

開発過程で当初仕様から変更された主要な点：

| 項目 | 当初 | 最終 |
|---|---|---|
| 勝敗承認 | 敗者（=報告された側）が承認 | 報告者と異なるプレイヤーが承認（自分の報告は自分で承認できない） |
| 両者報告 | 想定なし | 一致なら自動確定、不一致なら DISPUTED |
| 異議申し立て | 単一の「reject」 | 「同意」「反論報告」「異議申し立て」の3択 |
| 通報のファイル添付 | 画像・動画アップロード | エビデンスURLの記述（将来Storage対応予定） |
