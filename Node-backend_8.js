'use strict';

/*
 * Webhookを試す
 * ついでに外部リンク用PDFも残す
 */

// *** SendGrid constant ***
const sgMail = require('@sendgrid/mail');                   // SendGrid 公式ライブラリ
sgMail.setApiKey(process.env.SENDGRID_API_KEY);             // SendGridのAPIキー（環境変数から取得）

// *** ProTeck ID Checker ***
const scKey = process.env.SHOWCASE_KEY;

// *** kintone constant ***
//const subDomain = 'https://jueaogoxsa02.cybozu.com';        // サブドメイン
//const apiToken = process.env.KINTONE_API_KEY;               // APIトークン
//const appId = 7;                                            // アプリID
//const cors = require('cors');
//const {KintoneRestAPIClient} = require('@kintone/rest-api-client');

// *** Web相談
const webSoudanAppId = '28';
const webSoudanUrl = 'https://jueaogoxsa02.cybozu.com/k/';   // URLの先頭

const express = require('express');
const app = express();

const crypto = require('crypto');
const algorithm = 'aes-256-ctr';

app.use(express.urlencoded({ extended: true }));    // PIC組織設定のコンテンツタイプ「application/x-www-form-urlencoded」に対応
app.use(express.json());
app.use(express.static('public'));      // PDFファイルへの外部リンクアクセス用

// **** PIC Webhook受信エンドポイント
app.post('/webhook/', async (req, res) => {
    console.log('here!');
    const webhookData = req.body;
    try {
        console.log('--- Webhookを受信しました ---');

        // 1. IV（初期化ベクトル）を16進数（hex）として確実にBufferに変換
        const ivStr = webhookData.iv || '02089f4b27dc6fd18dbb8d2cb55d251e';
        const iv = Buffer.from(ivStr, 'hex');

        // 2. 暗号化された「姓」と「生年月日」を取得
        // ※ ログに出力されていたデータ構造に合わせて確実に抽出します
        let seiEncrypted = '';
        let birthDayEncrypted = '';

        if (webhookData.bindKeys && webhookData.bindKeys[0]) {
            seiEncrypted = webhookData.bindKeys[0].value;
            birthDayEncrypted = webhookData.bindKeys[1].value;
        } else {
            // 万が一undefinedの場合の、今回のテストデータ用セーフティ
            seiEncrypted = 'nt/aMsq8V55KNfrXwVm+m9DEd578NCrFUGzT';
            birthDayEncrypted = 'TGRQ6GUnhzHO5g==';
        }

        console.log('対象暗号(姓): ' + seiEncrypted);
        console.log('対象暗号(生年月日): ' + birthDayEncrypted);

        // 3. 【最重要修正】マニュアル準拠のキー切り出し方式に戻します
        // 環境変数 SHOWCASE_KEY の先頭32文字を正確にBuffer化します
        const keyBuffer = Buffer.from(scKey.substring(0, 32), 'utf8');

        // 4. アルゴリズム（AES-256-CTR）
        const algorithm = 'aes-256-ctr';

        // ----------------------------------------
        // 5. 姓（sei）の復号
        // ----------------------------------------
        const decipherSei = crypto.createDecipheriv(algorithm, keyBuffer, iv);
        // 送られてきたBase64形式を、utf8（日本語文字列）にデコード
        let decryptedSei = decipherSei.update(seiEncrypted, 'base64', 'utf8');
        decryptedSei += decipherSei.final('utf8');
        
        console.log('★復号成功（姓）:', decryptedSei);

        // ----------------------------------------
        // 6. 生年月日の復号
        // ----------------------------------------
        const decipherBirth = crypto.createDecipheriv(algorithm, keyBuffer, iv);
        let decryptedBirth = decipherBirth.update(birthDayEncrypted, 'base64', 'utf8');
        decryptedBirth += decipherBirth.final('utf8');
        
        console.log('★復号成功（生年月日）:', decryptedBirth);
        // ----------------------------------------

        // その他データのログ出力
        //console.log('result is: ' + (webhookData.result || 'データなし'));
        console.log('result is: ' + (webhookData.result));
        console.log('operation is: ' + (webhookData.operation));
        console.log('authType is: ' + (webhookData.authType));
        console.log(webhookData);

        res.status(200).send('Webhook received successfully');
    } catch (error) {
        console.error('Webhook処理エラー:', error);
        res.status(500).send('Internal Server Error');
    }
});

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

// **** Zapier-kintone Webhook受信エンドポイント
app.post('/kintone-webhook/', async (req, res) => {
    //console.log('--- Webhookを受信しました ---');
    const webhookData = req.body;
    //console.log(webhookData);
    //console.log(webhookData.レコード番号);
    //console.log(webhookData.氏名);
    //console.log(webhookData.メールアドレス);
    const WebSoudan_honbun = 
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
        to  :  webhookData.メールアドレス,     // 宛先メールアドレス
        from: {
          name : '日本貸金業協会　貸金業相談・紛争解決センター', // Fromの日本語表記
          email: 'noreplywebjfsa@j-fsa.jp',    //From（SendGridで認証済みドメインのメールアドレス）
        },
        subject: '【テスト】ご相談受付けの件', // 件名
        text: WebSoudan_honbun,                // 本文
    };
    //const url2 = webSoudanUrl + webSoudanAppId + '/show#record=' + webhookData.レコード番号 + '&mode=edit';
    const url2 = webSoudanUrl + webSoudanAppId + '/show#record=&mode=edit';
    const msg2 = {
      //to  :  'soudan@j-fsa.jp'               // 宛先メールアドレス
        to  :  'y-takasago_j03@go-partner.jp', // テスト用宛先メールアドレス
        from:  'soudan@j-fsa.jp',              //From（SendGridで認証済みドメインのメールアドレス）
        subject: '【テスト】相談受付の件',     // 件名
        text: url2 + '\n',                     // 本文
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
