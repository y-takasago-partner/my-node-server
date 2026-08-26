'use strict';

const { sendEMail } = require('./subUtils.js');             // 他ファイル読込

// ★送信メールの件名に付けるプレフィックス
//const sbjPreFix = '';                                       // 運用
const sbjPreFix = '【開発】';                             // テスト時
const subDomain = 'https://jueaogoxsa02.cybozu.com';        // kintone サブドメイン
const KINTONE_BASE_URL = 'https://jueaogoxsa02.cybozu.com/k/';

// *********************************************************
// ☆ Render 定期実行用
// *********************************************************

const cron = require('node-cron');
const apiToken_send = process.env.KINTONE_API_KEY_DEV;      // ★kintone 貸付自粛Web申告 APIトークン

const {KintoneRestAPIClient} = require('@kintone/rest-api-client');
const kintoneClient = new KintoneRestAPIClient({
    baseUrl: subDomain,
    auth: { apiToken: apiToken_send }                       // 送信用kintoneアプリのAPIトークン
});
console.log('APIキー：' + apiToken_send);
const JishukuSendAppID = 26;                                // ★コピー先アプリBのアプリID


const express = require('express');
const app = express();

app.use(express.urlencoded({ extended: true }));            // PIC組織設定のコンテンツタイプ「application/x-www-form-urlencoded」に対応
app.use(express.json());
app.use(express.static('public'));                          // PDFファイルへの外部リンクアクセス用



// ==========================================
// 定期実行（Cronタスク）の処理
// ==========================================
//const subCronJob_dev = (scheduleTime = '0 19 * * *') => {
const subCronJob_dev = (scheduleTime = '15 04 * * *') => {
  cron.schedule(scheduleTime, async () => {
    console.log('定期実行タスクを開始します...');
    // 実際の非同期処理をここに記述
    try {
        // 本日日付と現在日時
        const d = new Date();
        const dateFormatted = [
            d.getFullYear(),
            String(d.getMonth() + 1).padStart(2, '0'),
            String(d.getDate()).padStart(2, '0')
        ].join('/');
        const dateTimeFormatted = [
            d.getFullYear(),
            '年',
            String(d.getMonth() + 1).padStart(2, '0'),
            '月',
            String(d.getDate()).padStart(2, '0'),
            '日 ',
            String(d.getHours()).padStart(2, '0'),
            '時',
            String(d.getMinutes()).padStart(2, '0'),
            '分',
        ].join('');
        // 1. kintoneから送信対象レコードを取得する
        // クエリ条件: ①送信日 EmailDeliv_DateSen が本日日付、かつ送信結果 EmailDeliv_Result が空白
        // クエリ条件: ②再送チェックボックス EmailDeliv_Resend がチェック、かつ再送完了日 EmailDeliv_Resend_CompletedDate が空白
        const query = 
            'email != "" and ' + 
            '  ( ' + 
            '    (EmailDeliv_DateSent = "' + dateFormatted + '" and EmailDeliv_Result = "") or ' + 
            '    (EmailDeliv_Resend in ("する") and EmailDeliv_Resend_CompletedDate = "") ' + 
            '  ) ' + 
            ' limit 10';
console.log(query);
        const response = await kintoneClient.record.getRecords({
            app: JishukuSendAppID,
            query: query
        });
        const records = response.records;
        console.log(`未送信のレコードが ${records.length} 件見つかりました。`);
        if (records.length === 0) return;
        // 2. 1件ずつメールを送信し、kintoneのステータスを更新する
        for (const record of records) {
            const recordId = record.$id.value;
            const mailAddress = record['email'].value;
            const shimei = record['Shimei_Sei'].value + '　' + record['Shimei_Mei'].value;

console.log('◆送信対象は...');
console.log('recordId is ' + recordId);
console.log('mailAddress is ' + mailAddress);
console.log('shimei is ' + shimei);
console.log('送信日付 is ' + record['EmailDeliv_DateSent'].value);
console.log('送信結果 is ' + record['EmailDeliv_Result'].value);
console.log('再送 is ' + record['EmailDeliv_Resend'].value);
console.log('再送日付 is ' + record['EmailDeliv_Resend_CompletedDate'].value);


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
//            sendEMail(msg);
            // 3. 送信が成功したら、kintoneの該当レコードを「送信済」に更新する
            if(record['ReplyCompletedDate'].value === "") {
                await kintoneClient.record.updateRecord({
                    app: JishukuSendAppID,
                    id: recordId,
                    record: {
                        ReplyCompletedDate: { value: dateTimeFormatted },
                        EmailDeliv_Result: { value: '配信済' }
                    }
                });
                console.log(`送信結果と返信処理完了日。`);
            } else {
                //再送にチェックのあるとき
                await kintoneClient.record.updateRecord({
                    app: JishukuSendAppID,
                    id: recordId,
                    record: {
                        EmailDeliv_Resend_CompletedDate: { value: dateFormatted }
                    }
                });
                console.log(`送信結果と返信処理完了日。`);
            }
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

// ==========================================
// 貸付自粛Web申告画面保存成功時の処理⇒送信ボタン押下時に変更
// ==========================================
const jishukuSend2_dev = async (req, res) => {
    console.log('--- 貸付自粛Web申告保存処理から受信しました ---');
    const recordId = req.body.record_id;
    if (!recordId) {
        return res.status(400).json({ error: 'record_id is required' });
    }
    console.log(`kintoneからレコード保存通知を受信しました。レコード番号: ${recordId}`);
    res.status(200).send('Webhook received successfully');
    try {
        const result = await kintoneClient.record.getRecord({
            app: JishukuSendAppID,
            id: recordId
        });
        const record = result.record;
//        console.log('取得したレコードデータ:', record);
//        sendEMail(msg);
//        sendEMail(msg2);
    } catch (error) {
        console.error('Webhook処理エラー:', error);
        res.status(500).send('Internal Server Error');
    }
};

module.exports = { subCronJob_dev, jishukuSend2_dev };
