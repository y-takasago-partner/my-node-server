'use strict';

const sbjPreFix = '【テスト】';                             // テスト時

const sgMail = require('@sendgrid/mail');                   // SendGrid 公式ライブラリ
sgMail.setApiKey(process.env.SENDGRID_API_KEY);             // SendGridのAPIキー（環境変数から取得）
const KINTONE_BASE_URL = 'https://jueaogoxsa02.cybozu.com/k/';

// ★宛先職員メールアドレス ***
const addrToSoudanStaff = 'y-takasago_j03@go-partner.jp';   // 開発時
const webSoudanAppId = '28';                                // kintone Web相談 アプリID（APIトークンはZapierが保持ゆえ不要）

const express = require('express');
const app = express();

app.use(express.urlencoded({ extended: true }));            // PIC組織設定のコンテンツタイプ「application/x-www-form-urlencoded」に対応
app.use(express.json());
app.use(express.static('public'));                          // PDFファイルへの外部リンクアクセス用

// **** function メール送信 **********************
async function sendEMail(msg) {
  try {
    await sgMail.send(msg);
    console.log('メールが正常に送信されました（' + msg.subject + ', ' + msg.to + '）');
  } catch (error) {
    console.error('メール送信中にエラーが発生しました：');
    if (error.response) {
      console.error(error.response.body);
    }
  }
}

app.post('/kintone-webhook', async (req, res) => {
//app.post('/kintone-webhook-dev', async (req, res) => {
    console.log('--- kintone-webhook-dev を受信しました ---');
    const webhookData = req.body;
    const WebSoudan_honbun = 
        "(このメールは送信専用メールからお送りさせていただいております。ご返信いただいてもお答えできませんのでご注意ください。)\n\n" + 
        "TEL ********** FAX **********\n";
    const msg = {
        to  :  webhookData.メールアドレス,       // 宛先メールアドレス
        from: {
          name : '日本貸金業協会　貸金業相談・紛争解決センター', // Fromの日本語表記
          email: 'noreplywebjfsa@j-fsa.jp',      //From（SendGridで認証済みドメインのメールアドレス）
        },
        subject: sbjPreFix + 'ご相談受付けの件', // 件名
        text: WebSoudan_honbun,                  // 本文
    };
    const url2 = 'URLをクリックしてください\n' + KINTONE_BASE_URL + webSoudanAppId + '/show#record=' + webhookData.レコード番号;
    const msg2 = {
        to  :  addrToSoudanStaff,                // 宛先メールアドレス
        from:  'soudan@j-fsa.jp',                //From（SendGridで認証済みドメインのメールアドレス）
        subject: sbjPreFix + '相談受付の件',     // 件名
        text: url2 + '\n',                       // 本文
    };
    try {
        res.status(200).send('Webhook received successfully');
        sendEMail(msg);
        sendEMail(msg2);
    } catch (error) {
        console.error('Webhook処理エラー:', error);
        res.status(500).send('Internal Server Error');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
