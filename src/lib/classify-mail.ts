import Anthropic from "@anthropic-ai/sdk";

export type ClassifyResult = {
  category: string;
  priority: string;
  summary: string;
  related_people: string[];
  action_required: boolean;
  tags: string[];
};

// ========================================
// ルールベース分類（コストゼロ）
// ========================================

const categoryRules: { keywords: string[]; category: string }[] = [
  { keywords: ["スキルシート", "経歴書", "要員", "技術者", "エンジニア", "人材", "アサイン", "稼働", "参画"], category: "人材関連" },
  { keywords: ["案件", "プロジェクト", "PJ", "開発", "構築", "運用", "保守", "要件定義"], category: "案件・プロジェクト" },
  { keywords: ["アンケート", "調査", "回答", "ヒアリング", "フィードバック"], category: "アンケート・調査" },
  { keywords: ["見積", "契約", "受注", "発注", "請求", "納品", "商談", "提案"], category: "営業・受注" },
];

const urgencyKeywords = ["至急", "緊急", "急ぎ", "ASAP", "本日中", "今日中", "明日まで"];
const actionKeywords = ["ご確認ください", "ご対応", "ご返信", "お願い", "依頼", "要回答"];

function classifyByRule(subject: string, body: string): ClassifyResult {
  const text = `${subject} ${body}`.toLowerCase();
  const originalText = `${subject} ${body}`;

  // カテゴリ判定
  let category = "その他";
  for (const rule of categoryRules) {
    if (rule.keywords.some((kw) => originalText.includes(kw))) {
      category = rule.category;
      break;
    }
  }

  // 優先度判定
  let priority = "低";
  if (urgencyKeywords.some((kw) => originalText.includes(kw))) {
    priority = "高";
  } else if (actionKeywords.some((kw) => originalText.includes(kw))) {
    priority = "中";
  }

  // 要対応判定
  const actionRequired = actionKeywords.some((kw) => originalText.includes(kw));

  // 簡易要約（件名をそのまま使う）
  const summary = subject.slice(0, 50) || "(件名なし)";

  // 簡易タグ
  const tags: string[] = [];
  if (text.includes("スキルシート") || text.includes("経歴書")) tags.push("スキルシート");
  if (text.includes("見積")) tags.push("見積");
  if (text.includes("契約")) tags.push("契約");
  if (urgencyKeywords.some((kw) => originalText.includes(kw))) tags.push("急ぎ");

  return {
    category,
    priority,
    summary,
    related_people: [],
    action_required: actionRequired,
    tags,
  };
}

// ========================================
// AI分類（Claude API）
// ========================================

const systemPrompt = `あなたはSES企業のメール分類AIです。
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
- 低：情報共有、FYI、定期連絡`;

const fallbackResult: ClassifyResult = {
  category: "その他",
  priority: "低",
  summary: "分類に失敗しました",
  related_people: [],
  action_required: false,
  tags: [],
};

async function classifyByAI(
  subject: string,
  body: string,
  sender: string
): Promise<ClassifyResult> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
  });

  const truncatedBody = body.slice(0, 500);

  const userMessage = `件名: ${subject}
送信者: ${sender}
本文:
${truncatedBody}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    return JSON.parse(text) as ClassifyResult;
  } catch (error) {
    console.error("Claude API classification failed:", error);
    return fallbackResult;
  }
}

// ========================================
// エントリポイント（環境変数で切り替え）
// ========================================

export async function classifyMail(
  subject: string,
  body: string,
  sender: string
): Promise<ClassifyResult> {
  const mode = process.env.CLASSIFY_MODE || "ai";

  if (mode === "rule") {
    return classifyByRule(subject, body);
  }

  return classifyByAI(subject, body, sender);
}
