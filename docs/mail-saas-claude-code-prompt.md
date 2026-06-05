# メール自動分類SaaS - プロジェクト仕様書

## プロジェクト概要

SES企業（社員30名規模）向けのメール自動分類・検索SaaSを構築する。
受信メールをAIで自動分類・構造化し、複数ユーザーが効率よく検索・閲覧できるWebアプリケーション。
最終的には他社へのSaaSとして販売することを見据えた設計にする。

---

## 技術スタック

| 層 | 採用技術 | 理由 |
|----|---------|------|
| フロントエンド | Next.js 14 (App Router) + TypeScript | 同一言語でフルスタック開発 |
| バックエンド | Next.js API Routes | フロントと統一 |
| データベース | Supabase (PostgreSQL) | 認証・DB・ストレージ一体型 |
| メール受信 | SendGrid Inbound Parse | Webhookで簡単受信 |
| AI分類 | Anthropic Claude API (claude-sonnet-4-20250514) | 日本語メール分類精度が高い |
| 認証 | Supabase Auth | マルチテナント対応 |
| デプロイ | Vercel | git pushで自動デプロイ |
| 課金 | Stripe | SaaS課金管理 |
| スタイリング | Tailwind CSS | 開発速度優先 |

---

## システムアーキテクチャ

```
顧客のメールサーバー（Exchange / Gmail 等）
    ↓ MXレコード or 転送設定
SendGrid Inbound Parse
    ↓ Webhook POST
Next.js API Route (/api/mail/receive)
    ↓ メール本文抽出
Claude API（分類・構造化）
    ↓ JSON レスポンス
Supabase（PostgreSQL）
    ↓
Next.js フロントエンド（検索・閲覧UI）
    ↓
Stripe（月額課金）
```

---

## データベース設計

### テナント管理（マルチテナント対応）

```sql
-- テナント（会社）管理
create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text unique,
  plan text default 'free', -- free / standard / enterprise
  email_limit integer default 500,
  created_at timestamptz default now(),
  stripe_customer_id text
);

-- ユーザー（Supabase Auth と連携）
create table profiles (
  id uuid primary key references auth.users(id),
  tenant_id uuid references tenants(id),
  name text,
  role text default 'member', -- admin / member
  created_at timestamptz default now()
);

-- メールデータ
create table mails (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) not null,
  message_id text unique, -- 重複排除用
  subject text,
  sender text,
  sender_name text,
  received_at timestamptz,
  body_text text,
  body_summary text, -- AIが生成した要約
  category text, -- 人材関連 / 案件・プロジェクト / アンケート / 営業・受注 / その他
  priority text, -- 高 / 中 / 低
  related_people text[], -- 抽出した関連人物
  action_required boolean default false,
  status text default '未処理', -- 未処理 / 処理中 / 完了
  tags text[],
  ai_raw_response jsonb, -- Claude の生レスポンス保存
  created_at timestamptz default now()
);

-- RLS (Row Level Security) 設定
alter table mails enable row level security;

create policy "テナントごとにデータ分離" on mails
  using (tenant_id = (
    select tenant_id from profiles where id = auth.uid()
  ));

-- 添付ファイル管理（Phase 2 で実装）
create table attachments (
  id uuid primary key default gen_random_uuid(),
  mail_id uuid references mails(id),
  tenant_id uuid references tenants(id),
  file_name text,
  file_type text,         -- excel / pdf / word / other
  storage_path text,      -- Supabase Storage のパス（生ファイル保存先）
  extracted_text text,    -- テキスト変換後の内容
  structured_data jsonb,  -- Claude が抽出した構造化データ
  person_name text,       -- スキルシートの場合：氏名
  skills text[],          -- スキルシートの場合：スキル一覧
  available_from date,    -- スキルシートの場合：参画可能日
  status text default 'pending', -- pending / processed / failed / skipped
  created_at timestamptz default now()
);

alter table attachments enable row level security;

create policy "テナントごとにデータ分離" on attachments
  using (tenant_id = (
    select tenant_id from profiles where id = auth.uid()
  ));
```

---

## 主要 API 設計

### POST /api/mail/receive
SendGrid Inbound Parse からの Webhook 受信

```typescript
// 処理フロー
// 1. SendGrid署名検証
// 2. メール本文抽出（HTML→テキスト変換）
// 3. テナント特定（受信アドレスのドメインから判定）
// 4. Claude API で分類・構造化
// 5. Supabase に保存
// 6. 重複チェック（message_idで排除）

// Claude に渡すプロンプト
const systemPrompt = `
あなたはSES企業のメール分類AIです。
受信したメールを分析し、以下のJSON形式で返してください。
JSON以外は絶対に出力しないでください。

{
  "category": "人材関連" | "案件・プロジェクト" | "アンケート・調査" | "営業・受注" | "その他",
  "priority": "高" | "中" | "低",
  "summary": "メール内容の1行要約（50文字以内）",
  "related_people": ["人名1", "人名2"],
  "action_required": true | false,
  "tags": ["タグ1", "タグ2"]
}

優先度の判定基準：
- 高：期限が3日以内、緊急、重要顧客からの連絡
- 中：1週間以内の対応が必要
- 低：情報共有、FYI、定期連絡
`;
```

### GET /api/mails
メール一覧取得（検索・フィルター付き）

```typescript
// クエリパラメータ
// q: 全文検索キーワード
// category: カテゴリフィルター
// priority: 優先度フィルター
// status: 処理状況フィルター
// from: 開始日
// to: 終了日
// page: ページ番号
// limit: 件数（デフォルト50）
```

### PATCH /api/mails/[id]
メール処理状況の更新

---

## フロントエンド画面構成

```
/                   ← ランディングページ（SaaS紹介）
/login              ← ログイン
/register           ← 新規登録・テナント作成
/dashboard          ← メイン画面（メール一覧・検索）
/dashboard/[id]     ← メール詳細
/settings           ← テナント設定（転送アドレス確認等）
/settings/members   ← メンバー管理
/admin              ← SaaS管理者用（全テナント管理）
```

---

## 画面詳細仕様

### /dashboard（メイン画面）

必須機能：
- キーワード検索（件名・本文・送信者・関連人物）
- カテゴリフィルター（チェックボックス）
- 優先度フィルター
- 処理状況フィルター
- 受信日時ソート（新しい順・古い順）
- ページネーション
- 一覧でカテゴリ・優先度を色分け表示
- 処理状況を1クリックで変更

### /settings（設定画面）

必須機能：
- テナント専用の転送先メールアドレス表示
  - 例：`tenant-xxxx@inbound.yourdomain.com`
- 転送設定手順の表示（Exchange / Gmail それぞれ）
- APIキー使用量の確認

---

## マルチテナント設計方針

- テナントごとに専用の受信メールアドレスを発行
  - 形式：`{tenant_id}@inbound.{サービスドメイン}`
- Supabase RLS でデータを完全分離
- SendGrid の受信アドレスから tenant_id を特定
- ユーザーは自社のメールを転送設定するだけで利用開始

---

## 環境変数

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic
ANTHROPIC_API_KEY=

# SendGrid
SENDGRID_API_KEY=
SENDGRID_WEBHOOK_SECRET=
INBOUND_EMAIL_DOMAIN=inbound.yourdomain.com

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# App
NEXT_PUBLIC_APP_URL=
```

---

## 開発優先順位（MVP定義）

### Phase 1（Week 1）：コアロジック
- [ ] Next.js + Supabase 初期セットアップ
- [ ] DBマイグレーション実行
- [ ] SendGrid Webhook 受信 API
- [ ] Claude API 分類処理
- [ ] Supabase へのメール保存
- [ ] 添付ファイルは Supabase Storage に保存のみ（中身は処理しない）

### Phase 2（Week 2）：SaaS化
- [ ] Supabase Auth ログイン実装
- [ ] マルチテナント対応
- [ ] メール一覧・検索 UI
- [ ] メール詳細 UI
- [ ] 添付ファイル解析（Excel / PDF / Word）
  - xlsx ライブラリで Excel テキスト抽出
  - pdf-parse で PDF テキスト抽出
  - mammoth で Word テキスト抽出
  - 抽出テキストを Claude API に渡してスキルシート構造化
  - スキルシート情報（氏名・スキル・参画可能日）を attachments テーブルに保存
  - 添付ファイルの中身も検索対象に含める
  - ※ パスワード付きファイルは「要手動対応」フラグを立てて通知（個別ケアで対応）

### Phase 3（Week 3）：販売準備
- [ ] Stripe 課金実装
- [ ] 設定画面（転送設定ガイド）
- [ ] ランディングページ
- [ ] 本番デプロイ（Vercel + Supabase）

---

## 実装時の注意点

### セキュリティ
- SendGrid Webhook は署名検証を必ず実装
- Supabase RLS を全テーブルに適用
- API Route は認証チェックを必ず行う
- メール本文は500文字でトランケートしてAIに渡す（コスト削減）

### エラーハンドリング
- Claude API タイムアウト時は category="その他" でフォールバック保存
- 重複メール（同一 message_id）は無視（200 を返す）
- Webhook 失敗時の再試行に備えて冪等性を保証

### コスト最適化
- Claude API へ渡す本文は最大1,000トークンに制限
- 月間処理件数をテナントごとに制限（plan に応じて）

### 添付ファイル処理（Phase 2）
- 対応形式：Excel (.xlsx / .xls) / PDF / Word (.docx)
- 使用ライブラリ：
  - Excel：`xlsx`
  - PDF：`pdf-parse`
  - Word：`mammoth`
- 処理は非同期キューで実行（メール受信の応答速度に影響させない）
- パスワード付きファイルは status = `skipped` で保存し、ユーザーに通知
- ファイルサイズ上限：10MB（SendGrid 制限に準拠）
- スキャンPDF（画像PDF）は Phase 2 では対象外

---

## Claude Code への依頼例

### Step 1: プロジェクト初期化

```
上記仕様書に基づいて、Next.js + Supabase + TypeScript の
メール分類SaaSプロジェクトを初期化してください。

まず以下を実装してください：
1. next.js プロジェクト作成（App Router）
2. supabase クライアント設定
3. 上記のSQLマイグレーションファイル作成
4. 環境変数テンプレート（.env.local.example）
```

### Step 2: Webhook受信

```
/api/mail/receive の POST エンドポイントを実装してください。
SendGrid Inbound Parse の形式でメールを受信し、
Claude API で分類後、Supabase に保存する処理を作ってください。
仕様書のプロンプト・DB設計に従ってください。
```

### Step 3: フロントエンド

```
/dashboard の一覧画面を実装してください。
Tailwind CSS を使い、以下を含めてください：
- キーワード検索
- カテゴリ・優先度・処理状況フィルター
- メール一覧（カテゴリ・優先度を色分け）
- 処理状況の1クリック変更
```

### Step 4: 添付ファイル解析（Phase 2）

```
添付ファイル解析処理を実装してください。
仕様書の attachments テーブル設計に従い、以下を実装してください：

1. SendGrid Webhook から添付ファイル（base64）を取得して
   Supabase Storage に保存する処理
2. xlsx / pdf-parse / mammoth を使ったテキスト抽出処理
3. 抽出テキストを Claude API に渡してスキルシートを構造化する処理
   （氏名・スキル一覧・参画可能日・経験年数を抽出）
4. パスワード付きファイルを検知して status='skipped' で保存し
   ユーザーに通知する処理
5. 処理は非同期で実行し、メール受信のレスポンス速度に影響させないこと
```

---

## 参考リンク

- [Supabase ドキュメント](https://supabase.com/docs)
- [SendGrid Inbound Parse](https://docs.sendgrid.com/for-developers/parsing-email/setting-up-the-inbound-parse-webhook)
- [Anthropic Claude API](https://docs.anthropic.com/en/api/getting-started)
- [Stripe Subscriptions](https://stripe.com/docs/billing/subscriptions/overview)
- [Next.js App Router](https://nextjs.org/docs/app)
- [xlsx（Excel解析）](https://www.npmjs.com/package/xlsx)
- [pdf-parse（PDF解析）](https://www.npmjs.com/package/pdf-parse)
- [mammoth（Word解析）](https://www.npmjs.com/package/mammoth)
