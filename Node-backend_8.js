'use strict';

const express = require('express');
const app = express();

//定期実行
const cron = require('node-cron');
const JishukuSendAppID = 36; // コピー先アプリBのアプリID

app.use(express.urlencoded({ extended: true }));            // PIC組織設定のコンテンツタイプ「application/x-www-form-urlencoded」に対応
app.use(express.json());
app.use(express.static('public'));                          // PDFファイルへの外部リンクアクセス用

// ==========================================
// 定期実行（Cronタスク）の処理
// ==========================================
//cron.schedule('0 19 * * *', async () => {
cron.schedule('50 19 * * *', async () => {
    console.log('定期タスクを開始します...');
    try {
        console.log('定期タスクが完了しました。');
    } catch (error) {
        console.error('定期タスク中にエラーが発生しました:', error);
    }
}, {
    scheduled: true,
    timezone: "Asia/Tokyo"
});

// dummy
app.post('/webhook/', async (req, res) => {
    console.log('--- Webhookを受信しました ---');
    const webhookData = req.body;
    try {
        res.status(200).send('Webhook received successfully');
    } catch (error) {
        console.error('Webhook処理エラー:', error);
        res.status(500).send('Internal Server Error');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
