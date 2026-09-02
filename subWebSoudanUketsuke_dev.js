'use strict';

const { sendEMail } = require('./subUtils.js');

// *********************************************************
// ☆ 共通
// *********************************************************

// ★送信メールの件名に付けるプレフィックス
//const sbjPreFix = '';                                     // 運用
const sbjPreFix = '【開発】';                             // テスト時

const sgMail = require('@sendgrid/mail');                   // SendGrid 公式ライブラリ
sgMail.setApiKey(process.env.SENDGRID_API_KEY);             // SendGridのAPIキー（環境変数から取得）

const subDomain = 'https://jueaogoxsa02.cybozu.com';        // ★kintone サブドメイン
const KINTONE_BASE_URL = 'https://jueaogoxsa02.cybozu.com/k/';

const appId = 28;                                           // ★kintone Web相談 アプリID（開発）
const apiToken = process.env.KINTONE_API_KEY_SODAN_DEV;     // ★kintone Web相談 APIトークン（開発）

const {KintoneRestAPIClient} = require('@kintone/rest-api-client');

// *********************************************************
// ☆ Zapier Webhook 用（新規Web相談登録時）
// *********************************************************

// ★宛先職員メールアドレス ***
const addrToSoudanStaff = 'y-takasago@go-partner.jp';   // 開発時

var client;


// **** Zapier-kintone Webhook受信エンドポイント ***********

const webSoudanUketsuke_dev = async (req, res) => {
    console.log('--- Webhook(dev)を受信しました ---');
    const webhookData = req.body;
    console.log(webhookData.レコード番号);
    console.log(webhookData.氏名);
    console.log(webhookData.メールアドレス);
    const honbun = 
        "(このメールは送信専用メールからお送りさせていただいております。ご返信いただいてもお答えできませんのでご注意ください。)\n\n" + 
        "日本貸金業協会貸金業相談・紛争解決センターです。ご相談を受付けました。\n" + 
        "受付日から３営業日以内に担当者からご連絡(050-3494-7988から発信)を差し上げますのでお待ちください。\n" + 
        "なお、このメールにお心当たりがない場合は、お手数ですが貸金業相談・紛争解決センターまでご連絡ください。\n\n\n" + 
        "※上記受付日とは、協会の通信機器がメールを受信した日とします。\n" + 
        "※営業日とは、土曜日、日曜日、祝休日、年末年始休業日を除いた日をいいます。\n\n\n\n" + 
        "【例】\n" + 
        "受付日が月曜日の場合は、３営業日目の木曜日までにご連絡します。\n" + 
        "※受付日が金曜日だった場合は、土曜日、日曜日を除き、翌週の水曜日が３営業日目となります。\n\n\n\n" + 
        "【ご連絡先】\n" + 
        "日本貸金業協会\n" + 
        "貸金業相談・紛争解決センター\n" + 
        "〒108-0074東京都港区高輪3-19-15 二葉高輪ビル2階\n" + 
        "TEL 03-5739-3861/050-3494-7988 FAX 03-5739-3024\n";
    const msg = {
        to  :  webhookData.メールアドレス,       // 宛先メールアドレス
        from: {
          name : '日本貸金業協会　貸金業相談・紛争解決センター', // Fromの日本語表記
          email: 'noreplywebjfsa@j-fsa.jp',      //From（SendGridで認証済みドメインのメールアドレス）
        },
        subject: sbjPreFix + 'ご相談受付けの件', // 件名
        text: honbun,                            // 本文
        html: honbun.replaceAll("\n", "<br>")    // HTML本文
    };
    const honbun2 = 
        "WEB相談受付がありました。\n" + 
        "下記URLからログインし、内容の確認をお願いします。\n\n" + 
        KINTONE_BASE_URL + appId + '/show#record=' + webhookData.レコード番号 + '\n';
    const msg2 = {
        to  :  addrToSoudanStaff,                // 宛先メールアドレス
        from:  'soudan@j-fsa.jp',                //From（SendGridで認証済みドメインのメールアドレス）
        subject: sbjPreFix + '相談受付の件',     // 件名
        text: honbun2 + '\n',                    // 本文
        html: honbun2.replaceAll("\n", "<br>")   // HTML本文
    };
    try {
        res.status(200).send('Webhook received successfully');

        // ******** kintoneデータにアクセス ********
        client = new KintoneRestAPIClient({
            baseUrl: subDomain,
            auth: {
                apiToken: apiToken
            }
        });
console.log(client);

        //******** kintone NO 取得 start ********
        const response2 = await client.record.getRecords({
            app: appId,
            fields: ['NO'],
            // 6桁の数字のみで構成されているレコードを想定
            query: `${'NO'} != "" order by ${'NO'} desc limit 1`
        });
        var nextStr = "";
        if (response2.records.length === 0) {
            nextStr = '3001';
            console.log('レコードがありません。最初の番号:', nextStr);
        } else {
            const maxStr = response2.records[0]['NO'].value;
            const nextNum = Number(maxStr) + 1;
            nextStr = String(nextNum);
            console.log(`現在の最大値: ${maxStr} -> 次の採番: ${nextStr}`);
        }
        //******** kintoneNO取得 end ********
        //******** kintoneデータ更新 ********
        const updtResult = await client.record.updateRecord({
            app: appId,                        // アプリID
            id: webhookData.レコード番号,      // ここにレコード番号（$id）を指定
            record: {
                'NO': {     // NO
                    value: `${nextStr}`
                }
            }
        });
        console.log('更新しました');
        //******** kintoneデータ更新 End ********

        sendEMail(msg);
        sendEMail(msg2);
    } catch (error) {
        console.error('Webhook処理エラー:', error);
        res.status(500).send('Internal Server Error');
    }
};

module.exports = { webSoudanUketsuke_dev };

