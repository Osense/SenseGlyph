// 가격 안내·이용약관·환불 규정 원문(한국어가 기준, 일본어·영어는 번역).
// 개인정보 처리방침은 components/LegalNotice.tsx 에 따로 있다.
// 근거: 전자상거래법 제10조(사업자 표시), 제13조(거래조건 고지), 제17조(청약철회, 디지털콘텐츠는
// 제공 개시 + '철회 불가' 표시와 시험 사용 제공 시 제한), 제18조(3영업일 이내 환급), 민법 제5조(미성년자).
// {price} 는 lib/payment.ts 의 PRICE, {email} 은 lib/business.ts 의 CONTACT_EMAIL 로 화면에서 바뀐다.
import type { UiLang } from "./i18n";
import type { LegalPage } from "./business";

export type LegalSection = { title: string; items: string[] };
export interface LegalDoc {
  title: string;
  intro: string;
  sections: LegalSection[];
}
type Docs = Record<UiLang, LegalDoc>;

const PRICING: Docs = {
  ko: {
    title: "가격 안내",
    intro:
      "쎈스 글리프는 글씨를 쓰고, 정돈하고, 미리 보는 데까지 모두 무료예요. 완성한 폰트 파일을 내려받을 때만 결제해요. 지금은 무료 베타 기간이라 결제를 받지 않아요.",
    sections: [
      {
        title: "상품",
        items: [
          "한글 폰트 1벌: {price} (부가가치세 포함)",
          "결제 단위: 프로젝트(폰트) 하나당 한 번이에요. 추가 요금이나 정기 결제는 없어요.",
        ],
      },
      {
        title: "포함 내용",
        items: [
          "쓴 글자와, 쓴 자모를 조합해 만든 현대 한글 11,172자",
          "굵기 3종(Light·Regular·Bold)과 TTF·OTF·웹폰트(WOFF2) 형식",
          "같은 폰트는 계정에서 기간 제한 없이 다시 내려받을 수 있어요(계정 기능을 연 뒤부터).",
          "쓰지 않은 글자는 고른 견본 글꼴(SIL OFL 1.1)의 모양으로 채워지고, 내려받기 전에 경고로 알려 드려요.",
        ],
      },
      {
        title: "결제 전에 꼭 확인하세요 (시험 사용)",
        items: [
          "결제 전에 문장 미리보기와 글자별 확인 화면으로 완성될 폰트의 모양을 직접 확인할 수 있어요. 이 미리보기가 시험 사용이에요.",
          "결제하면 글씨·정돈·폰트 이름이 결제한 그대로 고정돼요. 고치려면 프로젝트를 복제해 새 폰트로 만들어야 해요.",
          "내려받는 순간부터는 환불되지 않아요(파일이 열리지 않는 오류만 예외). 확인하지 않고 결제한 부분도 결제한 사람의 책임이에요. 자세한 내용은 환불 규정을 확인해 주세요.",
        ],
      },
      {
        title: "제공 방법과 시기",
        items: [
          "결제가 승인되면 바로 그 화면에서 파일을 내려받을 수 있어요. 배송은 없어요.",
          "결제 수단: 신용·체크카드, 카카오페이, 네이버페이, 토스페이(결제대행사를 통해 처리). 카드 정보는 쎈스 글리프에 저장되지 않아요.",
        ],
      },
      {
        title: "이용 범위",
        items: [
          "직접 쓴 글자 모양의 권리는 쓴 사람에게 있어요. 만든 폰트는 개인·상업 용도 모두 쓸 수 있어요.",
          "견본 글꼴로 채운 글자가 들어간 폰트를 배포·판매할 때는 SIL OFL 1.1 조건을 지켜 주세요.",
        ],
      },
    ],
  },
  ja: {
    title: "料金のご案内",
    intro:
      "SenseGlyph は、文字を書く・整える・プレビューするところまですべて無料です。完成したフォントファイルをダウンロードするときだけお支払いいただきます。現在は無料ベータ期間のため、お支払いは受け付けていません。",
    sections: [
      {
        title: "商品",
        items: [
          "ハングルフォント1書体：{price}（付加価値税込み）",
          "お支払い単位：プロジェクト（フォント）1つにつき1回です。追加料金や定期課金はありません。",
        ],
      },
      {
        title: "含まれるもの",
        items: [
          "書いた文字と、書いた字母を組み合わせた現代ハングル11,172字",
          "太さ3種（Light・Regular・Bold）と TTF・OTF・ウェブフォント（WOFF2）形式",
          "同じフォントはアカウントから期限なく再ダウンロードできます（アカウント機能の提供開始後）。",
          "書かなかった文字は、選んだ見本フォント（SIL OFL 1.1）の形で補われ、ダウンロード前に警告でお知らせします。",
        ],
      },
      {
        title: "お支払い前に必ずご確認ください（お試し）",
        items: [
          "お支払い前に、文章プレビューと文字ごとの確認画面で、仕上がるフォントの形を確認できます。このプレビューがお試し利用にあたります。",
          "お支払い後は、文字・整え・フォント名がそのまま固定されます。直したいときはプロジェクトを複製して新しいフォントとして作り直してください。",
          "ダウンロードした時点から返金できません（ファイルが開けないエラーのみ例外）。確認せずに購入した部分も購入者の責任となります。詳しくは返金ポリシーをご覧ください。",
        ],
      },
      {
        title: "提供方法と時期",
        items: [
          "決済が承認されると、その画面ですぐにファイルをダウンロードできます。配送はありません。",
          "お支払い方法：クレジット・デビットカード、カカオペイ、ネイバーペイ、トスペイ（決済代行会社を通じて処理）。カード情報は SenseGlyph に保存されません。",
        ],
      },
      {
        title: "利用範囲",
        items: [
          "自分で書いた文字の形の権利は書いた人にあります。作ったフォントは個人・商用どちらにも使えます。",
          "見本フォントで補った文字を含むフォントを配布・販売するときは、SIL OFL 1.1 の条件を守ってください。",
        ],
      },
    ],
  },
  en: {
    title: "Pricing",
    intro:
      "Writing, refining, and previewing in SenseGlyph are all free. You pay only when you download a finished font file. During the current free beta, no payments are taken.",
    sections: [
      {
        title: "Product",
        items: [
          "Korean (Hangul) font: {price} (VAT included)",
          "One payment per project (font). No extra fees or subscriptions.",
        ],
      },
      {
        title: "What's included",
        items: [
          "The characters you wrote, plus all 11,172 modern Hangul syllables composed from the parts you wrote",
          "Three weights (Light, Regular, Bold) in TTF, OTF and web font (WOFF2) formats",
          "Unlimited re-downloads of the same font from your account (once accounts are available).",
          "Characters you did not write are filled in from the chosen sample font (SIL OFL 1.1), and you are warned before downloading.",
        ],
      },
      {
        title: "Check before you pay (trial)",
        items: [
          "Before paying, you can check exactly how the font will look in the sentence preview and the per-character review screen. This preview serves as the trial.",
          "After payment, the handwriting, refinements and font name are locked as paid. To change them, duplicate the project and make a new font.",
          "There are no refunds from the moment you download (the only exception is a file that will not open). Anything you paid for without checking is the buyer's responsibility. See the Refund Policy for details.",
        ],
      },
      {
        title: "Delivery",
        items: [
          "Once the payment is approved, you can download the files right away on the same screen. Nothing is shipped.",
          "Payment methods: credit/debit card, KakaoPay, Naver Pay, Toss Pay (processed by a payment gateway). Card details are never stored by SenseGlyph.",
        ],
      },
      {
        title: "Usage",
        items: [
          "The rights to the shapes you wrote belong to you. Your font may be used for both personal and commercial purposes.",
          "If you distribute or sell a font containing glyphs filled in from a sample font, follow the SIL OFL 1.1.",
        ],
      },
    ],
  },
};

const REFUND: Docs = {
  ko: {
    title: "환불 규정",
    intro:
      "쎈스 글리프에서 파는 상품은 내려받는 디지털 콘텐츠(폰트 파일)예요. 결제 전에 미리보기로 결과물을 직접 확인하고 사는 상품이라, 내려받은 뒤에는 환불되지 않아요.",
    sections: [
      {
        title: "1. 내려받기 전: 7일 안에 전액 환불",
        items: [
          "결제한 날부터 7일 안에, 아직 한 번도 내려받지 않았다면 이유와 관계없이 전액 환불해 드려요.",
        ],
      },
      {
        title: "2. 내려받은 뒤: 환불 불가",
        items: [
          "폰트 파일을 내려받는 순간 디지털 콘텐츠 제공이 시작되므로, 그 뒤에는 어떤 이유로도 청약 철회와 환불을 할 수 없어요(전자상거래법 제17조 제2항 제5호). 단, 아래 3번의 파일 오류만 예외예요.",
          "결제 전에 문장 미리보기와 글자별 확인 화면으로 완성될 모양을 확인할 수 있게 하고(시험 사용), 결제 화면에서 환불 불가에 동의를 받아요.",
          "글씨 모양, 조합·정돈 결과, 견본 글꼴로 채운 글자, 폰트 이름처럼 결제 전에 확인할 수 있었던 부분은 확인하지 않고 결제한 경우에도 결제한 사람의 책임이에요. 마음에 들지 않는다는 이유로는 환불하지 않아요.",
        ],
      },
      {
        title: "3. 예외: 파일이 열리지 않는 오류",
        items: [
          "내려받은 파일이 손상되어 열리거나 설치되지 않는 큰 오류에 한해, 받은 날부터 3개월 안에, 그 사실을 안 날부터 30일 안에 알려 주시면 고친 파일을 다시 드리고, 고칠 수 없으면 전액 환불해 드려요(같은 법 제17조 제3항).",
          "특정 프로그램·기기에서 일부 기능이 다르게 보이는 것, 글자 모양이나 간격이 기대와 다른 것은 파일 오류에 해당하지 않아요.",
          "결제 오류로 두 번 결제된 금액은 기간과 관계없이 돌려 드려요.",
        ],
      },
      {
        title: "4. 문의와 환불 절차",
        items: [
          "환불·오류 신고 등 모든 문의는 {email} 로 보내 주세요. 주문 번호(또는 결제 일시·금액)와 폰트 이름을 함께 적어 주시고, 파일 오류라면 오류 화면이나 사용한 프로그램·기기를 알려 주세요.",
          "환불이 확인되면 3영업일 안에 결제한 수단으로 환불 절차를 진행해요(같은 법 제18조). 카드사 사정에 따라 실제 취소가 반영되기까지 며칠이 더 걸릴 수 있어요.",
          "환불한 폰트는 다시 받을 수 없게 되고, 이미 받은 파일은 지워 주셔야 해요.",
        ],
      },
      {
        title: "5. 미성년자 결제",
        items: [
          "미성년자가 법정대리인의 동의 없이 결제한 경우, 본인이나 법정대리인이 결제를 취소할 수 있어요(민법 제5조). 다만 법정대리인이 허락한 범위의 용돈 등으로 결제했다면 취소가 제한될 수 있어요.",
        ],
      },
      {
        title: "6. 분쟁 해결",
        items: [
          "이견이 있으면 먼저 {email} 로 알려 주세요. 해결되지 않으면 한국소비자원(국번 없이 1372)이나 콘텐츠분쟁조정위원회에 도움을 요청할 수 있어요.",
        ],
      },
    ],
  },
  ja: {
    title: "返金ポリシー",
    intro:
      "SenseGlyph で販売する商品は、ダウンロード型のデジタルコンテンツ（フォントファイル）です。お支払い前にプレビューで仕上がりを確認してから購入する商品のため、ダウンロード後は返金できません。",
    sections: [
      {
        title: "1. ダウンロード前：7日以内なら全額返金",
        items: [
          "お支払い日から7日以内で、まだ一度もダウンロードしていなければ、理由を問わず全額返金します。",
        ],
      },
      {
        title: "2. ダウンロード後：返金不可",
        items: [
          "フォントファイルをダウンロードした時点でデジタルコンテンツの提供が始まるため、その後はいかなる理由でも申込みの撤回・返金はできません（韓国電子商取引法第17条第2項第5号）。ただし、下記3のファイルエラーのみ例外です。",
          "お支払い前に文章プレビューと文字ごとの確認画面で仕上がりを確認できるようにし（お試し利用）、決済画面で返金不可への同意をいただきます。",
          "文字の形、組み合わせ・整えの結果、見本フォントで補った文字、フォント名など、お支払い前に確認できた部分は、確認せずに購入した場合でも購入者の責任となります。気に入らないという理由での返金はいたしません。",
        ],
      },
      {
        title: "3. 例外：ファイルが開けないエラー",
        items: [
          "ダウンロードしたファイルが壊れていて開けない・インストールできない重大なエラーに限り、受け取った日から3か月以内、その事実を知った日から30日以内にご連絡いただければ、修正したファイルをお渡しし、修正できない場合は全額返金します（同法第17条第3項）。",
          "特定のソフト・端末で一部の機能の表示が異なる、文字の形や間隔が期待と違うといったことは、ファイルエラーにあたりません。",
          "決済エラーで二重に支払われた金額は、期間にかかわらずお返しします。",
        ],
      },
      {
        title: "4. お問い合わせと返金の手続き",
        items: [
          "返金・エラーの報告などのお問い合わせは、すべて {email} までお送りください。注文番号（または決済日時・金額）とフォント名を添え、ファイルエラーの場合はエラー画面や使ったソフト・端末もお知らせください。",
          "返金が確認されてから3営業日以内に、お支払いいただいた方法で返金手続きを行います（同法第18条）。カード会社の事情により、実際の取消の反映まで数日かかることがあります。",
          "返金したフォントは再ダウンロードできなくなり、すでに受け取ったファイルは削除していただく必要があります。",
        ],
      },
      {
        title: "5. 未成年者のお支払い",
        items: [
          "未成年者が法定代理人の同意なく支払った場合、本人または法定代理人が取り消すことができます（韓国民法第5条）。ただし、法定代理人が許した範囲のお小遣いなどで支払った場合は、取消が制限されることがあります。",
        ],
      },
      {
        title: "6. 紛争の解決",
        items: [
          "ご意見があれば、まず {email} までお知らせください。解決しない場合は、韓国消費者院（1372）やコンテンツ紛争調停委員会に相談できます。",
        ],
      },
    ],
  },
  en: {
    title: "Refund Policy",
    intro:
      "SenseGlyph sells downloadable digital content (font files). You check the result in the preview before you buy, so there are no refunds once a font has been downloaded.",
    sections: [
      {
        title: "1. Before download: full refund within 7 days",
        items: [
          "If you have not downloaded the font even once, you get a full refund for any reason within 7 days of payment.",
        ],
      },
      {
        title: "2. After download: no refunds",
        items: [
          "Delivery of the digital content starts the moment you download the font files, so from then on the order cannot be withdrawn or refunded for any reason (Article 17(2)5 of Korea's E-Commerce Consumer Protection Act). The only exception is the file error described in section 3.",
          "You can check the finished look in the sentence preview and per-character review before paying (trial use), and the payment screen asks you to agree that there are no refunds after download.",
          "Anything you could have checked before paying, such as the shapes of your handwriting, the composition and refinement results, characters filled in from a sample font, or the font name, is the buyer's responsibility even if you paid without checking it. We do not refund because you do not like the result.",
        ],
      },
      {
        title: "3. Exception: files that will not open",
        items: [
          "Only for a serious error where the downloaded file is corrupted and will not open or install, tell us within 3 months of receiving it and within 30 days of discovering the problem. We will send a fixed file, or refund you in full if it cannot be fixed (Article 17(3)).",
          "Features displaying differently in particular software or devices, or letter shapes and spacing that differ from what you expected, are not file errors.",
          "Duplicate charges caused by payment errors are always refunded.",
        ],
      },
      {
        title: "4. Contact and refund procedure",
        items: [
          "Send all requests, including refunds and error reports, to {email}. Include the order number (or payment date and amount) and the font name; for a file error, also tell us the error message and the software and device you used.",
          "Once a refund is confirmed, we start it to your original payment method within 3 business days (Article 18). Your card issuer may take a few more days to reflect the cancellation.",
          "A refunded font can no longer be downloaded, and files you already received must be deleted.",
        ],
      },
      {
        title: "5. Payments by minors",
        items: [
          "If a minor pays without a legal guardian's consent, the minor or the guardian may cancel the payment (Article 5 of the Korean Civil Act). Cancellation may be limited if the payment was made from money the guardian allowed the minor to spend freely.",
        ],
      },
      {
        title: "6. Disputes",
        items: [
          "If you disagree, please tell us first at {email}. If it is not resolved, you can ask the Korea Consumer Agency (1372) or the Content Dispute Resolution Committee for help.",
        ],
      },
    ],
  },
};

const TERMS: Docs = {
  ko: {
    title: "이용약관",
    intro:
      "이 약관은 OSNS.studio(이하 ‘운영자’)가 제공하는 쎈스 글리프(이하 ‘서비스’)를 이용할 때의 조건과 절차, 운영자와 이용자의 권리·의무를 정해요.",
    sections: [
      {
        title: "제1조 (서비스)",
        items: [
          "서비스는 태블릿 등에 직접 쓴 손글씨로 개인 폰트를 만들고, 미리 보고, 내려받을 수 있게 하는 웹·앱 서비스예요.",
          "글씨 쓰기·정돈·미리보기는 무료이고, 완성한 폰트 파일의 내려받기는 가격 안내에 적힌 유료 상품이에요. 무료 베타 기간에는 결제 없이 제공할 수 있어요.",
        ],
      },
      {
        title: "제2조 (약관의 게시와 변경)",
        items: [
          "이 약관은 서비스 화면과 이 페이지에 게시해요.",
          "약관을 바꿀 때는 시행일과 바뀌는 내용을 시행 7일 전부터, 이용자에게 불리한 변경은 30일 전부터 서비스 안에 알려요. 바뀐 약관에 동의하지 않으면 이용을 멈추고 탈퇴할 수 있어요.",
        ],
      },
      {
        title: "제3조 (계정)",
        items: [
          "로그인은 구글·카카오·네이버 계정으로만 하며, 별도의 아이디·비밀번호를 만들지 않아요(계정 기능은 순차적으로 열어요). 로그인하지 않아도 이 기기 안에서 서비스를 쓸 수 있어요.",
          "계정은 본인만 사용해야 하고, 다른 사람의 계정을 쓰거나 계정을 넘겨서는 안 돼요.",
          "같은 사람이라도 다른 로그인 방법으로 들어오면 서로 다른 계정이 돼요. 처음 로그인한 방법으로 계속 이용해 주세요.",
          "탈퇴하면 계정에 저장된 손글씨와 폰트 정보는 개인정보 처리방침에 따라 지워지고, 법령에 따라 보관해야 하는 결제 기록만 정해진 기간 동안 남아요.",
        ],
      },
      {
        title: "제4조 (유료 상품과 결제)",
        items: [
          "상품의 내용·가격·제공 방법은 가격 안내와 결제 화면에 표시한 대로예요.",
          "결제는 결제대행사(PG)를 통해 처리되고, 운영자는 카드 번호 등 결제 수단 정보를 저장하지 않아요.",
          "결제한 폰트는 글씨·정돈·이름이 결제한 그대로 고정되며, 계정에서 다시 내려받을 수 있어요.",
          "결제 전에 미리보기로 결과물을 확인하는 것은 이용자의 몫이며, 확인하지 않고 결제해 생긴 불만은 이용자의 책임이에요. 내려받은 뒤에는 환불되지 않고(파일이 열리지 않는 오류만 예외), 자세한 내용은 환불 규정을 따라요.",
        ],
      },
      {
        title: "제5조 (만든 폰트의 권리)",
        items: [
          "이용자가 직접 쓴 글자 모양과 그것으로 만든 폰트의 권리는 이용자에게 있어요. 운영자는 만든 폰트에 대한 권리를 주장하지 않아요.",
          "운영자는 서비스 제공(저장·폰트 생성·다시 받기)에 필요한 범위에서만 이용자의 손글씨 데이터를 다뤄요. 홍보 등 다른 목적으로 쓰려면 따로 동의를 받아요.",
          "쓰지 않은 글자를 채운 견본 글꼴은 각 제작자의 SIL 오픈 폰트 라이선스(OFL) 1.1을 따라요. 견본 글꼴 글자가 들어간 폰트를 배포·판매할 때는 OFL 조건을 지켜야 해요.",
          "다른 사람이 등록한 폰트 이름과 이미 있는 유명 폰트 이름은 쓸 수 없어요.",
        ],
      },
      {
        title: "제6조 (금지 행위)",
        items: [
          "다른 사람의 글씨나 저작물(기존 폰트 포함)을 허락 없이 따라 써서 폰트로 만들거나 배포하는 행위",
          "결제·다운로드 제한을 우회하거나, 서비스의 코드·서버에 부당하게 접근하는 행위",
          "다른 사람이나 기관을 사칭하는 폰트 이름을 쓰는 행위",
          "법령이나 공공질서에 어긋나는 목적으로 서비스를 쓰는 행위",
          "위 행위가 확인되면 운영자는 이용을 제한할 수 있고, 그로 인한 손해에 대해 책임을 물을 수 있어요.",
        ],
      },
      {
        title: "제7조 (서비스의 변경과 중단)",
        items: [
          "운영자는 기능을 개선하거나 바꿀 수 있어요. 유료 상품의 내용이 이용자에게 불리하게 바뀌는 경우에는 미리 알려요.",
          "점검·장애·천재지변 등으로 서비스가 잠시 멈출 수 있어요. 서비스를 완전히 끝낼 때는 30일 전에 알리고, 결제한 폰트를 내려받을 기간을 드려요.",
        ],
      },
      {
        title: "제8조 (책임의 한계)",
        items: [
          "운영자는 서비스가 안내한 대로 작동하도록 노력하지만, 만든 폰트가 모든 프로그램·기기에서 똑같이 보이는 것까지 보장하지는 않아요. 다만 운영자의 고의나 과실로 생긴 손해는 법령에 따라 책임져요.",
          "무료 베타 기간의 결과물과 이 기기에만 저장된 데이터는 이용자가 백업해 두어야 해요(설정 → JSON 내보내기).",
          "이용자가 만든 폰트를 쓰다가 제3자와 생긴 분쟁은 이용자가 해결해야 해요. 단, 서비스의 결함 때문인 경우는 예외예요.",
        ],
      },
      {
        title: "제9조 (개인정보)",
        items: ["개인정보는 개인정보 처리방침에 따라 처리해요."],
      },
      {
        title: "제10조 (분쟁 해결과 관할)",
        items: [
          "분쟁이 생기면 먼저 {email} 로 알려 주세요. 운영자는 성실히 협의해요.",
          "협의가 안 되면 한국소비자원(1372)이나 콘텐츠분쟁조정위원회에 조정을 신청할 수 있어요.",
          "이 약관은 대한민국 법을 따르고, 소송은 민사소송법에 따른 관할 법원에서 해요.",
          "일본어·영어 번역과 한국어 원문이 다르면 한국어 원문이 우선해요.",
        ],
      },
    ],
  },
  ja: {
    title: "利用規約",
    intro:
      "この規約は、OSNS.studio（以下「運営者」）が提供する SenseGlyph（以下「サービス」）を利用する際の条件と手続き、運営者と利用者の権利・義務を定めるものです。",
    sections: [
      {
        title: "第1条（サービス）",
        items: [
          "サービスは、タブレットなどに直接書いた手書き文字で個人フォントを作り、プレビューし、ダウンロードできるウェブ・アプリサービスです。",
          "文字を書く・整える・プレビューは無料で、完成したフォントファイルのダウンロードは料金のご案内に記載した有料商品です。無料ベータ期間中は、お支払いなしで提供することがあります。",
        ],
      },
      {
        title: "第2条（規約の掲示と変更）",
        items: [
          "この規約は、サービス画面とこのページに掲示します。",
          "規約を変更するときは、施行日と変更内容を施行7日前から、利用者に不利な変更は30日前から、サービス内でお知らせします。変更後の規約に同意しない場合は、利用を中止して退会できます。",
        ],
      },
      {
        title: "第3条（アカウント）",
        items: [
          "ログインは Google・カカオ・ネイバーのアカウントでのみ行い、独自の ID・パスワードは作りません（アカウント機能は順次提供します）。ログインしなくても、この端末の中でサービスを使えます。",
          "アカウントは本人だけが使い、他人のアカウントを使ったり、アカウントを譲渡したりしてはいけません。",
          "同じ人でも、別のログイン方法で入ると別のアカウントになります。最初にログインした方法で使い続けてください。",
          "退会すると、アカウントに保存された手書き文字とフォントの情報はプライバシーポリシーに従って削除され、法令で保存が必要な決済記録だけが定められた期間残ります。",
        ],
      },
      {
        title: "第4条（有料商品とお支払い）",
        items: [
          "商品の内容・価格・提供方法は、料金のご案内と決済画面に表示したとおりです。",
          "お支払いは決済代行会社（PG）を通じて処理され、運営者はカード番号などの決済手段の情報を保存しません。",
          "お支払い済みのフォントは、文字・整え・名前がそのまま固定され、アカウントから再ダウンロードできます。",
          "お支払い前にプレビューで仕上がりを確認するのは利用者の役目であり、確認せずに購入したことによる不満は利用者の責任となります。ダウンロード後は返金できず（ファイルが開けないエラーのみ例外）、詳しくは返金ポリシーに従います。",
        ],
      },
      {
        title: "第5条（作ったフォントの権利）",
        items: [
          "利用者が自分で書いた文字の形と、それで作ったフォントの権利は利用者にあります。運営者は作られたフォントの権利を主張しません。",
          "運営者は、サービスの提供（保存・フォント生成・再ダウンロード）に必要な範囲でのみ利用者の手書きデータを扱います。宣伝など他の目的で使う場合は、別途同意をいただきます。",
          "書かなかった文字を補う見本フォントは、各制作者の SIL Open Font License（OFL）1.1 に従います。見本フォントの文字を含むフォントを配布・販売するときは、OFL の条件を守ってください。",
          "他の利用者が登録したフォント名や、既存の有名フォントの名前は使えません。",
        ],
      },
      {
        title: "第6条（禁止事項）",
        items: [
          "他人の筆跡や著作物（既存フォントを含む）を許可なくなぞってフォントにしたり配布したりする行為",
          "決済・ダウンロードの制限を回避したり、サービスのコード・サーバーに不正にアクセスしたりする行為",
          "他人や団体をかたるフォント名を使う行為",
          "法令や公序良俗に反する目的でサービスを使う行為",
          "上記の行為が確認された場合、運営者は利用を制限でき、それによる損害の責任を求めることがあります。",
        ],
      },
      {
        title: "第7条（サービスの変更と停止）",
        items: [
          "運営者は機能を改善・変更することがあります。有料商品の内容が利用者に不利に変わる場合は、事前にお知らせします。",
          "点検・障害・天災などでサービスが一時停止することがあります。サービスを完全に終了するときは30日前にお知らせし、お支払い済みのフォントをダウンロードする期間を設けます。",
        ],
      },
      {
        title: "第8条（責任の範囲）",
        items: [
          "運営者はサービスが案内どおりに動くよう努めますが、作ったフォントがすべてのソフト・端末で同じように表示されることまでは保証しません。ただし、運営者の故意または過失による損害は、法令に従って責任を負います。",
          "無料ベータ期間の成果物と、この端末だけに保存されたデータは、利用者がバックアップしてください（設定 → JSON 書き出し）。",
          "利用者が作ったフォントの使用をめぐる第三者との紛争は、利用者が解決するものとします。ただし、サービスの欠陥による場合は除きます。",
        ],
      },
      {
        title: "第9条（個人情報）",
        items: ["個人情報はプライバシーポリシーに従って取り扱います。"],
      },
      {
        title: "第10条（紛争の解決と管轄）",
        items: [
          "紛争が生じたときは、まず {email} までお知らせください。運営者は誠実に協議します。",
          "協議がまとまらない場合は、韓国消費者院（1372）やコンテンツ紛争調停委員会に調停を申し立てることができます。",
          "この規約は大韓民国の法律に従い、訴訟は韓国民事訴訟法に基づく管轄裁判所で行います。",
          "日本語・英語の翻訳と韓国語の原文が異なる場合は、韓国語の原文が優先します。",
        ],
      },
    ],
  },
  en: {
    title: "Terms of Service",
    intro:
      "These terms set out the conditions and procedures for using SenseGlyph (the “Service”) provided by OSNS.studio (the “Operator”), and the rights and duties of the Operator and users.",
    sections: [
      {
        title: "1. The Service",
        items: [
          "The Service is a web and app service for making, previewing and downloading a personal font from handwriting written directly on a tablet or similar device.",
          "Writing, refining and previewing are free; downloading a finished font file is a paid product as described on the Pricing page. During the free beta, it may be provided without payment.",
        ],
      },
      {
        title: "2. Posting and changes",
        items: [
          "These terms are posted in the Service and on this page.",
          "When we change them, we announce the effective date and the changes in the Service at least 7 days in advance, or 30 days in advance for changes unfavorable to users. If you do not agree to the new terms, you may stop using the Service and close your account.",
        ],
      },
      {
        title: "3. Accounts",
        items: [
          "Sign-in is only through Google, Kakao or Naver accounts; we do not create separate IDs or passwords (account features are being rolled out). You can use the Service on this device without signing in.",
          "Only you may use your account. Do not use another person's account or transfer yours.",
          "Signing in with a different method creates a different account, even for the same person. Please keep using the method you first signed in with.",
          "When you close your account, the handwriting and font data stored in it are deleted under the Privacy Policy, and only payment records that the law requires us to keep remain for the required period.",
        ],
      },
      {
        title: "4. Paid products and payment",
        items: [
          "The content, price and delivery of products are as shown on the Pricing page and the payment screen.",
          "Payments are processed by a payment gateway (PG); the Operator does not store card numbers or other payment details.",
          "A paid font is locked with the handwriting, refinements and name as paid, and can be downloaded again from your account.",
          "Checking the result in the preview before paying is the user's responsibility, and dissatisfaction from paying without checking is the user's own. There are no refunds after download (except files that will not open); details follow the Refund Policy.",
        ],
      },
      {
        title: "5. Rights to your font",
        items: [
          "The rights to the character shapes you wrote and the font made from them belong to you. The Operator claims no rights to your font.",
          "The Operator handles your handwriting data only as needed to provide the Service (storage, font generation, re-downloads). Any other use, such as promotion, requires your separate consent.",
          "Sample fonts used to fill characters you did not write are licensed by their authors under the SIL Open Font License (OFL) 1.1. If you distribute or sell a font containing sample glyphs, you must follow the OFL.",
          "Font names registered by other users and names of well-known existing fonts cannot be used.",
        ],
      },
      {
        title: "6. Prohibited conduct",
        items: [
          "Tracing another person's handwriting or copyrighted work (including existing fonts) without permission to make or distribute a font",
          "Circumventing payment or download restrictions, or accessing the Service's code or servers without authorization",
          "Using a font name that impersonates another person or organization",
          "Using the Service for purposes contrary to law or public order",
          "If such conduct is confirmed, the Operator may restrict use and may claim compensation for resulting damage.",
        ],
      },
      {
        title: "7. Changes and suspension",
        items: [
          "The Operator may improve or change features, and will announce in advance any change to paid products that is unfavorable to users.",
          "The Service may pause temporarily for maintenance, outages or force majeure. If the Service is discontinued, we will announce it 30 days in advance and give you time to download the fonts you paid for.",
        ],
      },
      {
        title: "8. Limitation of liability",
        items: [
          "The Operator strives to make the Service work as described, but does not guarantee that a font looks identical in every program or device. The Operator is liable under the law for damage caused by its intent or negligence.",
          "Please back up beta results and data stored only on this device (Settings → Export JSON).",
          "Disputes with third parties arising from your use of your font are your responsibility, except where caused by a defect in the Service.",
        ],
      },
      {
        title: "9. Personal information",
        items: ["Personal information is handled under the Privacy Policy."],
      },
      {
        title: "10. Disputes and jurisdiction",
        items: [
          "If a dispute arises, please contact us first at {email}; the Operator will discuss it in good faith.",
          "If it is not resolved, you may apply for mediation to the Korea Consumer Agency (1372) or the Content Dispute Resolution Committee.",
          "These terms are governed by the laws of the Republic of Korea, and lawsuits are brought in the competent court under the Korean Civil Procedure Act.",
          "If the Japanese or English translation differs from the Korean original, the Korean original prevails.",
        ],
      },
    ],
  },
};

export const LEGAL_DOCS: Record<Exclude<LegalPage, "privacy">, Docs> = {
  pricing: PRICING,
  terms: TERMS,
  refund: REFUND,
};
