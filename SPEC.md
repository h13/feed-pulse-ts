# Feed-Pulse TypeScript 仕様書

## 概要

RSS/Atom フィードを自動収集し、ユーザーの興味に基づいてスコアリング、LLM でコンテンツを生成し、各チャンネルへ配信するパイプライン。

```text
Crawl → Match → Generate → Publish
```

---

## アーキテクチャ

```text
┌─────────────────────────────────────────────────────────┐
│ Phase 1: CRAWL + MATCH                                  │
│                                                         │
│ RssSource.fetch()          → FeedItem[]                 │
│ Matcher.match()            → ScoredItem[]               │
│ StateStore.isProcessed()   → 重複除外                    │
│ threshold (0.5) でフィルタ  → ScoredItem[] (新規のみ)     │
└────────────────────┬────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────┐
│ Phase 2: GENERATE DRAFTS                                │
│                                                         │
│ ChannelConfig.loadEnabled()         → Channel[]         │
│ 各チャンネルごと max_per_day まで:                        │
│   PromptBuilder.buildSystemPrompt() → system prompt     │
│   PromptBuilder.buildUserPrompt()   → user prompt       │
│   LlmInterface.generate()           → draft content     │
│   DraftStore.save()                 → 永続化             │
│ StateStore.markProcessed()          → 処理済み記録        │
│ SlackNotifier.notify()              → 通知               │
└────────────────────┬────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────┐
│ Phase 3: PUBLISH                                        │
│                                                         │
│ DraftStore.loadAll()               → Draft[]            │
│ PublisherPool.publish()            → PublishResult[]     │
│ HistoryStore.save()                → 履歴記録            │
│ DraftStore.delete()                → クリーンアップ       │
└─────────────────────────────────────────────────────────┘
```

**設計原則:**

- **冪等性:** StateStore で同一 URL の再処理を防止
- **再開可能:** ドラフトは publish 前に永続化、リトライ可能
- **レート制限:** チャンネルごとの `max_per_day` で生成数を制御

---

## エンティティ定義

### FeedItem

RSS/Atom フィードから取得した生エントリ。

```typescript
interface FeedItem {
  title: string;
  link: string;
  description: string; // HTML タグ除去済み
  pubDate: string; // ISO 8601
  source: string; // config の source name
  category: string; // config の category
}
```

### ScoredItem

スコアリング済みフィードアイテム。

```typescript
interface ScoredItem {
  feed: FeedItem;
  score: number; // マッチしたキーワードの weight 合計
  matchedTopics: string[]; // マッチしたトピック名一覧
}
```

### Draft

LLM 生成コンテンツ（レビュー / 配信待ち）。

```typescript
interface Draft {
  id: string; // "{channel}-{slug}" (先頭60文字)
  channel: string; // チャンネル名
  content: string; // LLM 生成コンテンツ
  item: ScoredItem; // ソースフィードアイテム
  createdAt: string; // ISO 8601
}
```

### PublishResult

配信結果。

```typescript
interface PublishResult {
  channel: string;
  title: string;
  url: string | null; // 成功時の URL
  error: string | null; // エラー時のメッセージ
  publishedAt: string; // ISO 8601
}
```

---

## 設定ファイル

### config/sources.yaml

```yaml
sources:
  - name: "Hacker News (Best)"
    url: "https://hnrss.org/best"
    category: "tech"

  - name: "TechCrunch"
    url: "https://techcrunch.com/feed/"
    category: "tech"
```

### config/interests.yaml

```yaml
interests:
  - topic: "AI & LLM"
    keywords:
      - "artificial intelligence"
      - "large language model"
      - "Claude"
      - "GPT"
    weight: 1.0

  - topic: "Software Engineering"
    keywords:
      - "TypeScript"
      - "Rust"
      - "DevOps"
    weight: 0.8
```

### config/channels/{name}.yaml

```yaml
channel:
  name: "x"
  enabled: true
  type: "x" # x | wordpress

  persona:
    tone: "casual"
    style: "concise"
    language: "ja"
    max_length: 280

  publish:
    max_per_day: 5
    status: "draft" # wordpress 用: draft | publish
```

---

## 環境変数

| 変数                     | 必須       | 説明                                 |
| ------------------------ | ---------- | ------------------------------------ |
| `ANTHROPIC_API_KEY`      | \*いずれか | Claude API キー                      |
| `GLM_API_KEY`            | \*いずれか | GLM (Z.ai) API キー                  |
| `GLM_API_URL`            | 任意       | GLM エンドポイント（デフォルトあり） |
| `SLACK_WEBHOOK_URL`      | 任意       | Slack 通知 Webhook                   |
| `X_API_KEY`              | 任意       | X API consumer key                   |
| `X_API_SECRET`           | 任意       | X API consumer secret                |
| `X_ACCESS_TOKEN`         | 任意       | X アクセストークン                   |
| `X_ACCESS_SECRET`        | 任意       | X アクセストークンシークレット       |
| `WORDPRESS_API_URL`      | 任意       | WordPress REST API ベース URL        |
| `WORDPRESS_USER`         | 任意       | WordPress ユーザー名                 |
| `WORDPRESS_APP_PASSWORD` | 任意       | WordPress アプリパスワード           |

`ANTHROPIC_API_KEY` または `GLM_API_KEY` のいずれかが必須。

---

## CLI コマンド

### pipeline

フィード取得 → マッチ → ドラフト生成を実行。

```bash
npx tsx bin/pipeline.ts
```

### publish

保存済みドラフトを配信。

```bash
npx tsx bin/publish.ts [draftId]
```

引数なしで全ドラフト配信、`draftId` 指定で個別配信。

### agent

Claude tool-use エージェントでインタラクティブ操作。

```bash
npx tsx bin/agent.ts "新しいアイテムをチェックしてドラフト生成して"
```

---

## LLM プロバイダ

### Claude (Anthropic)

```typescript
// POST https://api.anthropic.com/v1/messages
{
  model: "claude-haiku-4-5-20251001",
  max_tokens: 1024,
  system: systemPrompt,
  messages: [{ role: "user", content: userPrompt }]
}
```

### GLM (Z.ai / OpenAI 互換)

```typescript
// POST https://api.z.ai/api/coding/paas/v4/chat/completions
{
  model: "glm-4.7",
  max_tokens: 8192,   // reasoning model のため大きめに
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ]
}
```

### プロンプトテンプレート

- `prompts/voice.md` — 文体・ペルソナ定義
- `prompts/sns-post.md` — SNS 投稿用テンプレート
- `prompts/blog-article.md` — ブログ記事用テンプレート
- `prompts/examples/*.md` — 出力例

テンプレート変数: `{{title}}`, `{{description}}`, `{{link}}`, `{{topics}}`

---

## パブリッシャ

### XPublisher

X (Twitter) API v2 に OAuth 1.0a で投稿。

- エンドポイント: `POST https://api.x.com/2/tweets`
- 投稿 URL: `https://x.com/i/status/{tweet_id}`

### WordPressPublisher

WordPress REST API に Basic Auth で投稿。

- エンドポイント: `POST {WORDPRESS_API_URL}/posts`
- 認証: `Authorization: Basic base64(user:appPassword)`

### PublisherPool

チャンネル名から適切な Publisher にディスパッチ。

---

## 状態管理

### StateStore (`state/processed.json`)

処理済み URL の追跡。重複処理を防止。

```json
{
  "processedUrls": ["https://example.com/article-1"],
  "lastRun": "2026-03-08T08:34:11+00:00"
}
```

### DraftStore (`state/drafts/{id}.json`)

ドラフトを個別 JSON ファイルとして永続化。

### HistoryStore (`state/history/{YYYY-MM-DD}.json`)

配信結果を日付別に記録。成功・失敗両方を保持。

---

## 通知

### Slack Notifier

Webhook URL に Block Kit 形式で通知。

- ドラフト数サマリ
- 各ドラフトのタイトル・チャンネル・トピック・プレビュー
- 「Publish All」「Review Drafts」ボタン

---

## マッチングロジック

1. `title + description` を小文字化
2. 各トピックのキーワードを順に部分文字列検索
3. 最初にマッチしたキーワードでそのトピックの weight を加算（重複カウントなし）
4. 全トピック合計スコアが threshold (デフォルト 0.5) 以上のアイテムを採用
5. スコア降順でソート

---

## プロジェクト構成

```text
feed-pulse-ts/
├── src/
│   ├── cli/
│   │   ├── pipeline.ts
│   │   ├── publish.ts
│   │   └── agent.ts
│   ├── entities/
│   │   ├── FeedItem.ts
│   │   ├── ScoredItem.ts
│   │   ├── Draft.ts
│   │   └── PublishResult.ts
│   ├── contracts/
│   │   ├── LlmInterface.ts
│   │   ├── SourceInterface.ts
│   │   ├── MatcherInterface.ts
│   │   ├── PublisherInterface.ts
│   │   └── NotifierInterface.ts
│   ├── sources/
│   │   └── RssSource.ts
│   ├── matchers/
│   │   └── Matcher.ts
│   ├── llm/
│   │   ├── ClaudeLlm.ts
│   │   ├── GlmLlm.ts
│   │   ├── LlmHttpClient.ts
│   │   └── PromptBuilder.ts
│   ├── publishers/
│   │   ├── PublisherPool.ts
│   │   ├── XPublisher.ts
│   │   └── WordPressPublisher.ts
│   ├── notifiers/
│   │   ├── SlackNotifier.ts
│   │   └── NullNotifier.ts
│   ├── stores/
│   │   ├── StateStore.ts
│   │   ├── DraftStore.ts
│   │   └── HistoryStore.ts
│   ├── config/
│   │   └── AppConfig.ts
│   └── di/
│       └── Container.ts
├── config/
│   ├── sources.yaml
│   ├── interests.yaml
│   └── channels/
│       ├── x.yaml
│       └── blog.yaml
├── prompts/
│   ├── voice.md
│   ├── sns-post.md
│   ├── blog-article.md
│   └── examples/
├── state/
│   ├── processed.json
│   ├── drafts/
│   └── history/
├── .env
├── package.json
├── tsconfig.json
└── SPEC.md
```

---

## PHP 版からの改善点

- **JS レンダリング対応:** Playwright で SPA サイトのコンテンツ取得が可能
- **Anthropic SDK:** 公式 `@anthropic-ai/sdk` で型安全な API 呼び出し
- **Zod バリデーション:** ランタイム型検証で設定ファイルの整合性を保証
- **並列処理:** `Promise.all` による複数フィードの並行取得
- **構造化ログ:** pino 等による JSON ログ出力
- **フレームワーク不要:** BEAR.Sunday / Be Framework の DI オーバーヘッドを排除
- **テスト容易性:** vitest でシンプルなユニット・統合テスト

## 技術スタック

- **ランタイム:** Node.js 22+
- **言語:** TypeScript 5.x (strict mode)
- **RSS パース:** rss-parser
- **HTTP:** node-fetch / undici
- **LLM:** @anthropic-ai/sdk (Claude), OpenAI 互換クライアント (GLM)
- **設定:** yaml + zod
- **テスト:** vitest
- **ログ:** pino
- **リンタ:** biome
