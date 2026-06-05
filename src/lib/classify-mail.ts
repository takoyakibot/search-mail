import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

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

export type ClassifyResult = {
  category: string;
  priority: string;
  summary: string;
  related_people: string[];
  action_required: boolean;
  tags: string[];
};

const fallbackResult: ClassifyResult = {
  category: "その他",
  priority: "低",
  summary: "分類に失敗しました",
  related_people: [],
  action_required: false,
  tags: [],
};

export async function classifyMail(
  subject: string,
  body: string,
  sender: string
): Promise<ClassifyResult> {
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
    const parsed = JSON.parse(text) as ClassifyResult;
    return parsed;
  } catch (error) {
    console.error("Claude API classification failed:", error);
    return fallbackResult;
  }
}
