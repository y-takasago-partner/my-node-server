'use strict';

const express = require('express');
const { EventWebhook, EventWebhookHeader } = require('@sendgrid/eventwebhook');

const app = express();
// 署名検証には生のBody（文字列）が必要なため、raw-bodyとして取得できるようにします
app.use(express.text({ type: 'application/json' }));

// SendGrid管理画面から取得した公開鍵
const PUBLIC_KEY = process.env.SENDGRID_PUBLIC_KEY; 

const rcvSendGridBounce = async (req, res) => {
    console.log('--- SendGrid Webhookを受信しました ---');

    const signature = req.get(EventWebhookHeader.SIGNATURE());
    const timestamp = req.get(EventWebhookHeader.TIMESTAMP());
    const payload = req.body; // 生の文字列データ

    try {
        // 1. 署名の検証
        const eh = new EventWebhook();
        const key = eh.convertPublicKeyToECDSA(PUBLIC_KEY);
        const isValid = eh.verifySignature(key, payload, signature, timestamp);

        if (!isValid) {
            return res.status(403).send('Invalid signature');
        }

        // 2. イベントの処理
        const events = JSON.parse(payload);
        for (const event of events) {
            // 未達イベント（bounce または dropped）をフィルタリング
            if (event.event === 'bounce' || event.event === 'dropped') {
                console.log(`未達検知: [${event.event}] ${event.email} - 理由: ${event.reason}`);
                // TODO: ここで自社システムのデータベース更新（配信停止フラグ立てなど）を行う
            }
        }

        // SendGridに正常受信（200 OK）を返す
        res.status(200).send('OK');

    } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = { rcvSendGridBounce };

