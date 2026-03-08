# Feed Pulse

RSS/Atom フィードを自動収集し、興味関心に基づいてスコアリング、LLM でコンテンツを生成し、X や WordPress へ配信するパイプライン。

```text
Crawl → Match → Generate → Publish
```

## 特徴

- **興味ベースのフィルタリング** — トピック×キーワードの重み付きスコアリングで関連記事を自動抽出
- **LLM コンテンツ生成** — Claude / GLM (Z.ai) 対応。チャンネルごとにペルソナ・文体・言語を設定可能
- **マルチチャンネル配信** — X (OAuth 1.0a) と WordPress (REST API) に対応
- **3 フェーズ設計** — Crawl+Match / Generate / Publish を分離。ドラフトを永続化し、レビュー後に配信
- **エージェントモード** — Claude tool-use による対話的操作
- **冪等性** — 処理済み URL を追跡し、重複生成を防止
- **Slack 通知** — Block Kit 形式で新着ドラフトを通知

## アーキテクチャ

```text
Phase 1: CRAWL + MATCH
  RssSource.fetch()          → FeedItem[]
  Matcher.match()            → ScoredItem[]
  StateStore.isProcessed()   → 重複除外
       ↓
Phase 2: GENERATE DRAFTS
  PromptBuilder + LLM        → Draft content
  DraftStore.save()          → 永続化
  SlackNotifier.notify()     → 通知
       ↓
Phase 3: PUBLISH
  PublisherPool.publish()    → PublishResult[]
  HistoryStore.save()        → 履歴記録
  DraftStore.delete()        → クリーンアップ (成功分のみ)
```

## セットアップ

### 前提条件

- Node.js 22+ (LTS)
- pnpm 10+

### インストール

```bash
pnpm install
```

### 環境変数

`.env` ファイルを作成:

```bash
# LLM (いずれか必須)
ANTHROPIC_API_KEY=sk-ant-...
# GLM_API_KEY=...
# GLM_API_URL=https://api.z.ai/api/coding/paas/v4/chat/completions

# モデル設定 (任意)
# CLAUDE_MODEL=claude-haiku-4-5-20251001
# GLM_MODEL=glm-4.7

# X (任意 — 4つ全て必要)
# X_API_KEY=...
# X_API_SECRET=...
# X_ACCESS_TOKEN=...
# X_ACCESS_SECRET=...

# WordPress (任意 — 3つ全て必要)
# WORDPRESS_API_URL=https://example.com/wp-json/wp/v2
# WORDPRESS_USER=admin
# WORDPRESS_APP_PASSWORD=xxxx-xxxx-xxxx

# Slack 通知 (任意)
# SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

| 変数                     | 必須       | 説明                                                      |
| ------------------------ | ---------- | --------------------------------------------------------- |
| `ANTHROPIC_API_KEY`      | \*いずれか | Claude API キー                                           |
| `GLM_API_KEY`            | \*いずれか | GLM (Z.ai) API キー                                       |
| `GLM_API_URL`            | 任意       | GLM エンドポイント                                        |
| `CLAUDE_MODEL`           | 任意       | Claude モデル名 (デフォルト: `claude-haiku-4-5-20251001`) |
| `GLM_MODEL`              | 任意       | GLM モデル名 (デフォルト: `glm-4.7`)                      |
| `X_API_KEY`              | 任意       | X API consumer key                                        |
| `X_API_SECRET`           | 任意       | X API consumer secret                                     |
| `X_ACCESS_TOKEN`         | 任意       | X アクセストークン                                        |
| `X_ACCESS_SECRET`        | 任意       | X アクセストークンシークレット                            |
| `WORDPRESS_API_URL`      | 任意       | WordPress REST API ベース URL                             |
| `WORDPRESS_USER`         | 任意       | WordPress ユーザー名                                      |
| `WORDPRESS_APP_PASSWORD` | 任意       | WordPress アプリパスワード                                |
| `SLACK_WEBHOOK_URL`      | 任意       | Slack Webhook URL                                         |

## 使い方

### CLI コマンド

```bash
# Phase 1+2: フィード取得 → マッチ → ドラフト生成
pnpm pipeline

# Phase 3: 全ドラフトを配信
pnpm publish:drafts

# Phase 3: 特定のドラフトだけ配信
pnpm publish:drafts <draft-id>

# エージェントモード (Claude tool-use)
pnpm agent "新しいアイテムをチェックしてドラフト生成して"
```

### バッチ運用 (cron)

```bash
# 毎日朝 8 時にフィード取得 + ドラフト生成
0 8 * * * cd /path/to/feed-pulse-ts && pnpm pipeline

# 毎日昼 12 時にドラフト配信
0 12 * * * cd /path/to/feed-pulse-ts && pnpm publish:drafts
```

GitHub Actions でスケジュール実行する場合:

```yaml
name: Feed Pipeline
on:
  schedule:
    - cron: "0 23 * * *" # UTC 23:00 = JST 08:00
  workflow_dispatch:

jobs:
  pipeline:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: lts/*
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm pipeline
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### エージェントモード

Claude の tool-use を使った対話的操作。以下の 4 ツールが利用可能:

| ツール            | 説明                                   |
| ----------------- | -------------------------------------- |
| `fetch_feeds`     | 全フィードを取得しマッチング結果を返す |
| `generate_drafts` | マッチしたアイテムからドラフトを生成   |
| `list_drafts`     | 保留中のドラフト一覧を表示             |
| `publish_drafts`  | 全ドラフトを配信                       |

```bash
pnpm agent "今日の注目記事を教えて"
pnpm agent "AIに関する記事だけドラフトを作って"
```

## 設定ファイル

### config/sources.yaml

RSS/Atom フィードソースの定義:

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

興味関心トピックの定義。`weight` はスコアリングの重み:

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

配信チャンネルの定義。`type` は `x` または `wordpress`:

```yaml
channel:
  name: "x"
  enabled: true
  type: "x"

  persona:
    tone: "casual"
    style: "concise"
    language: "ja"
    max_length: 280

  publish:
    max_per_day: 5
    status: "draft"
```

### プロンプトテンプレート

`prompts/` ディレクトリにテンプレートを配置。
`{{変数名}}` で値を埋め込み:

- **`voice.md`** — ペルソナ定義
  - 変数: `{{tone}}`, `{{style}}`, `{{language}}`, `{{max_length}}`
- **`sns-post.md`** — SNS 投稿用
  - 変数: `{{title}}`, `{{description}}`, `{{link}}`, `{{topics}}`
- **`blog-article.md`** — ブログ記事用
  - 変数: `{{title}}`, `{{description}}`, `{{link}}`, `{{topics}}`

## 開発

```bash
# 型チェック
pnpm typecheck

# リント
pnpm lint

# リント + 自動修正
pnpm lint:fix

# テスト
pnpm test

# テスト (watch モード)
pnpm test:watch

# テスト + カバレッジ
pnpm test:coverage

# ビルド
pnpm build
```

### プロジェクト構成

```text
feed-pulse-ts/
├── src/
│   ├── cli/                  # CLI エントリポイント
│   │   ├── pipeline.ts       #   Phase 1+2: Crawl → Match → Generate
│   │   ├── publish.ts        #   Phase 3: Publish
│   │   └── agent.ts          #   Claude tool-use エージェント
│   ├── config/
│   │   └── AppConfig.ts      # YAML 設定ローダー (Zod バリデーション)
│   ├── contracts/             # インターフェース定義
│   │   ├── LlmInterface.ts
│   │   ├── SourceInterface.ts
│   │   ├── MatcherInterface.ts
│   │   ├── PublisherInterface.ts
│   │   └── NotifierInterface.ts
│   ├── di/
│   │   └── Container.ts      # DI コンテナ (ファクトリベース)
│   ├── entities/              # Zod スキーマ + 型定義
│   │   ├── FeedItem.ts
│   │   ├── ScoredItem.ts
│   │   ├── Draft.ts
│   │   └── PublishResult.ts
│   ├── llm/
│   │   ├── ClaudeLlm.ts      # Anthropic SDK ラッパー
│   │   ├── GlmLlm.ts         # OpenAI 互換 GLM クライアント
│   │   └── PromptBuilder.ts  # テンプレート変数置換
│   ├── matchers/
│   │   └── Matcher.ts        # キーワードスコアリング
│   ├── notifiers/
│   │   ├── SlackNotifier.ts  # Block Kit Webhook
│   │   └── NullNotifier.ts   # No-op
│   ├── publishers/
│   │   ├── PublisherPool.ts  # チャンネルディスパッチ
│   │   ├── XPublisher.ts     # X API v2 (OAuth 1.0a)
│   │   └── WordPressPublisher.ts # WP REST API
│   └── stores/
│       ├── StateStore.ts     # 処理済み URL 追跡 (10K キャップ)
│       ├── DraftStore.ts     # ドラフト永続化
│       └── HistoryStore.ts   # 配信履歴 (日付別)
├── config/                    # 設定ファイル
│   ├── sources.yaml
│   ├── interests.yaml
│   └── channels/
│       ├── x.yaml
│       └── blog.yaml
├── prompts/                   # LLM プロンプトテンプレート
│   ├── voice.md
│   ├── sns-post.md
│   └── blog-article.md
└── state/                     # ランタイム状態 (gitignore)
    ├── processed.json
    ├── drafts/
    └── history/
```

### 技術スタック

| カテゴリ            | 技術                                             |
| ------------------- | ------------------------------------------------ |
| ランタイム          | Node.js 22+ (LTS)                                |
| 言語                | TypeScript 5.x (strict mode)                     |
| RSS パース          | rss-parser                                       |
| LLM                 | @anthropic-ai/sdk (Claude), OpenAI 互換 (GLM)    |
| 設定                | YAML + Zod v4 ランタイムバリデーション           |
| OAuth               | oauth-1.0a + crypto-js                           |
| テスト              | vitest + @vitest/coverage-v8                     |
| リンタ/フォーマッタ | Biome                                            |
| ログ                | pino (構造化 JSON)                               |
| CI                  | GitHub Actions (typecheck → lint → test → build) |
| 依存管理            | pnpm (pin 運用) + Renovate                       |

### セキュリティ

- パストラバーサル防止 — DraftStore / HistoryStore で `resolve()` + プレフィックスチェック
- 日付フォーマットバリデーション — HistoryStore のファイル名に正規表現チェック
- Slack mrkdwn エスケープ — `&`, `<`, `>` をエスケープしインジェクション防止
- テンプレートインジェクション防止 — 単一パス正規表現置換で再帰置換を排除
- クレデンシャル完全検証 — パブリッシャー登録時に全認証情報の存在を確認
- 外部 HTTP タイムアウト — 全 API 呼び出しに 30 秒の `AbortSignal.timeout`
- URL 数上限 — StateStore の processedUrls は 10,000 件でキャップ (FIFO)

## ライセンス

ISC
