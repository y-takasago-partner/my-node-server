/*
 * 日次定時削除実行処理
 *   途中離脱のWeb申告データを削除します
 *   新規登録後、所定日数経過のWeb申告データを削除します
 *   新規登録後、所定日数経過のWeb相談データを削除します
 */

'use strict';

const subDomain = 'https://ixfxwyw51tb5.cybozu.com';            // kintone サブドメイン
const KINTONE_BASE_URL = 'https://ixfxwyw51tb5.cybozu.com/k/';

// *********************************************************
// ☆ Render 定期削除実行用
// *********************************************************

const cron = require('node-cron');
const {KintoneRestAPIClient} = require('@kintone/rest-api-client');

const apiTokenJishuku = process.env.KINTONE_API_KEY_K3;     // ★kintone 貸付自粛Web申告 APIトークン
const apiTokenSoudan  = process.env.KINTONE_API_KEY_SODAN;  // ★kintone Web相談 APIトークン
const apiTokenLog     = process.env.KINTONE_API_KEY_DELLOG; // ★kintone Web相談 APIトークン
const JishukuAppID = 6;                                     // ★アプリID
const SoudanAppID  = 8;                                     // ★アプリID
const LogAppID     = 12;                                    // ★アプリID

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
    auth: { apiToken: apiTokenLog },
});

// 削除およびログ記録を行う関数（最大100件限定）
// 削除およびログ記録を行う関数（最大100件限定）
async function deleteOldRecords() {
  try {
    console.log('【kintone】cidNoが空白かつ作成後1時間以上経過したレコードの取得を開始します...');

    // 現在時刻から「1時間前」を計算（ISO形式に変換してクエリに適用）
    const now = new Date();
    now.setHours(now.getHours() - 1); // 1時間前をセット

    // kintoneのAPIが認識できるISO8601形式（YYYY-MM-DDTHH:mm:ssZ）の文字列に変換
    // これにより、RenderサーバーのUTC時間基準で正確に1時間前がkintoneに伝わります
    const isoOneHourAgo = now.toISOString();

    // クエリ文字列の組み立て（不具合のあったFROM_TODAY関数を廃止し、確定した日時を指定）
    const queryStr = `cidNo = "" and Created < "${isoOneHourAgo}" order by Created asc limit 100`;
    console.log(`【デバッグ】実行クエリ: ${queryStr}`);

    // 1. 条件に合うレコードを取得（最大100件に制限）
    const getResp = await jClient.record.getRecords({
      app: JishukuAppID,
      query: queryStr,
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
      app_id: { value: JishukuAppID },
      削除レコード番号: { value: id.toString() },
      詳細: { value: '途中離脱データ' },
      アプリ名: { value: '貸付自粛Web申告' }
    }));

    // 3. ログアプリへ書き込み
    await logClient.record.addRecords({
      app: LogAppID,
      records: logRecords,
    });
    console.log(`【kintone】${logRecords.length}件のログ書き込みが成功しました。`);

    // 4. 本番アプリから一括削除
    await jClient.record.deleteRecords({
      app: JishukuAppID,
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
const subCronDeleteJob = (scheduleTime = '0 0 * * *') => {
//const subCronDeleteJob = (scheduleTime = '55 18 * * *') => {
  cron.schedule(scheduleTime, async () => {
    console.log('【定期実行】スケジュール時刻になりました。処理を開始します。');
    deleteOldRecords();
  }, {
      scheduled: true,
      timezone: "Asia/Tokyo"
  });
};



module.exports = { subCronDeleteJob };
