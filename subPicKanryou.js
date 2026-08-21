'use strict';

const { sendEMail } = require('./subUtils.js');


// ★送信メールの件名に付けるプレフィックス
//const sbjPreFix = '';                                       // 運用
const sbjPreFix = '【テスト】';                             // テスト時

const sgMail = require('@sendgrid/mail');                   // SendGrid 公式ライブラリ
sgMail.setApiKey(process.env.SENDGRID_API_KEY);             // SendGridのAPIキー（環境変数から取得）

const scKey = process.env.SHOWCASE_KEY;                     // ProTeck ID Checker キー
const subDomain = 'https://jueaogoxsa02.cybozu.com';        // kintone サブドメイン
const KINTONE_BASE_URL = 'https://jueaogoxsa02.cybozu.com/k/';

// ★宛先職員メールアドレス
const addrToJishukuStaff = 'jisyuku_web@j-fsa.jp';          // 運用
//const addrToJishukuStaff = 'y-takasago_j03@go-partner.jp';  // 開発時

const appId = 33;                                           // kintone 貸付自粛Web申告 アプリID
const apiToken = process.env.KINTONE_API_KEY;               // kintone 貸付自粛Web申告 APIトークン
//const cors = require('cors');
const {KintoneRestAPIClient} = require('@kintone/rest-api-client');

const crypto = require('crypto');                           // 不要か
const algorithm = 'aes-256-ctr';                            // 不要か

const subPicKanryou = async (req, res) => {
    console.log('--- Webhookを受信しました ---');
    const webhookData = req.body;
    try {

        //******** 認証データ受取 ********

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
        } else {
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

        //******** kintoneデータにアクセス ********
        // kintone クライアントの作成
        client = new KintoneRestAPIClient({
            baseUrl: subDomain,
            auth: {
                apiToken: apiToken
            }
        });

        //******** kintoneレコード番号取得 ********
        const keyFieldCode = '更新キー';
        const response = await client.record.getRecords({
          app: appId,
          // 該当のキーに一致するレコードを検索するクエリ
          query: `${keyFieldCode} = "${keyEncrypted}"`,
          // 必要なフィールド（レコード番号）だけを指定して高速化
          fields: ['$id'] 
        });
        // レコードが見つかった場合の処理
        if (response.records.length > 0) {
          const recordId = response.records[0].$id.value;
          console.log(`レコード番号を取得しました: ${recordId}`);
        } else {
          console.log('一致するレコードが見つかりませんでした。');
          console.log('終了します。');
          return;
        }

        //******** kintoneデータ更新 ********
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

        //******** メール送信 ********
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
            subject: sbjPreFix + '「日本貸金業協会」貸付自粛申告　受付のお知らせ', // 件名
            text: WebShinkoku_honbun,                // 本文
        };
      //const url2 = 'URLをクリックしてください\n' + KINTONE_BASE_URL + appId + '/show#record=' + response.records[0].$id.value + '&mode=edit';
        const url2 = 'URLをクリックしてください\n' + KINTONE_BASE_URL + appId + '/show#record=' + response.records[0].$id.value;
        const msg2 = {
            to  :  addrToJishukuStaff,             // 宛先メールアドレス
            from:  'jisyuku_web@j-fsa.jp',         //From（SendGridで認証済みドメインのメールアドレス）
            subject: sbjPreFix + '' + shubetsuEncrypted + '申告がありました',     // 件名
            text: url2 + '\n',                     // 本文
        };
        sendEMail(msg);
        sendEMail(msg2);

    } catch (error) {
        console.error('Webhook処理エラー:', error);
        res.status(500).send('Internal Server Error');
    }
};

module.exports = { picKanryou };

