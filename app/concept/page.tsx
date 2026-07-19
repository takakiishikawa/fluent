import { ConceptPage } from "@takaki/go-design-system";
import { RefreshCcw } from "lucide-react";

export default function ConceptRoute() {
  return (
    <ConceptPage
      className="pt-0 px-0"
      productName="Fluent"
      productLogo={
        <div className="flex items-center justify-center rounded-md bg-primary p-1.5">
          <RefreshCcw className="h-3.5 w-3.5 text-white" />
        </div>
      }
      tagline="英会話レッスン の学びを定着させるツール"
      coreMessage="英会話レッスン のレッスンで学んだ英語を、使える状態として定着させる。インプットで終わらせず、繰り返しと実践で「出せる英語」を身につける。"
      coreValue="英会話レッスン で得た英語表現を、リピーティング・スピーキングを通じて定着させる"
      scope={{
        solve: [
          "英会話レッスン と連動した復習・定着・組み立て練習",
          "文法・フレーズの反復リピーティング",
          "AIを活用したスピーキング練習と採点",
          "学習進捗の可視化とレポート",
        ],
        notSolve: [
          "語彙インプット・リスニング強化",
          "英会話実践（英会話レッスン が担う）",
          "テスト対策・資格学習",
          "汎用教材・他英会話サービス対応",
        ],
      }}
      productLogic={{
        steps: [
          {
            title: "インプット",
            description:
              "英会話レッスン でレッスンを受け、テキストを Fluent に貼り付ける",
          },
          {
            title: "AI解析",
            description: "AI が文法・フレーズ・例文・画像を自動生成",
          },
          {
            title: "聞ける・出せる",
            description:
              "リピーティングで音と意味を一致させ、反射的に口から出せるようにする",
          },
          {
            title: "組み立てる",
            description:
              "スピーキング練習で自分の考えを英語で生成する力を鍛える",
          },
          {
            title: "実践",
            description: "次の 英会話レッスン で実際に使い、定着を確認する",
          },
        ],
        outcome:
          "英会話レッスン の AI Speaking Test スコア向上と、実際のレッスンでの英語使用量増加",
      }}
      resultMetric={{
        title: "NC AI Speaking Test スコア",
        description:
          "英会話レッスン の AI Speaking Test で計測されるスコア。毎月定期受検し、長期的な推移を記録する。",
      }}
      behaviorMetrics={[
        {
          title: "リピーティング回数",
          description: "文法・フレーズの週間リピーティング回数",
        },
        { title: "スピーキング回数", description: "週間スピーキング練習回数" },
        {
          title: "英会話レッスン 受講回数",
          description: "週間 英会話レッスン レッスン受講回数",
        },
        {
          title: "シャドーイング時間",
          description: "週間シャドーイング視聴時間（分）",
        },
      ]}
    />
  );
}
