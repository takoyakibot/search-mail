// メルマガ・自動配信メールの判定

const NEWSLETTER_SENDER_PATTERNS = [
  /^noreply@/i,
  /^no-reply@/i,
  /^newsletter@/i,
  /^news@/i,
  /^info@.*\.co\.jp$/i,
  /^marketing@/i,
  /^mailmag@/i,
  /^delivery@/i,
  /^notification@/i,
  /^digest@/i,
];

const NEWSLETTER_SUBJECT_PATTERNS = [
  /メルマガ/,
  /メールマガジン/,
  /ニュースレター/,
  /newsletter/i,
  /配信停止/,
  /\[PR\]/,
  /≪PR≫/,
  /【PR】/,
  /unsubscribe/i,
];

export type NewsletterCheckInput = {
  sender: string;
  subject: string;
  headers?: string;
};

export function isNewsletter(input: NewsletterCheckInput): boolean {
  // 1. List-Unsubscribe ヘッダー（最も確実）
  if (input.headers && /^List-Unsubscribe:/mi.test(input.headers)) {
    return true;
  }

  // 2. Precedence: bulk / list ヘッダー
  if (input.headers && /^Precedence:\s*(bulk|list|junk)/mi.test(input.headers)) {
    return true;
  }

  // 3. 送信者パターン
  if (NEWSLETTER_SENDER_PATTERNS.some((p) => p.test(input.sender))) {
    return true;
  }

  // 4. 件名パターン
  if (NEWSLETTER_SUBJECT_PATTERNS.some((p) => p.test(input.subject))) {
    return true;
  }

  return false;
}

// テナントごとの除外送信者リスト（DB から取得した値と照合）
export function isExcludedSender(sender: string, excludeList: string[]): boolean {
  const senderLower = sender.toLowerCase();
  return excludeList.some((pattern) => {
    const p = pattern.toLowerCase().trim();
    if (!p) return false;
    // ドメイン指定（@example.com）
    if (p.startsWith("@")) return senderLower.includes(p);
    // アドレス完全一致 or 部分一致
    return senderLower.includes(p);
  });
}
