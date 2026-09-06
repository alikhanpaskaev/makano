/**
 * Makano → Telegram. Ретранслятор на Google Apps Script.
 *
 * Зачем он нужен: сайт статический, его JavaScript открыт всем, поэтому токен
 * бота туда класть нельзя. Токен живёт здесь, в свойствах скрипта, и наружу
 * не попадает — сайт знает только адрес этого веб-приложения.
 *
 * Установка — см. relay/README.md
 */

var TELEGRAM_API = "https://api.telegram.org/bot";

function doPost(e) {
  try {
    var props = PropertiesService.getScriptProperties();
    var token = props.getProperty("BOT_TOKEN");
    var chatId = props.getProperty("CHAT_ID");

    if (!token || !chatId) return reply({ ok: false, error: "not configured" });

    var data = JSON.parse(e.postData.contents);

    // Ловушка для ботов: поле скрыто от людей, заполнить его может только робот.
    if (data.website) return reply({ ok: true });

    var fields = Array.isArray(data.fields) ? data.fields : [];
    if (!fields.length) return reply({ ok: false, error: "empty" });

    var lines = ["<b>" + escapeHtml(data.subject || "Заявка с сайта Makano") + "</b>", ""];

    fields.slice(0, 20).forEach(function (field) {
      var label = escapeHtml(String(field.label || "").slice(0, 100));
      var value = escapeHtml(String(field.value || "").slice(0, 1000));
      if (value) lines.push("<b>" + label + ":</b> " + value);
    });

    UrlFetchApp.fetch(TELEGRAM_API + token + "/sendMessage", {
      method: "post",
      contentType: "application/json",
      muteHttpExceptions: true,
      payload: JSON.stringify({
        chat_id: chatId,
        text: lines.join("\n"),
        parse_mode: "HTML",
        disable_web_page_preview: true
      })
    });

    return reply({ ok: true });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  }
}

// Браузер шлёт простой POST без заголовков, поэтому предварительный OPTIONS-запрос
// не выполняется — этого метода достаточно для проверки, что скрипт жив.
function doGet() {
  return reply({ ok: true, service: "makano-relay" });
}

function reply(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
