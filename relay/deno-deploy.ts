/**
 * Makano → Telegram. Тот же ретранслятор для Deno Deploy.
 * Альтернатива Google Apps Script — выберите что-то одно.
 *
 * Токен и chat id задаются переменными окружения BOT_TOKEN и CHAT_ID
 * в настройках проекта Deno Deploy, в коде их нет.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const escapeHtml = (value: unknown) =>
  String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (request.method !== "POST") return json({ ok: true, service: "makano-relay" });

  const token = Deno.env.get("BOT_TOKEN");
  const chatId = Deno.env.get("CHAT_ID");
  if (!token || !chatId) return json({ ok: false, error: "not configured" }, 500);

  try {
    const data = await request.json();

    // Скрытое поле-ловушка: его заполняют только спам-боты.
    if (data.website) return json({ ok: true });

    const fields = Array.isArray(data.fields) ? data.fields : [];
    if (!fields.length) return json({ ok: false, error: "empty" }, 400);

    const lines = [`<b>${escapeHtml(data.subject ?? "Заявка с сайта Makano")}</b>`, ""];

    for (const field of fields.slice(0, 20)) {
      const label = escapeHtml(String(field.label ?? "").slice(0, 100));
      const value = escapeHtml(String(field.value ?? "").slice(0, 1000));
      if (value) lines.push(`<b>${label}:</b> ${value}`);
    }

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: lines.join("\n"),
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: String(error) }, 500);
  }
});
