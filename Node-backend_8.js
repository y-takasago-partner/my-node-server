'use strict';

/*
 * 概要
 * １．PIC Webhook（貸付自粛Web申告認証完了時）
 * ２．Zapier Webhook（15分ごとにWeb相談）
 * ３．日次送信処理（毎日19時に）
 * ９．その他（サブフォルダに①貸付自粛Web申告の承諾事項PDF、②貸付自粛Web申告のThanksページとWeb相談のThanksページ）
 */

const { webSoudanUketsuke }     = require('./subWebSoudanUketsuke.js');
const { webSoudanUketsuke_dev } = require('./subWebSoudanUketsuke_dev.js');

const { picKanryou }            = require('./subPicKanryou.js');
//const { picKanryou_dev }        = require('./subPicKanryou_dev.js');

const { subCronJob }            = require('./subCronJob.js');
const { subCronJob_dev }        = require('./subCronJob_dev.js');

const express = require('express');
const app = express();

app.use(express.urlencoded({ extended: true }));            // PIC組織設定のコンテンツタイプ「application/x-www-form-urlencoded」に対応
app.use(express.json());
app.use(express.static('public'));                          // PDFファイルへの外部リンクアクセス用

var client;

// *********************************************************
// ☆ PIC Webhook 用（認証完了時）
// *********************************************************
app.post('/pic-webhook', picKanryou);           // 運用
app.post('/pic-webhook-dev', picKanryou_dev);   // 開発

/*
app.post('/webhook/', async (req, res) => {
});
*/

// =========================================================
// 新規相談受付 Zapier-kintone Webhook 受信エンドポイント
// =========================================================
app.post('/pic-webhook', webSoudanUketsuke);           // 運用
app.post('/pic-webhook-dev', webSoudanUketsuke_dev);   // 開発

// =========================================================
// 新規相談受付 Zapier-kintone Webhook 受信エンドポイント
// =========================================================
app.post('/kintone-webhook', webSoudanUketsuke);           // 運用
app.post('/kintone-webhook-dev', webSoudanUketsuke_dev);   // 開発

// ==========================================
// 定期実行（Cronタスク）の処理
// ==========================================

subCronJob();
subCronJob_dev();


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
