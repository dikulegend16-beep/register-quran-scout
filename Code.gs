/**
 * Registration site backend for Google Apps Script.
 * Keep BOT_TOKEN and CHAT_ID in Project Settings > Script properties.
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('التسجيل | كشافة أبناء القرآن ورابطة خطى الشبابية')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function submitRegistration(data) {
  if (!data || typeof data !== 'object') throw new Error('Invalid request');

  // Basic spam trap. Real users should leave this field blank.
  if (String(data.website || '').trim()) throw new Error('SPAM');

  var type = String(data.type || '');
  if (type !== 'scout' && type !== 'khatta') throw new Error('نوع التسجيل غير صحيح');

  var name = cleanText_(data.name, 100);
  var age = Number(data.age);
  var phone = normalizePhone_(data.phone);
  var guardianPhone = normalizePhone_(data.guardianPhone || '');

  if (name.length < 3) throw new Error('الاسم غير صحيح');
  if (!Number.isInteger(age) || age < 5 || age > 60) throw new Error('العمر غير صحيح');
  if (!/^\+?\d{8,15}$/.test(phone)) throw new Error('رقم الهاتف غير صحيح');
  if (type === 'scout' && !/^\+?\d{8,15}$/.test(guardianPhone)) {
    throw new Error('رقم ولي الأمر غير صحيح');
  }

  // Reduce accidental duplicate submissions from the same phone for 45 seconds.
  var cache = CacheService.getScriptCache();
  var key = 'reg_' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, phone)
  ).slice(0, 32);
  if (cache.get(key)) throw new Error('الطلب مكرر، انتظر قليلاً ثم حاول مرة أخرى');

  var ref = (type === 'scout' ? 'SC-' : 'KH-') + Math.floor(10000 + Math.random() * 90000);
  var label = type === 'scout' ? 'كشافة أبناء القرآن' : 'رابطة خطى الشبابية';
  var lines = [
    '📥 تسجيل جديد',
    'الجهة: ' + label,
    'رقم التسجيل: ' + ref,
    'الاسم: ' + name,
    'العمر: ' + age,
    'رقم الهاتف: ' + phone
  ];
  if (type === 'scout') lines.push('رقم ولي الأمر: ' + guardianPhone);
  lines.push('الوقت: ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Baghdad', 'yyyy-MM-dd HH:mm:ss'));

  var props = PropertiesService.getScriptProperties();
  var token = String(props.getProperty('BOT_TOKEN') || '').trim();
  var chatId = String(props.getProperty('CHAT_ID') || '').trim();
  if (!token || !chatId) throw new Error('إعدادات البوت ناقصة');

  var response = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ chat_id: chatId, text: lines.join('\n') }),
    muteHttpExceptions: true
  });
  var status = response.getResponseCode();
  var result;
  try { result = JSON.parse(response.getContentText()); } catch (e) { result = null; }
  if (status < 200 || status >= 300 || !result || result.ok !== true) {
    throw new Error('فشل إرسال رسالة تيليجرام. تأكد من رمز البوت ومعرّف المحادثة وأنك ضغطت Start للبوت.');
  }

  cache.put(key, '1', 45);
  return { ok: true, ref: ref };
}

function cleanText_(value, maxLength) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function normalizePhone_(value) {
  var s = String(value == null ? '' : value).trim();
  var map = {'٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9','۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9'};
  s = s.replace(/[٠-٩۰-۹]/g, function(ch) { return map[ch] || ch; });
  return s.replace(/[\s()-]/g, '');
}
