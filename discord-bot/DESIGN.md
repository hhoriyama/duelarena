# デュエルアリーナ Bot版 設計書（v0.1 たたき台）

## 0. この文書について

既存の「デュエルアリーナ」は **Discord OAuthでログインするReact Webアプリ本体 + Bot(VC生成のみ)** という構成だった。
本文書は、そのアプローチを変え、**Discord Bot自体をユーザーインターフェースにする** 新プロジェクトの設計たたき台である。

方針（ヒロキと確認済み）:

- **構成**: Botが「エントリー周りの画面」の代わりになる。マッチングや勝敗計算などのロジックは **既存のバックエンドAPIを実行する** イメージ。
- **技術**: 既存踏襲（Node.js + TypeScript + discord.js + Prisma + PostgreSQL）。
- **スコープ**: まず **コアMVP**（マッチング → トス → 勝敗登録 → Eloレーティング）。通報・星評価・シーズン・管理画面は後続フェーズ。

---

## 1. コンセプトの転換

| 観点 | 旧（Webアプリ版） | 新（Bot版） |
|---|---|---|
| ユーザー接点 | ブラウザ（React SPA） | Discord内のスラッシュコマンド・ボタン・モーダル |
| ログイン | Discord OAuth 2.0 + JWT Cookie | **不要**。Discordユーザー＝そのままプレイヤー（Interactionに発行元IDが入る） |
| リアルタイム | Socket.IO → ブラウザにpush | Botがイベントを受けてDiscordメッセージ/DMをpush |
| 「画面」の実体 | React の各ページ | Discordの Embed + Button + Modal |
| バックエンド | Express API + ロジック | **ほぼそのまま再利用**（認証層とマッチング起動だけ差し替え） |

一言でいうと **「フロントエンド(React)をDiscord Botに置き換え、バックエンドは活かす」**。

---

## 2. 全体アーキテクチャ

```
┌────────────────────────────┐        ┌──────────────────────────────────────┐
│         Discord            │        │            Backend (既存流用)           │
│  ・スラッシュコマンド         │        │                                        │
│  ・ボタン / モーダル          │  HTTP  │  Express REST API                      │
│  ・DM / チャンネル通知        │◀──────▶│   /api/bot/*  (Bot専用の薄い層)         │
└───────────▲────────────────┘  (2)   │        │                               │
            │                          │        ▼                               │
            │ discord.js               │   services / *-core.ts                 │
            │ (Gateway)                │   （Elo・matchmaking・toss・report）     │
            │                          │        │                               │
┌───────────┴────────────────┐        │        ▼                               │
│      Discord Bot (新規)     │        │   Prisma → PostgreSQL                  │
│  ・Interaction ハンドラ      │        │                                        │
│  ・API クライアント          │        │   Matchmaker Loop（サーバー常駐）        │
│  ・通知ディスパッチャ         │◀──────▶│   match:found 等のイベント発火          │
└────────────────────────────┘  (3)   └──────────────────────────────────────┘
                              イベント通知
```

- **(2) Bot → API**：ユーザー操作（キュー参加、トス、勝敗報告など）を REST で叩く。
- **(3) API → Bot**：マッチ成立や相手のトスなど、サーバー起点のイベントをBotに届ける（後述の §5）。

### 責務分担

| レイヤ | 責務 | 既存からの扱い |
|---|---|---|
| Bot（新規 `discord-bot/`） | Discord Interaction受付、Embed/Button/Modal生成、通知配信、APIクライアント | 新規作成 |
| REST API `/api/bot/*`（新規） | Bot認証、DiscordID→ユーザー解決、既存serviceの呼び出し | 新規。**既存serviceを直接ラップ**（下記注意） |
| services / *-core.ts | Elo計算、マッチング、トス、勝敗承認などの純ロジック | **そのまま再利用** |
| Prisma / DB | 永続化 | **そのまま再利用**（スキーマ微調整のみ） |
| Matchmaker Loop | キューを定期評価しマッチを成立させる | **Socket層から切り離して常駐化**（§4） |

---

## 3. 認証設計（OAuthを廃止する）

Web版は「OAuthでログイン → JWTをCookie保存 → 各APIで検証」だった。Botではこれが不要になる。

- Discordの Interaction には必ず **発行したユーザーのDiscord ID** が含まれる。Botはそれを信頼できる。
- したがって **エンドユーザー向けOAuthは廃止**。ユーザーは何もログインせず、コマンドを打った瞬間にプレイヤーとして扱われる。
- 初回コマンド時に `users` テーブルへ自動 upsert（Discord ID・username・avatarをInteractionから取得）。

### Bot ↔ API 間の認証

Bot と Backend の間だけ守ればよい。二段構え:

1. **サービストークン**：`BOT_API_SECRET`（共有シークレット）を `Authorization: Bearer <secret>` で全リクエストに付与。API側は専用ミドルウェア `requireBotAuth` で検証。
2. **代理ユーザー指定**：どのDiscordユーザーの操作かを `X-Discord-Id` ヘッダ（またはbody）で渡す。API側で `users` に解決し、以降は既存の userId ベースのロジックにそのまま流す。

```
POST /api/bot/queue/enter
Authorization: Bearer <BOT_API_SECRET>
X-Discord-Id: 123456789012345678
```

- 管理者判定は既存どおり `ADMIN_DISCORD_IDS` を使う（`X-Discord-Id` がこの中にあれば admin）。
- 既存のOAuthルート（`/api/auth/*`）とCookie/JWTは、Web管理画面を残す場合のみ温存。MVPでは呼ばれないだけで削除は任意。

> セキュリティ注記：`BOT_API_SECRET` を知っているのはBotだけ。API を公開ネットワークに置くなら、`X-Discord-Id` を詐称されない前提が崩れないよう、この層のシークレット管理が生命線になる。

---

## 4. マッチングの結合を切り離す（最重要の設計変更）

### 現状の問題

既存のマッチングは **Socket.IO（＝ブラウザのタブ接続）に強く結合** している:

- `queue_entries` が `socket_id` を持つ
- ソケット切断でキューから自動離脱
- 複数タブブロック
- マッチング評価の tick ループが `sockets/queue.ts`（接続前提）にある

Botには「タブ」も「常時ソケット」も無い。ユーザーはコマンドを打ったら離れる。この前提のズレを解消する。

### 新設計：常駐 Matchmaker Loop

- キューを **socket非依存** にする。`queue_entries` から `socket_id` を廃止し、代わりに `source`（`WEB` / `DISCORD`）や `channel_id`（結果を返すDiscordチャンネル）を持たせる。
- マッチング評価ループを **サーバープロセス常駐のワーカー** として切り出す（`services/matchmaker-loop.ts`）。Socket接続の有無と無関係に、一定間隔でキューを評価しマッチを成立させる。
- 「複数タブブロック」は不要。代わりに **同一ユーザーの二重キュー禁止** は既存の `queue_entries.userId @unique` で担保。
- キュー離脱は明示コマンド `/leave` か、既存の **5分タイムアウト** で行う（切断による離脱は無くなる）。

### プレゼンス（在席）の考え方

Web版は「ソケット接続＝在席」だった。Botでは在席概念を弱める:

- MVPでは **タイムアウトのみ** で在席管理（5分で自動離脱）。
- 将来的に強めたければ、Discordのボイスチャンネル在室やボタン「まだ待機中？」の応答で延命する、といった拡張が可能。

---

## 5. サーバー起点イベントをBotへ届ける

「マッチが成立した」「相手がトスした」など、ユーザー操作を起点としないイベントを、どうやってDiscordにpushするか。Web版のSocket.IO push に相当する部分。

MVPの推奨は **(A) BotをSocket.IOクライアントとして1本だけ常時接続** する方式（既存のSocket.IO資産をそのまま活かせる）:

- Botプロセスが `socket.io-client` でBackendに1接続だけ張る（Bot専用の system 接続）。
- Backend はマッチ成立などのイベントを、その接続へ `bot:match-found` のような形で emit。ペイロードに両プレイヤーのDiscord ID と通知先 channel_id を含める。
- Bot は受信して該当ユーザーにDM or 指定チャンネルへ Embed+Button を送る。

代替案:

- **(B) Backend → Bot への内向き Webhook**：Botが小さなHTTP受信エンドポイントを持ち、BackendがイベントをそこにPOST。Socket.IOを完全に捨てられるが受信サーバーをBot側に立てる必要あり。
- **(C) ポーリング**：Botが定期的に「未通知イベント」をAPIから引く。最も単純だが遅延とコストが出る。MVPの繋ぎとしてはアリ。

> 推奨：既存のSocket.IO層が既にイベントを出しているので、**(A)** が改修最小。将来Socketを外したくなったら(B)へ移行。

---

## 6. Discord UI 設計（画面→コマンド/ボタン/モーダルの対応）

Web版の「画面」を Discord の構成要素に写像する。

### スラッシュコマンド

| コマンド | 相当するWeb画面 | 動作 |
|---|---|---|
| `/queue` | 「対戦相手を見つける」ボタン | キュー参加。`POST /api/bot/queue/enter`。待機Embedを返信 |
| `/leave` | キューキャンセル | `POST /api/bot/queue/leave` |
| `/status` | マッチング待機画面 | 現在のキュー状態・許容レート差・待機時間 |
| `/profile [user]` | プロフィール画面 | レート・戦績・星評価。自分or他人 |
| `/history` | 試合履歴画面 | 直近の試合をEmbedリストで |
| `/report` | （管理外の）ヘルプ的な起点 | 現在進行中の自分の試合に対する操作を再表示 |

（`/rank` リーダーボードや通報・星評価は後続フェーズ）

### ボタン付きメッセージ（Interaction Components）

マッチ成立時、両プレイヤーにDM（or 専用チャンネル）で Embed を送り、下にボタンを付ける:

- **マッチ成立**：相手のusername/レート/戦績のEmbed ＋ `[✅ 承認]` `[🎲 トス]` ボタン
  - `承認` → `POST /api/bot/matches/:id/accept`
  - `トス` → `POST /api/bot/matches/:id/toss`
- **両者承認 → 対戦開始**：`[🏆 勝ったと報告]` `[🏳️ 負けたと報告]`（勝者が報告するフロー） ＋ VC自動生成の案内
- **相手から勝敗報告**：`[✅ 承認]` `[❌ 異議あり]` ボタン → `approve` / `reject`
- 結果確定：レート変動 `+16 / -16` などをEmbedで通知

### モーダル

- **異議申し立て（reject）時**：理由入力の Modal（自由記述）。証拠添付はMVP範囲外（後続でファイル添付/URL）。
- 通報カテゴリ選択などもModal/SelectMenuで後続実装。

### 通知の宛先

- 個人宛（マッチ成立、報告依頼）→ **DM** を第一候補、DM拒否ユーザー向けに **指定した対戦通知チャンネル** をフォールバック。
- VC自動生成は既存 `voice-channel-service.ts` をそのまま利用。

---

## 7. コアMVPのユーザーフロー

```
ヒロキが /queue を実行
   │  Bot → POST /api/bot/queue/enter (X-Discord-Id)
   │  ← 「待機中（許容レート差 ±100）」Embed を ephemeral 返信
   ▼
Matchmaker Loop が相手を発見
   │  Backend → (Socket) bot:match-found {matchId, p1Discord, p2Discord}
   ▼
Bot が両者にDMで「マッチ成立」Embed + [承認][トス]
   │
   ├─ 両者[承認] → POST accept ×2 → status=IN_PROGRESS
   │     Bot: VC自動生成を案内、[勝ち報告][負け報告] を表示
   │
   └─ 片方[トス]  → POST toss → 試合終了、トスペナルティ/受諾ポイント適用（既存toss-core）
   ▼
対戦（実際の勝負はDiscord上/VCで）
   ▼
勝者が [勝ったと報告] → POST report → status=WAITING_APPROVAL
   │  Bot が敗者に [承認][異議] を送信
   │
   ├─ 敗者[承認]（or 5分自動承認） → Elo計算(elo-core) → status=COMPLETED
   │     Bot: 双方にレート変動 Embed
   │
   └─ 敗者[異議]  → status=DISPUTED（MVPでは「管理者裁定待ち」表示のみ）
   ▼
40分無報告 → 引き分け処理（レート変動なし・試合無効化）※既存の match timeout loop 流用
```

MVPで再利用する既存ロジック：`matchmaking-core` / `toss-core` / `match-report-core` / `elo-core`、および match timeout loop。

> **重要な実装上の注意（コード確認済み）**：`accept` / `toss` / `report` / `approve` は **現状REST APIとして存在せず、Socket.IOハンドラ（`match:accept` / `match:toss` / `match:report`）としてのみ実装**されている。中身は `toss-service`（`acceptMatch` / `tossMatch`）と `match-report-service`（`reportWin` など）を呼んでいる。
> したがって Bot用の `/api/bot/matches/:id/accept` などは「既存ルートの薄いラッパ」ではなく、**これらのサービス関数を直接呼ぶ新規RESTエンドポイント**として起こす必要がある。ロジック本体は再利用できるので、書くのは認証＋ユーザー解決＋service呼び出しの薄い層だけで済む。同様に `match:found` は現状 `io.to(socketId)` で特定ソケットに配信しており（socket結合の実例）、§4・§5の作り替え対象。

---

## 8. データモデルの変更点

既存スキーマ（§4 of specification.md）をほぼ流用。変更は最小限:

- **`queue_entries`**：`socket_id`（string）を廃止 →
  - `source` (enum: `WEB` / `DISCORD`) を追加
  - `channelId` (string, nullable) を追加（結果通知先）
- **`matches`**：`notifyChannelId`（string, nullable）を追加してもよい（通知先の記録）。
- `users` はそのまま（`discordId @unique` が既にBotの主キー的役割を果たす）。
- 通報 `reports` / `star_ratings` / `disputes` / シーズン系テーブルは **MVPでは触らない**（後続フェーズで有効化）。

> マイグレーションは `socket_id` 廃止の1本で足りる見込み。

---

## 9. ディレクトリ構成（案）

既存リポジトリに `discord-bot/` を追加し、`frontend/` はMVPでは非使用（残置 or 別途 archive）:

```
duelarena/
├── backend/                  # 既存。以下を追加/改修
│   ├── src/
│   │   ├── routes/bot.ts     # 新規: /api/bot/* の薄いルータ
│   │   ├── middleware/bot-auth.ts   # 新規: requireBotAuth
│   │   ├── services/
│   │   │   ├── matchmaker-loop.ts   # 新規: socket非依存の常駐ループ
│   │   │   └── (既存 *-core.ts はそのまま)
│   │   └── sockets/          # bot向けイベント配信を追加（(A)採用時）
│   └── prisma/               # socket_id廃止のマイグレーション
├── discord-bot/              # 新規プロジェクト
│   ├── src/
│   │   ├── index.ts          # Bot起動・login
│   │   ├── commands/         # /queue /leave /status /profile /history
│   │   ├── interactions/     # ボタン・モーダルのハンドラ
│   │   ├── api/              # Backend APIクライアント（BOT_API_SECRET付与）
│   │   ├── notifications/    # サーバーイベント→DM/チャンネル配信
│   │   ├── embeds/           # Embed/Componentビルダ
│   │   └── config/env.ts
│   ├── package.json
│   └── tsconfig.json
├── shared/                   # 型・定数（既存流用、Bot/Backendで共有）
└── discord-bot/DESIGN.md     # 本文書
```

Bot と Backend を分けるか一体化するかは選べる:

- **分離（推奨）**：Botは別プロセス。スケール・再起動が独立。今回のディレクトリ案はこれ。
- **一体**：既存Backendプロセス内でBotも起動（既存 `discord/bot.ts` を拡張）。運用は楽だが密結合。

---

## 10. 環境変数（Bot側）

```
# discord-bot/.env
DISCORD_BOT_TOKEN=          # Bot Token
DISCORD_APP_ID=             # スラッシュコマンド登録用 Application ID
DISCORD_GUILD_ID=           # コマンド登録先ギルド（開発中はギルド即時反映）
BACKEND_BASE_URL=http://localhost:3001
BOT_API_SECRET=             # Backendと共有するサービストークン
DISCORD_VOICE_CATEGORY_ID=  # VC生成先（既存）
MATCH_NOTIFY_CHANNEL_ID=    # DM不可時のフォールバック通知チャンネル
```

Backend側に追加:

```
BOT_API_SECRET=             # 上と同じ値
ADMIN_DISCORD_IDS=...       # 既存流用
```

---

## 11. 開発ロードマップ

| フェーズ | 内容 |
|---|---|
| ① 設計確定 | 本文書レビュー・確定 |
| ② Backend改修 | `requireBotAuth`、`/api/bot/*` ルータ、`queue_entries` の socket_id 廃止マイグレーション、`matchmaker-loop` 常駐化 |
| ③ Bot雛形 | `discord-bot/` 初期化、login、スラッシュコマンド登録の仕組み |
| ④ コアMVP | `/queue`・`/leave`・`/status`、マッチ成立DM、承認/トスボタン、勝敗報告→承認→Elo反映 |
| ⑤ 通知経路 | サーバーイベント→Bot配信（方式Aで実装）＋VC自動生成連携 |
| ⑥ テスト | 既存 `*-core.ts` のVitestは維持。Bot層はAPIクライアントとInteractionハンドラをユニットテスト |
| ⑦ 後続機能 | 通報・星評価・シーズン・リーダーボード・管理（Web or Botコマンド） |

---

## 12. 決めておきたい論点（レビューで確認したいこと）

1. **通知先**：マッチ成立などは DM 中心でよいか？それとも専用チャンネル中心か（DMはブロックされがち）。
2. **Bot構成**：Backendと別プロセス（推奨）か、既存Backend一体型か。
3. **イベント配信方式**：§5の (A) Socket常時接続 / (B) Webhook / (C) ポーリング のどれで進めるか（推奨A）。
4. **Web管理画面**：MVP時点で紛争裁定など管理をどうするか（Botコマンドで簡易対応 / 既存Web管理を温存 / 後回し）。
5. **VC自動生成**：MVPに含めるか、まず報告フローだけ通して後で足すか。
6. **コマンド公開範囲**：応答は基本 ephemeral（本人だけ見える）でよいか。

---

*このv0.1はたたき台です。§12の論点に回答をもらえれば、確定版の設計と、フェーズ②の具体的な実装計画（差分ベース）に落とし込みます。*
