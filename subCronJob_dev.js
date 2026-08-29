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
const subCronJob_dev = (scheduleTime = '32 19 * * *') => {
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
        const dateFormattedJ = [
            '西暦', d.getFullYear(), '年',
            String(d.getMonth() + 1).padStart(2, '0'), '月',
            String(d.getDate()).padStart(2, '0'), '日' 
        ].join('');
        const dateTimeFormattedJ = [
            d.getFullYear(), '年',
            String(d.getMonth() + 1).padStart(2, '0'), '月',
            String(d.getDate()).padStart(2, '0'), '日', 
            String(d.getHours()).padStart(2, '0'), '時',
            String(d.getMinutes()).padStart(2, '0'), '分',
        ].join('');
console.log('dateFormatted is ' + dateFormatted);
console.log('dateFormattedJ is ' + dateFormattedJ);
console.log('dateTimeFormattedJ is ' + dateTimeFormattedJ);
        // 1. kintoneから送信対象レコードを取得する（① or ②）
        // クエリ条件: ①送信日 EmailDeliv_DateSen が本日日付、かつ送信結果 EmailDeliv_Result が空白
        // クエリ条件: ②再送チェックボックス EmailDeliv_Resend がチェック、かつ再送完了日 EmailDeliv_Resend_CompletedDate が空白
//        const query = 
//            'email is not "" and ' + 
//            '  ( ' + 
//            '    (EmailDeliv_Delivery in ("する") and ProcStatus in ("受理","不受理（不備あり）","不受理") and EmailDeliv_DateSent = "") or ' + 
//            '    (EmailDeliv_Resend in ("する") and ProcStatus in ("受理","不受理（不備あり）","不受理") and EmailDeliv_Resend_CompletedDate = "") ' + 
//            '  ) ' + 
//            ' limit 100';
        const query = 
            'email is not "" ' + 
            ' limit 100';
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
            const status = record['ProcStatus'].value;
            const result = ( status === '受理') ? "受理" : (status === '不受理' || status === '不受理（不備あり）') ? "不受理" : "";
            if(!result) { continue; }   // 受理と不受理以外来ないはずだけど
            const mailAddress = record['email'].value;
            const shimei = record['Shimei_Sei'].value + '　' + record['Shimei_Mei'].value;
            const irai_no = record['IRAI_NO'].value + record['IRAI_NO_SUB'].value;
            const irai_cd = record['IRAI_CD'].value;
            const fubi1 = record['Fubi_1'].value;
            const fubi2 = record['Fubi_2'].value;
            const fubi3 = record['Fubi_3'].value;
            const fubi4 = record['Fubi_4'].value;
            const fubi5 = record['Fubi_5'].value;
            const bun = record['EmailDeliv_Body'].value;

console.log('recordId is '    + recordId);
console.log('mailAddress is ' + mailAddress);
console.log('result is '      + result);
console.log('shimei is '      + shimei);
console.log('申告番号 is '    + irai_no);
console.log('申告種別 is '    + irai_cd);
console.log('送信日付 is '    + record['EmailDeliv_DateSent'].value);
console.log('返信完了日 is '  + record['ReplyCompletedDate'].value);
console.log('送信結果 is '    + record['EmailDeliv_Result'].value);
console.log('再送 is '        + record['EmailDeliv_Resend'].value);
console.log('再送完了日 is '  + record['EmailDeliv_Resend_CompletedDate'].value);
console.log('不備１ is '  + record['Fubi_1'].value);
console.log('不備２ is '  + record['Fubi_2'].value);
console.log('不備３ is '  + record['Fubi_3'].value);
console.log('不備４ is '  + record['Fubi_4'].value);
console.log('不備５ is '  + record['Fubi_5'].value);
console.log('メール文 is '  + record['bun'].value);
            const fubi = 
                ((!fubi1 || fubi1.slice(0, 2) === "--") ? "" : fubi1 + '\n') + 
                ((!fubi2 || fubi2.slice(0, 2) === "--") ? "" : fubi2 + '\n') + 
                ((!fubi3 || fubi3.slice(0, 2) === "--") ? "" : fubi3 + '\n') + 
                ((!fubi4 || fubi4.slice(0, 2) === "--") ? "" : fubi4 + '\n') + 
                ((!fubi5 || fubi5.slice(0, 2) === "--") ? "" : fubi5 + '\n') + 
                (!bun ? "" : bun + '\n') ;
            const sbjPreFixResend = record['EmailDeliv_Resend'].value ? "" : "【再送】";
            const honbun_juri = 
                shimei + "様\n\n" + 
                "申告をいただきました貸付自粛（" + irai_cd + "申告）の処理が完了しましたので、\n" +
                "お知らせいたします。\n\n" +
                "１．受理日　　：" + dateFormattedJ + "\n" +
                "２．申告番号　：\n" + 
                "※訂正申告の際に必要となります。\n\n";
            const honbun_fujuri = 
                shimei + "様\n\n" + 
                "貸付自粛制度にご申告をいただきました" + irai_cd + "申告でございますが、受理することが\n" +
                "できませんでした。\n" +
                "恐れ入りますが、【不受理理由】を確認の上、改めてご申告いただきますよう、\n" +
                "お願い申し上げます。\n\n" +
                "受付処理日　　　:　" + dateFormattedJ + "\n\n" + 
                "【不受理理由】\n" +
                "★（1行目　不備確認欄で選択された理由を明記する/プルダウンで選択がない場合は空欄）\n" +
                "★（2行目　管理画面メール配信のメール文入力欄に記載があった場合は転記する）\n" ;
            const honbun_chui = 
                "≪注意事項－登録申告の場合≫\n" +
                "・登録情報の反映には、本メールの受信日の翌日から3営業日程度を要します。  \n" +
                "・貸付自粛情報は受理日から３か月が経過するまで撤回申告を行うことができません。\n" +
                "・登録情報(氏名・住所・連絡先)の訂正申告をする場合は、上記「申告番号」が必ず必要です。\n" +
                "　※申告番号が不明な場合は訂正申告の手続きはを行うことができません。\n" +
                "・貸付自粛情報は、個人信用情報機関への登録から5年間です。\n" +
                "・貸付自粛情報の登録後は、クレジット契約（ショッピングを含む）の利用に制限が生じる場合があります。\n" +
                "≪注意事項－撤回申告の場合≫\n" +
                "・登録情報の反映には、本メールの到着日の翌日から3営業日程度を要します。  \n" +
                " ≪注意事項－訂正申告の場合≫\n" +
                "・訂正情報の反映には、本メールの到着日の翌日から3営業日程度を要します。\n" +
                "・再度、登録情報(氏名・住所・連絡先)の訂正申告を行う場合は、上記「申告番号」が必ず必要です。\n" +
                "　 ※申告番号が不明な場合は訂正申告の手続きを行うことがはできません。\n\n";
            const honbun_info = 
                "【借金問題の相談先】\n" + 
                "○日本貸金業協会　℡0570-051-051　　https://www.j-fsa.or.jp\n" + 
                "※貸金業法に基づいて設立された自主規制機関。\n" + 
                "※貸金業に関連する借入・返済相談に対して、公正中立な立場から生活再建支援カウンセリングや家計管理の支援を\n" + 
                "　行います。（相談は無料です。）\n\n" + 
                "○法テラス（日本司法支援センター）℡0570-078-374    https://www.houterasu.or.jp/\n" + 
                "　　　　　　　　　　　　　　　　※国が設立した法的トラブル解決の総合案内所です。\n\n" + 
                "○日本弁護士連合会   ℡03-3580-9841   https://www.nichibenren.or.jp/legal_advice/search/center.html\n\n" + 
                "【保健・医療関係機関】\n" + 
                "　全国精神保健福祉センター       https://www.zmhwc.jp/centerlist.html\n\n" + 
                "【ギャンブル等依存症相談機関】\n" + 
                "○パチンコ・パチスロ\n" + 
                "　認定特定非営利活動法人・パチンコ依存問題相談機関\n" + 
                "　リカバリーサポート・ネットワーク  ℡050-3541-6420    http://rsn-sakura.jp/\n\n" + 
                "○公営競技　競馬・競輪・競艇・オートレース\n" + 
                "　公営競技ギャンブル依存症カウンセリングセンター    ℡0120-321-153     https://www.koeikyogi.jp/addiction/gcc.html\n\n" + 
                "○競艇\n" + 
                "　一般財団法人　ギャンブル依存症予防回復支援センター     ℡0120-683-705    http://www.gaprsc.or.jp/\n\n" ;
            const honbun_contact = 
                "【問合せ先】\n" + 
                "日本貸金業協会\n" + 
                "貸金業相談・紛争解決センター\n" + 
                "〒108-0074東京都港区高輪3丁目19番15号 \n" + 
                "TEL 03-5739-3861/050-3494-7988\n" ;
            const honbun = ((result==='受理') ? honbun_juri : honbun_fujuri) + honbun_chui + honbun_info + honbun_contact ;
            const msg = {
                to  :  mailAddress,                         // 宛先メールアドレス
                from: {
                  name : '日本貸金業協会　貸金業相談・紛争解決センター', // Fromの日本語表記
                  email: 'jisyuku_web@j-fsa.jp',            //From（SendGridで認証済みドメインのメールアドレス）
                },
                subject: sbjPreFix + sbjPreFixResend + '「日本貸金業協会」貸付自粛申告　' + result + 'のお知らせ', // 件名
                text: honbun,                               // 本文
            };
//            sendEMail(msg);
            // 3. 送信が成功したら、kintoneの該当レコードを「配信済」に更新する
// ★送信のテストが完了するまでコメントアウト
//            if(record['ReplyCompletedDate'].value === "") {
//                await kintoneClient.record.updateRecord({
//                    app: JishukuSendAppID,
//                    id: recordId,
//                    record: {
//                        ReplyCompletedDate: { value: dateTimeFormattedJ },
//                        EmailDeliv_Result: { value: '配信済' }
//                    }
//                });
//                console.log(`送信結果と返信処理完了日。`);
//            } else {
//                //再送にチェックのあるとき
//                await kintoneClient.record.updateRecord({
//                    app: JishukuSendAppID,
//                    id: recordId,
//                    record: {
//                        EmailDeliv_Resend_CompletedDate: { value: dateFormatted }
//                    }
//                });
//                console.log(`送信結果と返信処理完了日。`);
//            }
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
