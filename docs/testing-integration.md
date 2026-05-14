# 結合テスト

> **ステータス：実装済み（バックエンド側、約94ケース）**
>
> Phase 1〜2の重要箇所をカバー。フロントエンド複雑コンポーネントと E2E は Phase 3 として今後追加予定。

## 1. 実行方法

### 前提
- Docker（テスト用 PostgreSQL の起動）
- Node.js 22+

### セットアップ

```powershell
# テスト用DB起動
docker compose -f docker-compose.test.yml up -d

# テスト用 .env をコピー
cd backend
copy .env.test.example .env.test

# 依存追加（dotenv-cli, socket.io-client）
npm install

# テスト用DBにマイグレーション
npm run test:integration:setup
```

### 実行

```powershell
# 結合テスト全部
npm run test:integration

# 特定ファイル
npx vitest run -c vitest.integration.config.ts tests/integration/matchmaking.test.ts
```

### 後始末

```powershell
docker compose -f docker-compose.test.yml down -v
```

## 2. テスト構成

```
backend/tests/integration/
├── setup.ts                        # .env.test 読み込み・安全装置
├── helpers/
│   ├── db.ts                       # testPrisma + resetDb()
│   ├── seed.ts                     # createUser, createMatch 等
│   ├── auth.ts                     # JWT Cookie生成
│   └── socket-server.ts            # Socket.IOテストサーバー
├── matchmaking.test.ts             # サービス：マッチング・キュー
├── toss-service.test.ts            # サービス：トス・accept
├── match-report-service.test.ts    # サービス：勝敗・承認・自動承認
├── star-rating-service.test.ts     # サービス：星評価
├── report-service.test.ts          # サービス：通報
├── admin-service.test.ts           # サービス：管理操作
├── season-service.test.ts          # サービス：シーズン
├── routes-matches.test.ts          # API：/api/matches
├── routes-admin.test.ts            # API：/api/admin
├── routes-seasons.test.ts          # API：/api/seasons
├── routes-users.test.ts            # API：/api/users
├── sockets-queue.test.ts           # Socket：キュー
└── sockets-match.test.ts           # Socket：試合
```

## 3. テスト戦略

### 3.1 DB分離

- テスト用Postgres（ポート5433、`duel_arena_test`）を Docker で起動
- 各テストの `beforeEach` で `resetDb()` → TRUNCATE CASCADE で全テーブル初期化
- `setup.ts` の安全装置で「DATABASE_URLに `test` が含まれていなければ起動を中断」

### 3.2 シリアル実行

`vitest.integration.config.ts` で `singleFork: true` を指定し、テストを **逐次実行**。DBの共有による競合を防ぐ。

### 3.3 Socket.IO の動的ポート

`startTestServer()` でランダムポートにバインド。複数テスト並行や本番との衝突を避ける。

### 3.4 認証ヘルパー

`authCookie()` で実際の JWT を生成 → Supertest の Cookie ヘッダに付与。OAuth フローを毎回踏まずに認証済みリクエストを送れる。

## 4. テストケース一覧

### 4.1 サービス層

| ファイル | ケース数 | 主な検証内容 |
|---|---|---|
| `matchmaking.test.ts` | 15 | 単独入室、2人マッチ、レート差±100、連続対戦ブロック、進行中試合、BAN、idempotent、星評価フィルタ、recent_opponents、leave、状態取得、tick |
| `toss-service.test.ts` | 8 | accept片方/両者、参加者外不可、ステータス不一致不可、tossペナルティ-3〜-50、highestRating、レート履歴 |
| `match-report-service.test.ts` | 14 | 単独報告→WAITING、両者一致→COMPLETED、両者不一致→DISPUTED、approve、reject、autoApprove、markAsDraw、tickMatchTimeouts |
| `star-rating-service.test.ts` | 6 | 評価作成、平均更新、重複拒否、参加者外不可、進行中不可、範囲チェック |
| `report-service.test.ts` | 7 | COMPLETED通報、進行中不可、DISPUTED可、参加者外不可、文字数/URL数制限、重複許容、カテゴリ検証 |
| `admin-service.test.ts` | 11 | ダッシュボード、検索、BAN、レート調整、紛争一覧、勝者確定、無効化、二重裁定防止 |
| `season-service.test.ts` | 7 | 初回シード、既存返却、リーダーボード、月間統計、シーズン終了（リセット+称号） |

### 4.2 ルート層

| ファイル | ケース数 | 主な検証内容 |
|---|---|---|
| `routes-users.test.ts` | 4 | 401/200/isAdmin/不在404 |
| `routes-matches.test.ts` | 10 | 詳細閲覧の認可（参加者/第三者/管理者）、履歴、進行中、星評価、通報 |
| `routes-admin.test.ts` | 10 | 認可（401/403/200）、検索、BAN、レート調整、紛争一覧、裁定、無効化 |
| `routes-seasons.test.ts` | 6 | 認証、現シーズン取得、リーダーボード、月間統計、称号 |

### 4.3 Socket.IO 層

| ファイル | ケース数 | 主な検証内容 |
|---|---|---|
| `sockets-queue.test.ts` | 6 | 認証なし拒否、queue:enter/entered、マッチ成立通知、複数タブブロック、leave、切断時自動削除、進行中試合エラー |
| `sockets-match.test.ts` | 7 | accept→IN_PROGRESS通知、toss→ended、報告→承認→ended、両者一致即終了、不一致→DISPUTED、自分の報告承認エラー、reject |

## 5. CI への組み込み（推奨設定）

`.github/workflows/ci.yml` に統合する場合の追加ジョブ：

```yaml
integration:
  runs-on: ubuntu-latest
  defaults:
    run:
      working-directory: ./backend
  services:
    postgres:
      image: postgres:16-alpine
      env:
        POSTGRES_USER: test
        POSTGRES_PASSWORD: test
        POSTGRES_DB: duel_arena_test
      ports: ['5433:5432']
      options: >-
        --health-cmd pg_isready --health-interval 5s --health-timeout 5s --health-retries 5
  env:
    DATABASE_URL: postgresql://test:test@localhost:5433/duel_arena_test
    JWT_SECRET: test-secret
    DISCORD_REDIRECT_URI: http://localhost:3001/api/auth/discord/callback
    ADMIN_DISCORD_IDS: admin
    FRONTEND_URL: http://localhost:5173
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '22'
        cache: 'npm'
        cache-dependency-path: backend/package-lock.json
    - run: npm ci
    - run: npx prisma migrate deploy
    - run: cp .env.test.example .env.test
    - run: npm run test:integration
```

## 6. 既知の制限と今後

### 現状カバー外

| 領域 | 内容 |
|---|---|
| フロントエンド統合 | `QueueWaitingPage`, `MatchPage` などのソケット連携 UI |
| OAuth フロー全体 | `/api/auth/discord/callback`（Discord API モックが必要） |
| Discord Bot 実環境 | テストギルドでの VC 生成・削除 |
| E2E | Playwright によるユーザーフロー全体 |
| 負荷・並行性 | 同時マッチング、tick の競合 |

### Phase 3 で追加予定

- Playwright E2E（ログイン～マッチング～結果）
- OAuth コールバックの fetch モック化
- フロントエンドの複雑コンポーネントテスト

## 7. テスト集計（プロジェクト全体）

| 種別 | ファイル数 | ケース数（目安） |
|---|---|---|
| 単体テスト | 21 | 約146 |
| 結合テスト | 14 | 約94 |
| **合計** | **35** | **約240** |

## 8. 注意点・運用Tips

### テストが落ちた時のデバッグ

1. **DB状態を確認**：`docker exec -it duel-arena-test-db psql -U test -d duel_arena_test`
2. **失敗テストのみ実行**：`npx vitest run -c vitest.integration.config.ts -t "テスト名の一部"`
3. **ログを増やす**：`testPrisma = new PrismaClient({ log: ['query'] })`

### よくあるトラブル

- **`relation "User" does not exist`**：マイグレーション未実行 → `npm run test:integration:setup`
- **`getaddrinfo ENOTFOUND` / `ECONNREFUSED`**：Docker未起動 → `docker compose -f docker-compose.test.yml up -d`
- **Socket.IOテストがタイムアウト**：前回テストの後始末漏れ → `singleFork: true` を確認

### 安全装置

`setup.ts` は `DATABASE_URL` に `test` が含まれていなければ起動時にエラーで止まります。**本番DBへの誤接続は構造的に不可能** な状態になっています。
