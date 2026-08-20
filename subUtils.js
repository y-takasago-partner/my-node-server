'use strict';

const sgMail = require('@sendgrid/mail');                   // SendGrid 公式ライブラリ
sgMail.setApiKey(process.env.SENDGRID_API_KEY);             // SendGridのAPIキー（環境変数から取得）

// **** function メール送信 **********************
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

module.exports = { sendEMail };

