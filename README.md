# Feed Pulse

[![CI](https://github.com/h13/feed-pulse-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/h13/feed-pulse-ts/actions/workflows/ci.yml)

Automated RSS/Atom feed aggregation pipeline that scores articles by interest,
generates content with LLMs, and publishes to X and WordPress.

```text
Crawl → Match → Generate → Publish
```

## Features

- **Interest-based filtering** — Weighted keyword scoring across configurable topics
- **LLM content generation** — Claude and GLM (Z.ai) with
  per-channel persona settings
- **Multi-channel publishing** — X (OAuth 1.0a) and
  WordPress (REST API)
- **3-phase design** — Crawl+Match / Generate / Publish are
  separated; drafts persist for review before publishing
- **Agent mode** — Interactive operation via Claude tool-use
- **Idempotent** — Tracks processed URLs to prevent duplicate generation
- **Slack notifications** — Block Kit summaries for new drafts

## Architecture

```text
Phase 1: CRAWL + MATCH
  RssSource.fetch()          → FeedItem[]
  Matcher.match()            → ScoredItem[]
  StateStore.isProcessed()   → Deduplicate
       ↓
Phase 2: GENERATE DRAFTS
  PromptBuilder + LLM        → Draft content
  DraftStore.save()          → Persist
  SlackNotifier.notify()     → Notify
       ↓
Phase 3: PUBLISH
  PublisherPool.publish()    → PublishResult[]
  HistoryStore.save()        → Record history
  DraftStore.delete()        → Cleanup (successful only)
```

## Setup

### Prerequisites

- Node.js 22+ (LTS)
- pnpm 10+

### Install

```bash
pnpm install
```

### Environment Variables

Create a `.env` file:

```bash
# LLM (one required)
ANTHROPIC_API_KEY=sk-ant-...
# GLM_API_KEY=...
# GLM_API_URL=https://api.z.ai/api/coding/paas/v4/chat/completions

# Model override (optional)
# CLAUDE_MODEL=claude-haiku-4-5-20251001
# GLM_MODEL=glm-4.7

# X (optional — all 4 required together)
# X_API_KEY=...
# X_API_SECRET=...
# X_ACCESS_TOKEN=...
# X_ACCESS_SECRET=...

# WordPress (optional — all 3 required together)
# WORDPRESS_API_URL=https://example.com/wp-json/wp/v2
# WORDPRESS_USER=admin
# WORDPRESS_APP_PASSWORD=xxxx-xxxx-xxxx

# Slack notifications (optional)
# SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

**LLM** (one of these is required):

- `ANTHROPIC_API_KEY` — Claude API key
- `GLM_API_KEY` — GLM (Z.ai) API key
- `GLM_API_URL` — GLM endpoint (optional)
- `CLAUDE_MODEL` — Claude model name (optional,
  default: `claude-haiku-4-5-20251001`)
- `GLM_MODEL` — GLM model name (optional,
  default: `glm-4.7`)

**X** (optional — all 4 required together):

- `X_API_KEY` — Consumer key
- `X_API_SECRET` — Consumer secret
- `X_ACCESS_TOKEN` — Access token
- `X_ACCESS_SECRET` — Access token secret

**WordPress** (optional — all 3 required together):

- `WORDPRESS_API_URL` — REST API base URL
- `WORDPRESS_USER` — Username
- `WORDPRESS_APP_PASSWORD` — Application password

**Notifications** (optional):

- `SLACK_WEBHOOK_URL` — Slack incoming webhook URL

## Usage

### CLI Commands

```bash
# Phase 1+2: Fetch feeds → Match → Generate drafts
pnpm pipeline

# Phase 3: Publish all drafts
pnpm publish:drafts

# Phase 3: Publish a specific draft
pnpm publish:drafts <draft-id>

# Agent mode (Claude tool-use)
pnpm agent "Check for new items and generate drafts"
```

### Batch Operation (cron)

```bash
# Fetch feeds + generate drafts daily at 8 AM
0 8 * * * cd /path/to/feed-pulse-ts && pnpm pipeline

# Publish drafts daily at noon
0 12 * * * cd /path/to/feed-pulse-ts && pnpm publish:drafts
```

GitHub Actions scheduled workflow:

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

### Agent Mode

Interactive operation via Claude tool-use. Four tools are available:

| Tool              | Description                              |
| ----------------- | ---------------------------------------- |
| `fetch_feeds`     | Fetch all feeds and return matched items |
| `generate_drafts` | Generate drafts from matched items       |
| `list_drafts`     | List all pending drafts                  |
| `publish_drafts`  | Publish all pending drafts               |

```bash
pnpm agent "What are today's top articles?"
pnpm agent "Generate drafts for AI-related articles only"
```

## Configuration

### config/sources.yaml

RSS/Atom feed source definitions:

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

Interest topic definitions. `weight` controls scoring priority:

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

Publishing channel definitions. `type` is `x` or `wordpress`:

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

### Prompt Templates

Place templates in `prompts/`.
Variables are interpolated with `{{variable_name}}` syntax:

- **`voice.md`** — Persona definition
  - Variables: `{{tone}}`, `{{style}}`, `{{language}}`, `{{max_length}}`
- **`sns-post.md`** — SNS post template
  - Variables: `{{title}}`, `{{description}}`, `{{link}}`, `{{topics}}`
- **`blog-article.md`** — Blog article template
  - Variables: `{{title}}`, `{{description}}`, `{{link}}`, `{{topics}}`

## Development

```bash
pnpm typecheck    # Type checking
pnpm lint         # Lint
pnpm lint:fix     # Lint with auto-fix
pnpm test         # Run tests
pnpm test:watch   # Run tests in watch mode
pnpm test:coverage # Run tests with coverage
pnpm build        # Build
```

### Project Structure

```text
feed-pulse-ts/
├── src/
│   ├── cli/                  # CLI entry points
│   │   ├── pipeline.ts       #   Phase 1+2: Crawl → Match → Generate
│   │   ├── publish.ts        #   Phase 3: Publish
│   │   └── agent.ts          #   Claude tool-use agent
│   ├── config/
│   │   └── AppConfig.ts      # YAML config loader (Zod validation)
│   ├── contracts/             # Interface definitions
│   │   ├── LlmInterface.ts
│   │   ├── SourceInterface.ts
│   │   ├── MatcherInterface.ts
│   │   ├── PublisherInterface.ts
│   │   └── NotifierInterface.ts
│   ├── di/
│   │   └── Container.ts      # DI container (factory-based)
│   ├── entities/              # Zod schemas + type definitions
│   │   ├── FeedItem.ts
│   │   ├── ScoredItem.ts
│   │   ├── Draft.ts
│   │   └── PublishResult.ts
│   ├── llm/
│   │   ├── ClaudeLlm.ts      # Anthropic SDK wrapper
│   │   ├── GlmLlm.ts         # OpenAI-compatible GLM client
│   │   └── PromptBuilder.ts  # Template variable substitution
│   ├── matchers/
│   │   └── Matcher.ts        # Keyword scoring
│   ├── notifiers/
│   │   ├── SlackNotifier.ts  # Block Kit webhook
│   │   └── NullNotifier.ts   # No-op
│   ├── publishers/
│   │   ├── PublisherPool.ts  # Channel dispatch
│   │   ├── XPublisher.ts     # X API v2 (OAuth 1.0a)
│   │   └── WordPressPublisher.ts # WP REST API
│   └── stores/
│       ├── StateStore.ts     # Processed URL tracking (10K cap)
│       ├── DraftStore.ts     # Draft persistence
│       └── HistoryStore.ts   # Publish history (date-partitioned)
├── config/                    # Configuration files
│   ├── sources.yaml
│   ├── interests.yaml
│   └── channels/
│       ├── x.yaml
│       └── blog.yaml
├── prompts/                   # LLM prompt templates
│   ├── voice.md
│   ├── sns-post.md
│   └── blog-article.md
└── state/                     # Runtime state (gitignored)
    ├── processed.json
    ├── drafts/
    └── history/
```

### Tech Stack

- **Runtime:** Node.js 22+ (LTS)
- **Language:** TypeScript 5.x (strict mode)
- **RSS Parsing:** rss-parser
- **LLM:** @anthropic-ai/sdk (Claude), OpenAI-compat (GLM)
- **Config:** YAML + Zod v4 runtime validation
- **OAuth:** oauth-1.0a + crypto-js
- **Testing:** vitest + @vitest/coverage-v8
- **Linter/Formatter:** Biome
- **Logging:** pino (structured JSON)
- **CI:** GitHub Actions (typecheck → lint → test → build)
- **Dependencies:** pnpm (pinned) + Renovate

### Security

- **Path traversal prevention** — `resolve()` + prefix
  check in DraftStore / HistoryStore
- **Date format validation** — Regex check on HistoryStore
  filenames
- **Slack mrkdwn escaping** — `&`, `<`, `>` escaped to
  prevent injection
- **Template injection prevention** — Single-pass regex
  replacement
- **Credential validation** — All credentials required
  before registering publishers
- **HTTP timeouts** — 30s `AbortSignal.timeout` on all
  external API calls
- **URL cap** — processedUrls capped at 10,000 entries
  (FIFO eviction)

## License

ISC
