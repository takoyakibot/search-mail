import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const systemPrompt = `あなたはSES企業の添付ファイル解析AIです。
添付ファイルから抽出したテキストを分析し、以下のJSON形式で返してください。
JSON以外は絶対に出力しないでください。

スキルシート（人材情報）の場合：
{
  "is_skillsheet": true,
  "person_name": "氏名",
  "skills": ["Java", "Python", "AWS"],
  "available_from": "2024-04-01",
  "summary": "ファイル内容の1行要約（50文字以内）"
}

スキルシート以外の場合：
{
  "is_skillsheet": false,
  "person_name": null,
  "skills": [],
  "available_from": null,
  "summary": "ファイル内容の1行要約（50文字以内）"
}

注意事項：
- available_from はISO 8601の日付形式（YYYY-MM-DD）
- 参画可能日が明記されていない場合は null
- skills は具体的な技術名（言語・フレームワーク・クラウド等）を抽出`;

export type SkillsheetResult = {
  is_skillsheet: boolean;
  person_name: string | null;
  skills: string[];
  available_from: string | null;
  summary: string;
};

export async function classifySkillsheet(
  extractedText: string,
  fileName: string
): Promise<SkillsheetResult> {
  const truncatedText = extractedText.slice(0, 2000);

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `ファイル名: ${fileName}\n\n抽出テキスト:\n${truncatedText}`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    return JSON.parse(text) as SkillsheetResult;
  } catch (error) {
    console.error("Skillsheet classification failed:", error);
    return {
      is_skillsheet: false,
      person_name: null,
      skills: [],
      available_from: null,
      summary: "解析に失敗しました",
    };
  }
}
