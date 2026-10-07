'use strict';

const { EventWebhook, EventWebhookHeader } = require('@sendgrid/eventwebhook');
const PUBLIC_KEY = process.env.SENDGRID_PUBLIC_KEY; 

const subDomain = 'https://jueaogoxsa02.cybozu.com';            // ★kintone サブドメイン
const apiToken = process.env.KINTONE_API_KEY_DEV;           // ★kintone 貸付自粛Web申告 APIトークン
const {KintoneRestAPIClient} = require('@kintone/rest-api-client');

const appId = 6;                                            // ★kintone 貸付自粛Web申告 アプリID
const appId_dev = 26;                                       // ★kintone 貸付自粛Web申告 アプリID（開発）

const rcvSendGridBounce = async (req, res) => {
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const signature = req.headers['x-twilio-email-event-webhook-signature'];
    const timestamp = req.headers['x-twilio-email-event-webhook-timestamp'];

    try {
        // 署名の検証
        const eh = new EventWebhook();
        const key = eh.convertPublicKeyToECDSA(PUBLIC_KEY);
        const isValid = eh.verifySignature(key, rawBody, signature, timestamp);
        if (!isValid) {
            console.log('invalid signature!');
            return res.status(200).send('Invalid signature'); // 重複防止のため200を返す
        }
        // 検証成功後に初めてオブジェクト（配列）に変換する
        const events = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        // イベントの処理
        if (Array.isArray(events)) {
            for (const event of events) {
                // 未達イベント（bounce または dropped）をフィルタリング
                if (event.event === 'bounce' || event.event === 'dropped') {
                    console.log(`未達検知: [${event.event}] ${event.email} - 理由: ${event.reason}`);
                    console.log(`kintoneアプリ番号: ${event.appliId}`);
                    console.log(`kintoneレコード番号: ${event.recordNo}`);
                    if (event.appliId == appId || event.appliId == appId_dev) {

                        // kintone クライアントの作成
                        client = new KintoneRestAPIClient({
                            baseUrl: subDomain,
                            auth: {
                                apiToken: apiToken
                            }
                        });

                        //******** kintoneデータ更新 ********
                        const updtResult = await client.record.updateRecord({
                            app: event.appliId,             // アプリID
                            id: event.recordNo,             // ここにレコード番号（$id）を指定
                            record: {
                                'EmailDeliv_Error': {       // エラー情報項目
                                    value: '未達:' + event.event + ', 理由:' + event.reason
                                }
                            }
                        });
                        console.log('更新しました');
                        //******** kintoneデータ更新 End ********

                    } else {
                        console.log('貸付自粛アプリ以外の配信なので処理対象外');
                    }
                }
            }
        }
        
        // SendGridに正常受信（200 OK）を返す
        res.status(200).send('OK');
    } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).send('Internal Server Error');
    }
};

module.exports = { rcvSendGridBounce };
