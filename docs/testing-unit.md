# 単体テスト一覧

Vitest を使用した単体テスト。純粋関数・コンポーネント・状態管理など、外部依存なしで検証可能なものを対象としている。

## 実行方法

```powershell
# 全テスト
npm test

# バックエンドのみ
npm run test:backend

# フロントエンドのみ
npm run test:frontend

# 個別ファイル
cd backend && npx vitest run tests/elo-core.test.ts

# ウォッチモード
cd backend && npm run test:watch
```

## カバレッジ計測

```powershell
cd backend
npm run test:coverage

cd ../frontend
npm run test:coverage
```

`coverage/index.html` をブラウザで開いて確認。

---

## バックエンド（13ファイル / 約110ケース）

### `tests/auth-middleware.test.ts`
**対象**：`src/middleware/auth.ts` の認証ミドルウェア

| テストケース | 検証内容 |
|---|---|
| `getTokenFromRequest` Cookie | Cookieからトークンを抽出 |
| `getTokenFromRequest` Authorization | `Bearer xxx` ヘッダから抽出 |
| `getTokenFromRequest` 両方なし | null を返す |
| `requireAuth` トークンなし | 401 を返す |
| `requireAuth` 不正トークン | 401 を返す |
| `requireAuth` 有効トークン | `next()` を呼び、`req.auth` を設定 |
| `requireAdmin` 未認証 | 401 |
| `requireAdmin` 一般ユーザー | 403 |
| `requireAdmin` 管理者 | `next()` |

### `tests/connection-tracker.test.ts`
**対象**：`src/sockets/connection-tracker.ts`（複数タブブロック）

- 新規ユーザーの登録成功
- 同一ユーザーの別ソケット再登録ブロック
- 同一ソケット再登録の許容
- 異なるユーザーの並行登録
- unregister でのエントリ削除
- unregister 後の再登録
- 存在しないソケットの unregister は null
- userToSocket と socketToUser の整合性

### `tests/discord-oauth.test.ts`
**対象**：`src/services/discord-oauth.ts` のヘルパー

- `buildAvatarUrl`：avatar 設定時 / null時のフォールバック
- `getDisplayName`：global_name 優先、null時は username
- `buildAuthorizeUrl`：state, scope, response_type の含まれた URL
- `exchangeCode`：POST メソッド、リクエストボディ検証
- `exchangeCode`：エラーレスポンス時の throw
- `fetchDiscordUser`：Authorization ヘッダ付き GET

### `tests/elo-core.test.ts`
**対象**：`src/services/elo-core.ts`

| テストグループ | 検証内容 |
|---|---|
| `calculateExpectedScore` | 同レート=0.5、±400で約0.0909/0.9091 等 |
| `getKFactor` | 10試合未満=40、以降=32 |
| `calculateRatingDelta` | 同レート勝ち±16 / Provisional±20 / 格上勝ち+29 / 格下勝ち+3 等 |
| `calculateMatchRatingChange` | 勝者・敗者の前後値・delta、下限0、K値混在ケース |

### `tests/health.test.ts`
**対象**：`/api/health` エンドポイント（Supertestによる軽量HTTP統合）

- `200 OK` で `{status:'ok', service, timestamp}` を返す
- 未定義パスは 404

### `tests/jwt.test.ts`
**対象**：`src/lib/jwt.ts`

- `signJwt` / `verifyJwt` の往復
- 改ざんされたトークンは null
- 不正な文字列は null
- isAdmin=true の往復
- `isAdminDiscordId` の管理者判定

### `tests/match-report-core.test.ts`
**対象**：`src/services/match-report-core.ts`（勝敗登録の純粋判定）

- `decideReportOutcome`：
  - 既存なし → WAITING
  - 既存と新規が一致 → COMPLETED
  - 既存と新規が不一致 → DISPUTED
  - 「自分が負け」を両者報告（同一勝者）→ COMPLETED
  - 自分の重複報告 → WAITING（呼び出し元ガード）
- `canApprove`：
  - 報告なし → false
  - 他人の報告だけ → true
  - 自分の報告含む → false

### `tests/matchmaking-core.test.ts`
**対象**：`src/services/matchmaking-core.ts`

| テストグループ | 検証内容 |
|---|---|
| `computeRange` | 初期100、1分ごと+50、未来時刻は初期値 |
| `isExpired` | 5分以内/ちょうど/1ms超の境界 |
| `findMatch` | レート差判定、許容範囲拡張、ブロック判定、複数候補時の最近接選択、待機時間タイブレーク、星評価フィルタ |
| `findAllMatches` | 貪欲ペアリング、タイムアウト除外、古い順処理 |

### `tests/season-core.test.ts`
**対象**：`src/services/season-core.ts`

- `computeSeasonRange`：3ヶ月後の同日終了、時刻成分の正規化
- `determineTitle`：1位=王者 / 上位10% / 上位30% / 圏外 / 不正範囲

### `tests/star-rating-core.test.ts`
**対象**：`src/services/star-rating-core.ts`

- `isValidStar`：1〜5整数のみ、小数・範囲外は不可
- `recalculateAverage`：未評価→新規値、既存平均と新規値の重み付き平均、不正値は throw
- `isWithinStarThreshold`：未評価ペアは true、差≤1.5は true、差>1.5は false

### `tests/toss-core.test.ts`
**対象**：`src/services/toss-core.ts`

- `calculateTossPenalty`：1回目=-3 / 2回目=-10 / 3回目=-30 / 4回目以降=-50 / 0以下は throw
- `applyTossRatingChange`：加減算、下限0、境界値
- `TOSS_BONUS_FOR_RECEIVER`：定数=5

### `tests/user-service.test.ts`
**対象**：`src/services/user-service.ts`

- `toUserPublic`：公開フィールドのみ抽出、非公開（isBanned, consecutiveTossCount）が含まれない

### `tests/voice-channel-service.test.ts`
**対象**：`src/discord/voice-channel-service.ts`（discord.js モック使用）

- `createMatchVoiceChannel`：Bot未設定時に null を返す
- `createMatchVoiceChannel`：API例外時に null を返してマッチフローを止めない
- `deleteVoiceChannel`：Bot未設定で false（エラーにならない）
- `deleteVoiceChannel`：既に削除済み（code 10003）は true 扱い
- `deleteVoiceChannel`：チャンネル存在時に delete() を呼ぶ

---

## フロントエンド（8ファイル / 約36ケース）

### `tests/api-client.test.ts`
**対象**：`src/api/client.ts` の `apiFetch` ラッパー

- 成功時はパースしたJSONを返す
- `credentials: 'include'` が常に付与される
- bodyを渡すとJSON化＋Content-Typeが付く
- エラー時は `ApiError` を throw

### `tests/authStore.test.ts`
**対象**：`src/stores/authStore.ts`（Zustand）

- 初期状態（user=null, isAdmin=false, isLoading=true）
- `setAuth` でユーザー情報設定＋isLoading=false
- `clearAuth` で全クリア
- `setLoading` で個別更新

### `tests/Dashboard.test.tsx`
**対象**：`src/pages/Dashboard.tsx`

- user無しで何も描画しない
- ユーザー名・レート・勝敗・勝率の表示
- 管理者バッジの表示（isAdmin=trueのみ）
- 対戦未経験ユーザーは勝率 "-%" 表示

### `tests/Login.test.tsx`
**対象**：`src/pages/Login.tsx`

- タイトルが表示される
- Discordログインボタンが `/api/auth/discord` へリンクしている

### `tests/MatchHistory.test.tsx`
**対象**：`src/pages/MatchHistory.tsx`

- 履歴が空のとき "まだ試合履歴がありません" 表示
- 履歴があれば各エントリ（相手・結果・レート変動）表示
- 読み込み中表示

### `tests/match-formulas.test.ts`
**対象**：`src/lib/match-formulas.ts`

- `statusLabel`：全ステータスにラベル
- `resultLabel`：全結果にラベル
- `resultColorClass`：勝利系=緑、敗北系=赤、引き分け=グレー
- `formatDelta`：正の値に+、負はそのまま、0は "0"
- `formatDate`：nullは "-"、ISO文字列は日本語ロケール

### `tests/queue-formulas.test.ts`
**対象**：`src/lib/queue-formulas.ts`

- `computeRange`：初期値、1分/3分経過時
- `formatElapsed`：0秒、59秒、1分、5分30秒、負の値

### `tests/StarRatingInput.test.tsx`
**対象**：`src/components/StarRatingInput.tsx`

- 5つの星ボタンが描画される
- 星クリック時に onChange が値で呼ばれる
- disabled 時は onChange が呼ばれない

---

## カバレッジサマリ

| 領域 | カバー状況 |
|---|---|
| **純粋関数（コアロジック）** | ✅ Elo、マッチング、トス、勝敗判定、星評価、シーズン、JWT、OAuth helpers、フォーマッタ |
| **状態管理** | ✅ authStore |
| **ミドルウェア** | ✅ 認証 |
| **HTTPエンドポイント** | ⚠️ 部分的（health のみ） |
| **Reactコンポーネント** | ⚠️ 主要4ページ（Login, Dashboard, MatchHistory, StarRatingInput） |
| **Socket.IO** | ❌ 未カバー |
| **DB統合サービス** | ❌ 未カバー（結合テスト側で対応） |

---

## 開発時のテスト習慣

新しいロジックを追加するときの推奨手順：

1. **コアロジックを純粋関数として抽出**（`-core.ts` ファイル）
2. **`-core.test.ts` を先に書く**（TDD ライク）
3. **`-service.ts` でDB統合**（テストは結合テスト側へ）
4. **`-service` から呼ぶハンドラ・ルートは薄く保つ**

これにより：
- バグの95%は単体テストで検出可能
- 結合テスト（重い・遅い）が必要なのはDB連携部分のみに絞れる
