import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* ヘッダー */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900">MailSort</h1>
          <div className="flex gap-3">
            <Link
              href="/login"
              className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              ログイン
            </Link>
            <Link
              href="/register"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              無料で始める
            </Link>
          </div>
        </div>
      </header>

      {/* ヒーロー */}
      <section className="flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white px-4 py-24">
        <h2 className="max-w-2xl text-center text-4xl font-bold leading-tight text-gray-900">
          受信メールをAIが自動分類。
          <br />
          探す時間を、ゼロに。
        </h2>
        <p className="mt-4 max-w-xl text-center text-lg text-gray-600">
          MailSort は受信メールをAIで自動分類・構造化し、チーム全員が瞬時に必要な情報にアクセスできるSaaSです。SES企業の業務効率を劇的に改善します。
        </p>
        <div className="mt-8 flex gap-4">
          <Link
            href="/register"
            className="rounded-md bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700"
          >
            無料で始める
          </Link>
          <a
            href="#features"
            className="rounded-md border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            機能を見る
          </a>
        </div>
      </section>

      {/* 機能紹介 */}
      <section id="features" className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h3 className="mb-12 text-center text-2xl font-bold text-gray-900">主な機能</h3>
          <div className="grid gap-8 md:grid-cols-3">
            <FeatureCard
              title="AI自動分類"
              description="受信メールをAIが自動でカテゴリ分け。人材関連、案件情報、営業メールなどを瞬時に整理します。"
            />
            <FeatureCard
              title="高精度な検索"
              description="件名・本文・送信者・関連人物をまたいだ全文検索。カテゴリや優先度でのフィルタリングも可能です。"
            />
            <FeatureCard
              title="スキルシート解析"
              description="添付のExcel・PDF・Wordファイルからスキルシート情報を自動抽出。人材の検索・マッチングを効率化します。"
            />
            <FeatureCard
              title="マルチテナント"
              description="チーム全員でメールを共有・検索可能。メール転送を設定するだけですぐに利用開始できます。"
            />
            <FeatureCard
              title="優先度・要対応管理"
              description="AIが優先度を自動判定。要対応メールを見逃さず、処理状況をワンクリックで管理できます。"
            />
            <FeatureCard
              title="セキュリティ"
              description="テナントごとにデータを完全分離。Row Level Security でデータベースレベルでアクセスを制御しています。"
            />
          </div>
        </div>
      </section>

      {/* 料金 */}
      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-4xl px-4">
          <h3 className="mb-12 text-center text-2xl font-bold text-gray-900">料金プラン</h3>
          <div className="grid gap-6 md:grid-cols-3">
            <PricingCard
              name="Free"
              price="0"
              features={["月500件まで", "AI自動分類", "キーワード検索", "メンバー2名まで"]}
            />
            <PricingCard
              name="Standard"
              price="9,800"
              features={["月5,000件まで", "AI自動分類", "添付ファイル解析", "メンバー無制限", "優先サポート"]}
              highlighted
            />
            <PricingCard
              name="Enterprise"
              price="29,800"
              features={["月50,000件まで", "全機能利用可能", "API連携", "専任サポート", "SLA保証"]}
            />
          </div>
        </div>
      </section>

      {/* フッター */}
      <footer className="border-t border-gray-200 bg-white py-8">
        <div className="mx-auto max-w-6xl px-4 text-center text-sm text-gray-500">
          &copy; 2026 MailSort. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h4 className="mb-2 text-lg font-semibold text-gray-900">{title}</h4>
      <p className="text-sm leading-relaxed text-gray-600">{description}</p>
    </div>
  );
}

function PricingCard({
  name,
  price,
  features,
  highlighted,
}: {
  name: string;
  price: string;
  features: string[];
  highlighted?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-6 ${
        highlighted
          ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500"
          : "border-gray-200 bg-white"
      }`}
    >
      <h4 className="mb-1 text-lg font-semibold text-gray-900">{name}</h4>
      <p className="mb-4">
        <span className="text-3xl font-bold text-gray-900">&yen;{price}</span>
        <span className="text-sm text-gray-500"> /月</span>
      </p>
      <ul className="mb-6 space-y-2">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
            <span className="mt-0.5 text-green-500">&#10003;</span>
            {f}
          </li>
        ))}
      </ul>
      <Link
        href="/register"
        className={`block rounded-md px-4 py-2 text-center text-sm font-medium ${
          highlighted
            ? "bg-blue-600 text-white hover:bg-blue-700"
            : "border border-gray-300 text-gray-700 hover:bg-gray-50"
        }`}
      >
        始める
      </Link>
    </div>
  );
}
