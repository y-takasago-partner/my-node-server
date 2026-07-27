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
const subDomain = 'https://jueaogoxsa02.cybozu.com';        // サブドメイン
const apiToken = process.env.KINTONE_API_KEY;               // APIトークン
const appId = 26;                                           // アプリID
const cors = require('cors');
const {KintoneRestAPIClient} = require('@kintone/rest-api-client');
const WebShinkoku = 'https://jueaogoxsa02.cybozu.com/k/';   // URLの先頭

// *** Web相談
const webSoudanAppId = '28';
const webSoudanUrl = 'https://jueaogoxsa02.cybozu.com/k/';   // URLの先頭

const express = require('express');
const app = express();

const crypto = require('crypto');
const algorithm = 'aes-256-ctr';

const path = require('path');

app.use(express.urlencoded({ extended: true }));            // PIC組織設定のコンテンツタイプ「application/x-www-form-urlencoded」に対応
app.use(express.json());
app.use(express.static('public'));                          // PDFファイルへの外部リンクアクセス用
app.use(express.static(path.join(__dirname, 'public')));    // public フォルダ内の HTML, CSS, 画像などをアクセス可能にする

var client;

// **** PIC Webhook受信エンドポイント
app.post('/webhook/', async (req, res) => {
    console.log('--- Webhookを受信しました ---');
    const webhookData = req.body;
    try {

        /******** 認証データ受取 ********/

        // 1. IV（初期化ベクトル）を16進数（hex）として確実にBufferに変換
        const ivStr = webhookData.iv || '02089f4b27dc6fd18dbb8d2cb55d251e';
        const iv = Buffer.from(ivStr, 'hex');

        // 2. 暗号化された「姓」と「生年月日」を取得
        // ※ ログに出力されていたデータ構造に合わせて確実に抽出します
        let keyEncrypted = '';
        let shubetsuEncrypted = '';
        let seiEncrypted = '';
        let meiEncrypted = '';
        let mailAddress = '';

        if (webhookData.bindKeys && webhookData.bindKeys[0]) {
            keyEncrypted = webhookData.bindKeys[0].value;
            shubetsuEncrypted = webhookData.bindKeys[1].value;
            seiEncrypted = webhookData.bindKeys[2].value;
            meiEncrypted = webhookData.bindKeys[3].value;
            mailAddress = webhookData.bindKeys[4].value;
        //} else {
        //    // 万が一undefinedの場合の、今回のテストデータ用セーフティ
        //    seiEncrypted = 'nt/aMsq8V55KNfrXwVm+m9DEd578NCrFUGzT';
        //    birthDayEncrypted = 'TGRQ6GUnhzHO5g==';
        }

        console.log(webhookData);

        console.log('更新キー: ' + keyEncrypted);
        console.log('申告種別: ' + shubetsuEncrypted);
        console.log('対象暗号(姓): ' + seiEncrypted);
        console.log('対象暗号(名): ' + meiEncrypted);
        console.log('メールアドレス: ' + mailAddress);

        // 3. 【最重要修正】マニュアル準拠のキー切り出し方式に戻します
        // 環境変数 SHOWCASE_KEY の先頭32文字を正確にBuffer化します
//        const keyBuffer = Buffer.from(scKey.substring(0, 32), 'utf8');
//
//        // 4. アルゴリズム（AES-256-CTR）
//        const algorithm = 'aes-256-ctr';
//
//        // 5. 姓（sei）の復号
//        const decipher = crypto.createDecipheriv(algorithm, keyBuffer, iv);
//        // 送られてきたBase64形式を、utf8（日本語文字列）にデコード
//        let decryptedSei = decipher.update(seiEncrypted, 'base64', 'utf8');
//        decryptedSei += decipher.final('utf8');
//        
//        console.log('★復号成功（姓）:', decryptedSei);
//
//        // ----------------------------------------
//        // 6. 生年月日の復号
//        // ----------------------------------------
//        //const decipherBirth = crypto.createDecipheriv(algorithm, keyBuffer, iv);
//        //let decryptedBirth = decipher.update(birthDayEncrypted, 'base64', 'utf8');
//        //decryptedBirth += decipher.final('utf8');
//        
//        //console.log('★復号成功（生年月日）:', decryptedBirth);
//        // ----------------------------------------
//
        // その他データのログ出力
        //console.log('result is: ' + (webhookData.result || 'データなし'));
        console.log('result is: ' + (webhookData.result));
        console.log('operation is: ' + (webhookData.operation));
        console.log('authType is: ' + (webhookData.authType));
        console.log(webhookData);

        res.status(200).send('Webhook received successfully');

        /******** kintoneデータ更新 ********/
        // kintone クライアントの作成
        client = new KintoneRestAPIClient({
            baseUrl: subDomain,
            auth: {
                apiToken: apiToken
            }
        });
        const updtResult = await client.record.updateRecord({
            app: appId,                 // アプリID
            updateKey: {
               field: '更新キー',       // Field code with "Prohibit duplicate values" checked
               value: keyEncrypted      // The unique value to search for
            },
            record: {
                'cidNo': {              // kintone側のフィールドコード
                    value: webhookData.cidNo
                },
                '認証結果': {           // 認証結果
                    value: webhookData.result
                }
            }
        });
        console.log('更新しました');

        /******** メール送信 ********/
        const WebShinkoku_honbun = 
            seiEncrypted + " " + meiEncrypted + "様\n\n\n" + 
            "貸付自粛の" + shubetsuEncrypted + "申告を受け付けました。\n" + 
            "なお、申告の結果(受理・不受理)については、メールにて連絡いたします。\n\n" + 
            "(協会からの連絡)\n" + 
            "申告内容について確認する点がある場合、相談センター「 050-3494-7990 」より連絡いたします。\n" + 
            "お仕事中などで電話を受けられない場合は、折り返しの電話連絡をお願いします。\n\n" + 
            "(不受理について)\n" + 
            "以下の場合は、不受理となりますので、ご注意ください。\n" + 
            "・申告事項に不備がある場合\n" + 
            "・本人確認の画像が不鮮明な場合\n\n" + 
            "不受理となり再度申告を希望される場合は、不受理理由を確認のうえ内容を補正いただき、\n" + 
            "改めて申告をお願いします。\n\n" + 
            "※このメールアドレスは送信専用です。\n" + 
            "このメールアドレスに返信されても対応いたしかねますので、あらかじめご了承ください。\n\n\n\n" + 
            "【問合せ先】\n" + 
            "日本貸金業協会\n" + 
            "貸金業相談・紛争解決センター\n" + 
            "〒108-0074東京都港区高輪3丁目19番15号 \n" + 
            "TEL 03-5739-3861/050-3494-7988\n" ;
        const msg = {
            to  :  mailAddress,                   // 宛先メールアドレス
            from: {
              name : '日本貸金業協会　貸金業相談・紛争解決センター', // Fromの日本語表記
              email: 'jisyuku_web@j-fsa.jp',      //From（SendGridで認証済みドメインのメールアドレス）
            },
            subject: '【テスト】「日本貸金業協会」貸付自粛申告　受付のお知らせ', // 件名
            text: WebShinkoku_honbun,                // 本文
        };
        const url2 = 'URLをクリックしてください\n' + WebShinkoku + appId + '/show#record=' + keyEncrypted + '&mode=edit';
        const msg2 = {
          //to  :  'jisyuku_web@j-fsa.jp'          // 宛先メールアドレス
            to  :  'y-takasago_j03@go-partner.jp', // テスト用宛先メールアドレス
            from:  'jisyuku_web@j-fsa.jp',         //From（SendGridで認証済みドメインのメールアドレス）
            subject: '【テスト】' + shubetsuEncrypted + '申告がありました',     // 件名
            text: url2 + '\n',                     // 本文
        };
        sendEMail(msg);
        sendEMail(msg2);

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
    const url2 = 'URLをクリックしてください\n' + webSoudanUrl + webSoudanAppId + '/show#record=' + webhookData.レコード番号 + '&mode=edit';
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
