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
const apiTokenSoudan  = process.env.KINTONE_API_KEY_SODAN_DEV;     // ★kintone Web相談 APIトークン
const apiTokenLog     = process.env.KINTONE_API_KEY_DELLOG_DEV;     // ★kintone Web相談 APIトークン
const JishukuAppID = 26;                                // ★アプリID
const SoudanAppID = 28;                                 // ★アプリID
const LogAppID = 42;                                    // ★アプリID

const express = require('express');
const app = express();

// kintoneクライアントの初期化
const jClient = new KintoneRestAPIClient({
    baseUrl: subDomain,
    auth: { apiToken: apiTokenJishuku }                       // Web申告用kintoneアプリのAPIトークン
});

const sClient = new KintoneRestAPIClient({
    baseUrl: subDomain,
    auth: { apiToken: apiTokenSoudan },
});

const logClient = new KintoneRestAPIClient({
    baseUrl: subDomain,
    auth: { apiToken: apiTokenSoudan },
});

// 削除およびログ記録を行う関数（最大100件限定）
async function deleteOldRecordsWithLog() {
  const appId = process.env.KINTONE_APP_ID;
  const logAppId = process.env.LOG_APP_ID;

  if (!appId || !logAppId) {
    console.error('【kintone】エラー: KINTONE_APP_ID または LOG_APP_ID が設定されていません。');
    return;
  }

  try {
    console.log('【kintone】11日以上経過したレコードの取得を開始します（最大100件）...');

    // 1. 条件に合うレコードを取得（最大100件に制限）
    const getResp = await sClient.record.getRecords({
      app: appId,
      query: '作成日時 < FROM_TODAY(-10, DAYS) order by 作成日時 asc limit 100',
      fields: ['$id'],
    });

    const records = getResp.records;
    console.log(`【kintone】該当レコード数: ${records.length} 件`);

    if (records.length === 0) {
      console.log('【kintone】削除対象のレコードはありません。');
      return;
    }

    // レコードIDの配列を作成
    const ids = records.map((record) => record.$id.value);

    // 2. ログアプリへの一括登録用データを作成
    const logRecords = ids.map((id) => ({
      app_id: { value: appId },
      deleted_id: { value: id.toString() }
    }));

    // 3. ログアプリへ書き込み
    await logClient.record.addRecords({
      app: logAppId,
      records: logRecords,
    });
    console.log(`【kintone】${logRecords.length}件のログ書き込みが成功しました。`);

    // 4. 本番アプリから一括削除
    await sClient.record.deleteRecords({
      app: appId,
      ids: ids,
    });
    console.log(`【kintone】${ids.length}件のレコード削除が成功しました。`);

  } catch (err) {
    console.error('【kintone】エラーが発生しました:', err);
  }
}


// ==========================================
// 定期削除実行（Cronタスク）の処理
// ==========================================
//const subCronDeleteJob_dev = (scheduleTime = '0 19 * * *') => {
const subCronDeleteJob_dev = (scheduleTime = '41 17 * * *') => {
  cron.schedule(scheduleTime, async () => {
    console.log('【定期実行】スケジュール時刻になりました。処理を開始します。');
    deleteOldRecordsWithLog();
  }, {
      scheduled: true,
      timezone: "Asia/Tokyo"
  });
};



module.exports = { subCronDeleteJob_dev };
