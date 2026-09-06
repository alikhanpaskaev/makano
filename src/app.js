// Makano — catalogue filtering + no-backend form handling.
// Config (phone, optional Formspree endpoint) is injected by build.js as window.MAKANO.

(function () {
  "use strict";

  var cfg = window.MAKANO || {};

  /* ---------------- Catalogue filters ---------------- */

  var filterBar = document.querySelector("[data-filters]");
  if (filterBar) {
    var cards = Array.prototype.slice.call(document.querySelectorAll("[data-space]"));
    var counter = document.querySelector("[data-count]");
    var empty = document.querySelector("[data-empty]");
    var active = {};

    filterBar.addEventListener("click", function (event) {
      var chip = event.target.closest(".chip");
      if (!chip) return;

      var key = chip.dataset.key;
      var value = chip.dataset.value;

      // Toggle within its group: selecting a chip clears the previous one.
      if (active[key] === value) {
        delete active[key];
      } else {
        active[key] = value;
      }

      filterBar.querySelectorAll(".chip").forEach(function (other) {
        other.setAttribute("aria-pressed", String(active[other.dataset.key] === other.dataset.value));
      });

      apply();
    });

    function apply() {
      var shown = 0;

      cards.forEach(function (card) {
        var match = Object.keys(active).every(function (key) {
          var raw = card.dataset[key] || "";
          return raw.split("|").indexOf(active[key]) !== -1;
        });

        card.hidden = !match;
        if (match) {
          card.style.animationDelay = shown * 60 + "ms";
          shown++;
        }
      });

      if (counter) counter.textContent = shown;
      if (empty) empty.hidden = shown !== 0;
    }

    // Stagger the initial reveal.
    cards.forEach(function (card, i) {
      card.style.animationDelay = i * 60 + "ms";
    });
  }

  /* ---------------- Forms ---------------- */

  var form = document.querySelector("form.makano-form");
  if (!form) return;

  // Prefill the space name when arriving from a space page (?space=Название).
  var requested = new URLSearchParams(window.location.search).get("space");
  var spaceField = form.querySelector('[name="space"]');
  if (requested && spaceField) spaceField.value = requested;

  var status = form.querySelector("[data-status]");

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    if (!form.reportValidity()) return;

    if (cfg.formspree) send(new FormData(form));
  });

  // Каждый мессенджер — своя кнопка: человек выбирает, чем ему удобнее.
  form.querySelectorAll("[data-channel]").forEach(function (button) {
    button.addEventListener("click", function (event) {
      event.preventDefault();

      if (!form.reportValidity()) return;

      openMessenger(button.dataset.channel, new FormData(form));
    });
  });

  function send(data) {
    setStatus("Отправляем…");

    fetch(cfg.formspree, {
      method: "POST",
      body: data,
      headers: { Accept: "application/json" }
    })
      .then(function (response) {
        if (!response.ok) throw new Error("bad status");
        form.reset();
        setStatus("Заявка отправлена. Свяжемся с вами в ближайшее время.");
      })
      .catch(function () {
        setStatus("Не удалось отправить. Напишите нам напрямую: " + (cfg.phoneDisplay || ""));
      });
  }

  // Без бэкенда заявка передаётся мессенджеру готовым текстом — это отвечает
  // ручной модели MVP: заявку всё равно обрабатывает человек.
  function openMessenger(channel, data) {
    var lines = [form.dataset.subject || "Заявка с сайта Makano"];

    data.forEach(function (value, key) {
      var field = form.querySelector('[name="' + key + '"]');
      var title = field && field.dataset.label ? field.dataset.label : key;
      if (String(value).trim()) lines.push(title + ": " + value);
    });

    var text = lines.join("\n");
    var url;
    var note;

    if (channel === "telegram") {
      // Токен бота в публичном статическом сайте держать нельзя, поэтому
      // Telegram получает текст через диалог выбора чата.
      url = "https://t.me/share/url?url=&text=" + encodeURIComponent(text);
      note = "Открыли Telegram с готовой заявкой — выберите чат «" +
        (cfg.telegram ? "@" + cfg.telegram : "Makano") + "» и нажмите «отправить».";
    } else {
      url = "https://wa.me/" + (cfg.phone || "").replace(/[^\d]/g, "") +
        "?text=" + encodeURIComponent(text);
      note = "Открыли WhatsApp с готовым сообщением — осталось нажать «отправить».";
    }

    window.open(url, "_blank", "noopener");
    setStatus(note);
  }

  function setStatus(text) {
    if (!status) return;
    status.hidden = false;
    status.textContent = text;
  }
})();
