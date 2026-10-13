/*
 * 日次定時削除実行処理
 *   途中離脱のWeb申告データを削除します
 *   新規登録後、所定日数経過のWeb申告データを削除します
 *   新規登録後、所定日数経過のWeb相談データを削除します
 */

'use strict';

// ★送信メールの件名に付けるプレフィックス
//const sbjPreFix = '';                                       // 運用
const sbjPreFix = '【開発】';                             // テスト時
const subDomain = 'https://jueaogoxsa02.cybozu.com';        // kintone サブドメイン
const KINTONE_BASE_URL = 'https://jueaogoxsa02.cybozu.com/k/';

// *********************************************************
// ☆ Render 定期削除実行用
// *********************************************************

const cron = require('node-cron');
const {KintoneRestAPIClient} = require('@kintone/rest-api-client');

const apiTokenJishuku = process.env.KINTONE_API_KEY_DEV;          // ★kintone 貸付自粛Web申告 APIトークン
const apiTokenSoudan = process.env.KINTONE_API_KEY_SODAN_DEV;     // ★kintone Web相談 APIトークン
const JishukuAppID = 26;                                // ★アプリID
const SoudanAppID = 28;                                 // ★アプリID

const express = require('express');
const app = express();

// kintoneクライアントの初期化
const clientJ = new KintoneRestAPIClient({
    baseUrl: subDomain,
    auth: { apiToken: apiTokenJishuku }                       // Web申告用kintoneアプリのAPIトークン
});

const clientS = new KintoneRestAPIClient({
    baseUrl: subDomain,
    auth: { apiToken: apiTokenSoudan },
});

// 配列を100件ずつに分割するヘルパー関数
const chunk = (array, size) => {
  return Array.from({ length: Math.ceil(array.length / size) }, (v, i) =>
    array.slice(i * size, i * size + size)
  );
};

// 実際の削除処理を行う関数
async function deleteOldRecords() {
  if (!JishukuAppID) {
    console.error('【kintone】エラー: JishukuAppID が設定されていません。');
    return;
  }
  try {
    console.log('【kintone】11日以上経過したレコードの取得を開始します...');

    // 1. 条件に合うレコードを取得（最大500件まで一括取得対応）
    const getResp = await clientJ.record.getRecords({
      app: JishukuAppID,
      query: 'Created < FROM_TODAY(-10, DAYS) order by 作成日時 asc limit 500',
      fields: ['\$id'],
    });

    const records = getResp.records;
    console.log(`【kintone】該当レコード数: ${records.length} 件`);
    if (records.length === 0) {
      console.log('【kintone】削除対象のレコードはありません。');
      return;
    }

    const allIds = records.map((record) => record.$id.value);

    // 2. API上限の100件ずつに分割してループ処理
    const idChunks = chunk(allIds, 100);
    console.log(`【kintone】削除処理を ${idChunks.length} 回に分けて実行します。`);
    for (let i = 0; i < idChunks.length; i++) {
      const currentChunk = idChunks[i];
      console.log(`【kintone】[${i + 1}/${idChunks.length}] ${currentChunk.length}件を削除中...`);
      //await clientJ.record.deleteRecords({
      //  app: JishukuAppID,
      //  ids: currentChunk,
      //});
      // 複数回APIを叩く場合は負荷軽減のために1秒待機
      if (idChunks.length > 1 && i < idChunks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    console.log('【kintone】古いデータの自動削除が正常に完了しました。');
  } catch (err) {
    console.error('【kintone】レコード削除処理でエラーが発生しました:', err);
  }
}


// ==========================================
// 定期削除実行（Cronタスク）の処理
// ==========================================
//const subCronDeleteJob_dev = (scheduleTime = '0 19 * * *') => {
const subCronDeleteJob_dev = (scheduleTime = '38 17 * * *') => {
  cron.schedule(scheduleTime, async () => {
    console.log('定期削除実行タスクを開始します...');
    // 実際の非同期処理をここに記述
    deleteOldRecords();
  }, {
      scheduled: true,
      timezone: "Asia/Tokyo"
  });
};



module.exports = { subCronDeleteJob_dev };
