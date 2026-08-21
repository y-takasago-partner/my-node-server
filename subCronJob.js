'use strict';

const { sendEMail } = require('./subUtils.js');             // 他ファイル読込

// *********************************************************
// ☆ 共通
// *********************************************************

// ★送信メールの件名に付けるプレフィックス
//const sbjPreFix = '';                                       // 運用
const sbjPreFix = '【テスト】';                             // テスト時

const sgMail = require('@sendgrid/mail');                   // SendGrid 公式ライブラリ
sgMail.setApiKey(process.env.SENDGRID_API_KEY);             // SendGridのAPIキー（環境変数から取得）
const scKey = process.env.SHOWCASE_KEY;                     // ProTeck ID Checker キー
const subDomain = 'https://jueaogoxsa02.cybozu.com';        // kintone サブドメイン

const KINTONE_BASE_URL = 'https://jueaogoxsa02.cybozu.com/k/';


// *********************************************************
// ☆ Render 定期実行用
// *********************************************************

const cron = require('node-cron');
const apiToken_send = process.env.KINTONE_API_KEY_SEND;               // kintone 貸付自粛Web申告 APIトークン

const kintoneClient = new KintoneRestAPIClient({
    baseUrl: subDomain,
    auth: { apiToken: apiToken_send }                       // 送信用kintoneアプリのAPIトークン
});
console.log('APIキー：' + apiToken_send);
//
////const JishukuSendAppID = process.env.KINTONE_APP_ID; // コピー先アプリBのアプリID
const JishukuSendAppID = 36; // コピー先アプリBのアプリID


// *********************************************************

const express = require('express');
const app = express();

app.use(express.urlencoded({ extended: true }));            // PIC組織設定のコンテンツタイプ「application/x-www-form-urlencoded」に対応
app.use(express.json());
app.use(express.static('public'));                          // PDFファイルへの外部リンクアクセス用



// ==========================================
// 定期実行（Cronタスク）の処理
// ==========================================
//const startCronJob = (scheduleTime = '0 19 * * *') => {
const startCronJob = (scheduleTime = '03 11 * * *') => {
  cron.schedule(scheduleTime, async () => {
    console.log('定期実行タスクを開始します...');
    // 実際の非同期処理をここに記述
    try {
        // 1. kintoneから「まだメールを送信していないレコード」を取得する
        // クエリ条件: mail_status に「送信済」が含まれない
        const response = await kintoneClient.record.getRecords({
            app: JishukuSendAppID,
            query: 'email not in ("") limit 100'
        });
        const records = response.records;
        console.log(`未送信のレコードが ${records.length} 件見つかりました。`);
        if (records.length === 0) return;
        // 2. 1件ずつメールを送信し、kintoneのステータスを更新する
        for (const record of records) {
            const recordId = record.$id.value;
            const mailAddress = record['email'].value;
            const shimei = record['Shimei_Sei'].value + '　' + record['Shimei_Mei'].value;
console.log('recordId is ' + recordId);
console.log('mailAddress is ' + mailAddress);
console.log('shimei is ' + shimei);
            const honbun = 
                shimei + "様\n\n\n" + 
                "【問合せ先】\n" + 
                "日本貸金業協会\n" + 
                "貸金業相談・紛争解決センター\n" + 
                "〒108-0074東京都港区高輪3丁目19番15号 \n" + 
                "TEL 03-5739-3861/050-3494-7988\n" ;
            const msg = {
                to  :  mailAddress,                         // 宛先メールアドレス
                from: {
                  name : '日本貸金業協会　貸金業相談・紛争解決センター', // Fromの日本語表記
                  email: 'jisyuku_web@j-fsa.jp',            //From（SendGridで認証済みドメインのメールアドレス）
                },
                subject: sbjPreFix + '「日本貸金業協会」貸付自粛申告　受付のお知らせ', // 件名
                text: honbun,                               // 本文
            };
            sendEMail(msg);

//            const customerName = record['顧客名'] ? record['顧客名'].value : 'お客様';
//            const toEmail = record['メールアドレス'] ? record['メールアドレス'].value : null;
//            const detail = record['問い合わせ内容'] ? record['問い合わせ内容'].value : '内容なし';
//
//            if (!toEmail) {
//                console.log(`レコードID: ${recordId} はメールアドレスがないためスキップします。`);
//                continue;
//            }
//
//            // SendGridでメール送信
//            const msg = {
//                to: toEmail,
//                from: process.env.FROM_EMAIL,
//                subject: '【定期送信】お手続きのご案内',
//                text: `${customerName} 様\n\nお世話になっております。以下内容をご確認ください。\n\n---\n${detail}\n---`,
//            };
//
//            await sgMail.send(msg);
//            console.log(`メール送信成功: ${toEmail} 宛 (レコードID: ${recordId})`);
//
//            // 3. 送信が成功したら、kintoneの該当レコードを「送信済」に更新する
//            await kintoneClient.record.updateRecord({
//                app: JishukuSendAppID,
//                id: recordId,
//                record: {
//                    mail_status: { value: ['送信済'] }
//                }
//            });
//            console.log(`kintoneのステータスを送信済に更新しました。`);
      // await 処理など
        }
        console.log('定期タスクが完了しました。');
    } catch (error) {
        console.error('定期タスク中にエラーが発生しました:', error);
    }
  }, {
      scheduled: true,
      timezone: "Asia/Tokyo"
  });
};

module.exports = { subCronJob };

