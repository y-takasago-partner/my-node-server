/*
 * 日次定時削除実行処理
 *   新規登録後、所定日数経過のWeb申告データを削除します
 *   新規登録後、所定日数経過のWeb相談データを削除します
 */

'use strict';

const subDomain = 'https://jueaogoxsa02.cybozu.com';        // kintone サブドメイン
const KINTONE_BASE_URL = 'https://jueaogoxsa02.cybozu.com/k/';

// *********************************************************
// ☆ Render 定期削除実行用
// *********************************************************

const cron = require('node-cron');
const {KintoneRestAPIClient} = require('@kintone/rest-api-client');

const HOKAN_DAYS = 14;                                  // ★15日目に削除

const apiTokenJishuku = process.env.KINTONE_API_KEY_DEV;          // ★kintone 貸付自粛Web申告 APIトークン
const apiTokenSoudan  = process.env.KINTONE_API_KEY_SODAN_DEV;    // ★kintone Web相談 APIトークン
const apiTokenLog     = process.env.KINTONE_API_KEY_DELLOG_DEV;   // ★kintone Web相談 APIトークン
const JishukuAppID = 26;                                // ★アプリID
const SoudanAppID = 28;                                 // ★アプリID
const LogAppID = 42;                                    // ★アプリID

const express = require('express');
const app = express();

// kintoneクライアントの初期化（貸付自粛Web申告）
const jClient = new KintoneRestAPIClient({
    baseUrl: subDomain,
    auth: { apiToken: apiTokenJishuku }                       // Web申告用kintoneアプリのAPIトークン
});
// kintoneクライアントの初期化（Web相談）
const sClient = new KintoneRestAPIClient({
    baseUrl: subDomain,
    auth: { apiToken: apiTokenSoudan },
});
// kintoneクライアントの初期化（削除ログ）
const logClient = new KintoneRestAPIClient({
    baseUrl: subDomain,
    auth: { apiToken: apiTokenLog },
});

// ==========================================
// 1. 相談アプリ用の一括削除関数
// ==========================================
async function deleteSoudanOldRecords() {
  try {
    console.log('【kintone: Web相談】作成後' + HOKAN_DAYS + '日が経過したレコードの取得を開始します...');

    const queryStr = `作成日時 < FROM_TODAY(-${HOKAN_DAYS}, DAYS) order by 作成日時 asc limit 100`;
    const getResp = await sClient.record.getRecords({
      app: SoudanAppID, 
      query: queryStr,
      fields: ['$id'],
    });

    const records = getResp.records;
    console.log(`【kintone: 相談】該当レコード数: ${records.length} 件`);
    if (records.length === 0) {
      console.log('【kintone: Web相談】削除対象のレコードはありません。');
      return;
    }

    const ids = records.map((record) => Number(record.$id.value));
    const logRecords = ids.map((id) => ({
      app_id: { value: SoudanAppID },
      削除レコード番号: { value: id.toString() },
      詳細: { value: '' + HOKAN_DAYS + '日間保管経過データ（相談）' }, 
      アプリ名: { value: 'Web相談' }
    }));

//    await logClient.record.addRecords({
//      app: LogAppID,
//      records: logRecords,
//    });
    console.log(`【kintone: 相談】${logRecords.length}件のログ書き込みが成功しました。`);

//    await sClient.record.deleteRecords({
//      app: SoudanAppID,
//      ids: ids,
//    });
    console.log(`【kintone: 相談】${ids.length}件のレコード削除が成功しました。`);

  } catch (err) {
    console.error('【kintone: Web相談】エラーが発生しました:', err);
  }
}

// ==========================================
// 2. 自粛アプリ用の一括削除関数（同様のロジック）
// ==========================================
async function deleteJishukuOldRecords() {
  try {
    console.log('【kintone: 貸付自粛Web申告】作成後' + HOKAN_DAYS + '日が経過したレコードの取得を開始します...');
    const queryStr = `Created < FROM_TODAY(-${HOKAN_DAYS}, DAYS) order by Created asc limit 100`;
    const getResp = await jClient.record.getRecords({
      app: JishukuAppID,
      query: queryStr,
      fields: ['$id'],
    });

    const records = getResp.records;
    console.log(`【kintone: 貸付自粛Web申告】該当レコード数: ${records.length} 件`);
    if (records.length === 0) {
      console.log('【kintone: 貸付自粛Web申告】削除対象のレコードはありません。');
      return;
    }

    const ids = records.map((record) => Number(record.$id.value));
    const logRecords = ids.map((id) => ({
      app_id: { value: JishukuAppID },
      削除レコード番号: { value: id.toString() },
      詳細: { value: '' + HOKAN_DAYS + '日間保管経過データ（貸付自粛Web申告）' }, 
      アプリ名: { value: '貸付自粛Web申告' }
    }));

//    await logClient.record.addRecords({
//      app: LogAppID,
//      records: logRecords,
//    });
    console.log(`【kintone: 自粛】${logRecords.length}件のログ書き込みが成功しました。`);

//    await jClient.record.deleteRecords({
//      app: JishukuAppID,
//      ids: ids,
//    });
    console.log(`【kintone: 自粛】${ids.length}件のレコード削除が成功しました。`);

  } catch (err) {
    console.error('【kintone: 自粛】エラーが発生しました:', err);
  }
}


// ==========================================
// 定期削除実行（Cronタスク）の処理
// ==========================================
//const subCronDeleteOldData_dev = (scheduleTime = '00 1 * * *') => {
const subCronDeleteOldData_dev = (scheduleTime = '6 14 * * *') => {
  cron.schedule(scheduleTime, async () => {
    console.log('【定期実行】スケジュール時刻（AM 1:00）になりました。連続処理を開始します。');
    console.log('--- 1. 相談レコード削除開始 ---');
    await deleteSoudanOldRecords();
    console.log('--- 2. 自粛レコード削除開始 ---');
    await deleteJishukuOldRecords();
    console.log('【定期実行】すべての連続処理が終了しました。');
  }, {
      scheduled: true,
      timezone: "Asia/Tokyo"
  });
};



module.exports = { subCronDeleteOldData_dev };
