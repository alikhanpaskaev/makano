#!/usr/bin/env node
// Makano static site generator — zero dependencies, pre-renders every page for SEO.
// Usage: node build.js   →   writes ./dist

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const DIST = path.join(ROOT, "dist");

const site = JSON.parse(fs.readFileSync(path.join(ROOT, "data/site.json"), "utf8"));
const spaces = JSON.parse(fs.readFileSync(path.join(ROOT, "data/spaces.json"), "utf8"));

/* ------------------------------------------------------------------ labels */

const TYPE_LABEL = {
  coworking: "Коворкинг",
  partner_space: "Партнёрская площадка"
};

const FORMAT_LABEL = {
  mixed: "Смешанный формат",
  women_only: "Женский формат"
};

const AMENITY_LABEL = {
  wifi: "Wi-Fi",
  meeting_room: "Переговорная",
  printer: "Принтер",
  kitchen: "Кухня",
  parking: "Парковка",
  coffee: "Кофе",
  silence_zone: "Тихая зона",
  whiteboard: "Доска"
};

/* ----------------------------------------------------------------- helpers */

// На своём домене сайт живёт в корне, на GitHub Pages — в подпапке /<repo>/.
// Все внутренние ссылки строятся через p(), иначе на Pages они уходят
// в корень домена и отдают 404.
const BASE = site.useCustomDomain ? "" : site.basePath || "";
const SITE_URL = site.useCustomDomain ? site.url : site.previewUrl || site.url;
const p = (rel) => BASE + rel;

const esc = (value) =>
  String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const priceLabel = (space) => {
  if (space.priceNote) return space.priceNote;
  if (space.pricePerHour) return `от ${space.pricePerHour} ₽/час`;
  return "Цена уточняется";
};

const mapUrl = (space) =>
  `https://yandex.ru/maps/?text=${encodeURIComponent(`${space.city}, ${space.address}`)}`;

/* --------------------------------------------------------------- templates */

const header = (active) => `
  <header class="site-header">
    <div class="wrap">
      <a class="wordmark" href="${p("/")}">Maka<span>no</span></a>
      <nav class="site-nav">
        <a href="${p("/")}"${active === "index" ? ' aria-current="page"' : ""}>Площадки</a>
        <a href="${p("/about/")}"${active === "about" ? ' aria-current="page"' : ""}>О проекте</a>
        <a href="${p("/rent-desk/")}"${active === "rent" ? ' aria-current="page"' : ""}>Найти место</a>
        <a class="btn btn-primary" href="${p("/partner-apply/")}">Сдать помещение</a>
      </nav>
    </div>
  </header>`;

const footer = () => `
  <footer class="site-footer">
    <div class="wrap">
      <div>
        <strong>${esc(site.brand)}</strong> — ${esc(site.description)}
      </div>
      <div>
        <a href="tel:${esc(site.contactPhone)}">${esc(site.contactPhoneDisplay)}</a> ·
        <a href="${p("/partner-apply/")}">Стать партнёром</a> ·
        <a href="${p("/about/")}">О проекте</a>
      </div>
    </div>
  </footer>`;

const layout = ({ title, description, pathname, body, active, jsonLd = "" }) => `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${site.indexable ? `<link rel="canonical" href="${esc(SITE_URL + pathname)}">` : `<meta name="robots" content="noindex, nofollow">`}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(site.brand)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(SITE_URL + pathname)}">
<meta property="og:locale" content="ru_RU">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@400;500;700&family=Golos+Text:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${p("/styles.css")}">
${jsonLd}
</head>
<body>
${header(active)}
<div class="band" aria-hidden="true"></div>
${body}
${footer()}
<script>window.MAKANO=${JSON.stringify({
  phone: site.contactPhone,
  phoneDisplay: site.contactPhoneDisplay,
  telegram: site.telegram,
  relay: site.relayEndpoint,
  formspree: site.formspreeEndpoint
})};</script>
<script src="${p("/app.js")}" defer></script>
</body>
</html>
`;

const card = (space, index) => {
  const tags = [
    `<span class="tag tag-accent">${esc(TYPE_LABEL[space.type] || space.type)}</span>`,
    space.format === "women_only"
      ? `<span class="tag tag-moss">${esc(FORMAT_LABEL.women_only)}</span>`
      : "",
    ...space.amenities.map((a) => `<span class="tag">${esc(AMENITY_LABEL[a] || a)}</span>`)
  ].join("");

  return `
      <a class="card" href="${p("/space/" + esc(space.id) + "/")}"
         data-space
         data-city="${esc(space.city)}"
         data-type="${esc(space.type)}"
         data-format="${esc(space.format)}"
         data-amenity="${esc(space.amenities.join("|"))}">
        <span class="idx">${String(index + 1).padStart(2, "0")}</span>
        <h3>${esc(space.name)}</h3>
        <p class="addr">${esc(space.city)}, ${esc(space.address)}</p>
        <p class="price">${esc(priceLabel(space))}</p>
        <div class="tags">${tags}</div>
        <span class="card-more">Подробнее →</span>
      </a>`;
};

/* ------------------------------------------------------------------- pages */

function renderIndex() {
  const cities = [...new Set(spaces.map((s) => s.city))];
  const amenities = [...new Set(spaces.flatMap((s) => s.amenities))];

  const chips = [
    ...cities.map((c) => `<button class="chip" data-key="city" data-value="${esc(c)}" aria-pressed="false">${esc(c)}</button>`),
    ...Object.keys(TYPE_LABEL).map(
      (t) => `<button class="chip" data-key="type" data-value="${t}" aria-pressed="false">${esc(TYPE_LABEL[t])}</button>`
    ),
    `<button class="chip" data-key="format" data-value="women_only" aria-pressed="false">Женский формат</button>`,
    ...amenities.map(
      (a) => `<button class="chip" data-key="amenity" data-value="${esc(a)}" aria-pressed="false">${esc(AMENITY_LABEL[a] || a)}</button>`
    )
  ].join("\n        ");

  const body = `
  <main>
    <section class="wrap hero">
      <div>
        <h1>Рабочее место<br>в <em>${esc(site.launchCityIn)}</em> —<br>на час, день или месяц.</h1>
        <p class="lede">Коворкинги и свободные помещения города в одном каталоге: адреса, часы,
          условия. Нашли подходящее — оставляете заявку, мы связываем вас с площадкой.</p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="#catalogue">Смотреть площадки</a>
          <a class="btn" href="${p("/partner-apply/")}">У меня есть помещение</a>
        </div>
      </div>
      <aside class="hero-panel">
        <div class="band" aria-hidden="true"></div>
        <div class="stat"><b>${spaces.length}</b><span>площадки в каталоге</span></div>
        <div class="stat"><b>${new Set(spaces.map((s) => s.city)).size}</b><span>город на старте</span></div>
        <div class="stat"><b>0₽</b><span>для тех, кто ищет место</span></div>
      </aside>
    </section>

    <section class="wrap section" id="catalogue">
      <div class="section-head">
        <h2>Где поработать</h2>
        <p>Показано: <span data-count>${spaces.length}</span> из ${spaces.length}</p>
      </div>

      <div class="filters" data-filters>
        ${chips}
      </div>

      <div class="cards">
${spaces.map(card).join("\n")}
      </div>

      <div class="empty-note" data-empty hidden>
        По этим фильтрам ничего не нашлось. Снимите часть условий —
        или <a href="${p("/rent-desk/")}">оставьте заявку</a>, подберём вручную.
      </div>
    </section>

    <section class="cta-block">
      <div class="band" aria-hidden="true"></div>
      <div class="wrap">
        <h2>У вас есть помещение,<br>которое простаивает днём?</h2>
        <p>Языковой центр, студия, учебный класс, свободный кабинет — если помещение пустует
          часть дня, оно может приносить доход как рабочее пространство. Мы приводим людей,
          помогаем с условиями, а дальше — с обустройством площадки.</p>
        <a class="btn" href="${p("/partner-apply/")}">Оставить заявку</a>
      </div>
    </section>
  </main>`;

  write("index.html", layout({
    title: `${site.brand} — коворкинги и рабочие места в ${site.launchCityIn}`,
    description: site.description,
    pathname: "/",
    active: "index",
    body
  }));
}

function renderSpace(space) {
  const jsonLd = `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: space.name,
    address: {
      "@type": "PostalAddress",
      streetAddress: space.address,
      addressLocality: space.city,
      addressRegion: space.region,
      addressCountry: "RU"
    },
    telephone: space.contactPhone || undefined,
    url: `${SITE_URL}/space/${space.id}/`
  })}</script>`;

  const fact = (label, value) =>
    value ? `<div class="fact"><dt>${esc(label)}</dt><dd>${value}</dd></div>` : "";

  const body = `
  <main class="wrap">
    <a class="back-link" href="${p("/")}">← Все площадки</a>

    <div class="detail-head">
      <h1>${esc(space.name)}</h1>
      <div class="tags">
        <span class="tag tag-accent">${esc(TYPE_LABEL[space.type] || space.type)}</span>
        <span class="tag${space.format === "women_only" ? " tag-moss" : ""}">${esc(FORMAT_LABEL[space.format] || space.format)}</span>
        ${space.amenities.map((a) => `<span class="tag">${esc(AMENITY_LABEL[a] || a)}</span>`).join("")}
      </div>
    </div>

    <div class="detail-grid">
      <div>
        <p>${esc(space.about || "")}</p>

        ${space.verified
          ? ""
          : `<div class="notice">Данные собраны из открытых источников и ещё не подтверждены площадкой.
             Перед поездкой уточните условия — или оставьте заявку, мы проверим за вас.</div>`}

        <a class="btn btn-primary" href="${p("/rent-desk/?space=" + encodeURIComponent(space.name))}">Оставить заявку на место</a>
      </div>

      <dl class="facts">
        <div class="band" aria-hidden="true"></div>
        ${fact("Адрес", `${esc(space.city)}, ${esc(space.address)}${space.district ? ", " + esc(space.district) : ""}<br><a href="${esc(mapUrl(space))}" target="_blank" rel="noopener">Открыть на карте →</a>`)}
        ${fact("Часы работы", esc(space.availableHours) || "Уточняется")}
        ${fact("Стоимость", esc(priceLabel(space)))}
        ${fact("Вместимость", space.capacity ? `${space.capacity} мест` : "")}
        ${fact("Телефон", space.contactPhone ? `<a href="tel:${esc(space.contactPhone.replace(/[^\d+]/g, ""))}">${esc(space.contactPhone)}</a>` : "")}
      </dl>
    </div>
  </main>`;

  write(path.join("space", space.id, "index.html"), layout({
    title: `${space.name} — ${TYPE_LABEL[space.type]} в ${space.cityIn || space.city} | ${site.brand}`,
    description: `${space.name}: ${space.city}, ${space.address}. ${priceLabel(space)}. ${space.about || ""}`.trim(),
    pathname: `/space/${space.id}/`,
    active: "index",
    body,
    jsonLd
  }));
}

function renderForm({ file, active, title, heading, intro, subject, fields, aside, meta }) {
  const body = `
  <main class="wrap form-page">
    <div>
      <h1>${heading}</h1>
      <p class="form-intro">${intro}</p>

      <form class="makano-form" data-subject="${esc(subject)}">
        ${fields
          .map(
            (f) => `<div class="field">
          <label for="${f.name}">${esc(f.label)}</label>
          ${f.type === "textarea"
            ? `<textarea id="${f.name}" name="${f.name}" data-label="${esc(f.label)}" placeholder="${esc(f.placeholder || "")}"${f.required ? " required" : ""}></textarea>`
            : `<input id="${f.name}" name="${f.name}" type="${f.type || "text"}" data-label="${esc(f.label)}" placeholder="${esc(f.placeholder || "")}"${f.required ? " required" : ""}>`}
        </div>`
          )
          .join("\n        ")}
        <input type="text" name="website" class="trap" tabindex="-1" autocomplete="off" aria-hidden="true">
        ${
          site.relayEndpoint || site.formspreeEndpoint
            ? `<div><button class="btn btn-primary" type="submit">Отправить заявку</button></div>`
            : `<div class="send-choice">
          <span class="send-label">Куда отправить заявку</span>
          <div class="send-buttons">
            <button class="btn btn-primary" type="button" data-channel="whatsapp">WhatsApp</button>
            ${site.telegram ? `<button class="btn" type="button" data-channel="telegram">Telegram</button>` : ""}
          </div>
          <span class="send-hint">Откроется мессенджер с готовым текстом — останется нажать «отправить».</span>
        </div>`
        }
        <p class="form-status" data-status hidden></p>
      </form>
    </div>

    <aside class="side-note">
      <div class="band" aria-hidden="true"></div>
      <h3>${esc(aside.title)}</h3>
      <ol>${aside.items.map((i) => `<li>${i}</li>`).join("")}</ol>
    </aside>
  </main>`;

  write(file, layout({ title, description: meta, pathname: "/" + path.dirname(file) + "/", active, body }));
}

function renderAbout() {
  const body = `
  <main class="wrap prose">
    <h1>О проекте</h1>
    <p>${esc(site.brand)} — каталог рабочих мест ${esc(site.launchCity)}а и, дальше, всего региона.
      Мы собираем в одном месте то, что сейчас разбросано по картам, чатам и сарафанному радио:
      где можно сесть и поработать, сколько это стоит, в какие часы открыто.</p>

    <h2>Почему не только коворкинги</h2>
    <p>Коворкингов в городе пока немного. Зато есть десятки помещений, которые пустуют
      часть дня: языковые центры, студии, учебные классы, свободные кабинеты. Для владельца
      это простаивающие метры, для человека с ноутбуком — готовое рабочее место рядом с домом.
      Мы соединяем одних с другими.</p>

    <h2>Как это работает</h2>
    <ol>
      <li>Вы находите площадку в каталоге и оставляете заявку.</li>
      <li>Мы связываемся с площадкой и подтверждаем условия и время.</li>
      <li>Вы приходите и работаете. Оплата — напрямую площадке.</li>
    </ol>
    <p>Для тех, кто ищет место, сервис бесплатный.</p>

    <h2>Партнёрам</h2>
    <p>Если у вас есть помещение с окнами простоя — мы приводим людей и помогаем выстроить
      формат: часы, условия, цену. Для площадок с подтверждённым спросом — помощь
      с обустройством: мебель, техника, всё, что нужно для нормальной работы.</p>
    <p><a href="${p("/partner-apply/")}">Оставить заявку партнёра →</a></p>

    <h2>Контакты</h2>
    <p><a href="tel:${esc(site.contactPhone)}">${esc(site.contactPhoneDisplay)}</a></p>
  </main>`;

  write("about/index.html", layout({
    title: `О проекте — ${site.brand}`,
    description: `${site.brand}: как устроен каталог рабочих мест ${site.launchCity}а и что получают партнёры.`,
    pathname: "/about/",
    active: "about",
    body
  }));
}

function renderSitemap() {
  const urls = ["/", "/about/", "/rent-desk/", "/partner-apply/", ...spaces.map((s) => `/space/${s.id}/`)];

  write(
    "sitemap.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE_URL}${u}</loc></url>`).join("\n")}
</urlset>
`
  );

  write(
    "robots.txt",
    site.indexable
      ? `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`
      : `# Каталог ещё наполняется — до запуска сайт закрыт от поисковиков.\nUser-agent: *\nDisallow: /\n`
  );

  // CNAME только когда домен реально куплен и направлен на Pages —
  // иначе GitHub редиректит на неработающий домен и ссылка не открывается.
  if (site.useCustomDomain) write("CNAME", `${site.domain}\n`);
}

/* --------------------------------------------------------------------- io */

function write(relative, content) {
  const target = path.join(DIST, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function build() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  renderIndex();
  spaces.forEach(renderSpace);
  renderAbout();

  renderForm({
    file: "rent-desk/index.html",
    active: "rent",
    title: `Найти рабочее место в ${site.launchCityIn} — ${site.brand}`,
    heading: "Найдём вам<br>рабочее место",
    intro: `Опишите, что нужно — подберём площадку в ${esc(site.launchCityIn)} и договоримся об условиях. Бесплатно.`,
    subject: "Заявка: ищу рабочее место",
    meta: `Оставьте заявку — подберём коворкинг или рабочее место в ${site.launchCityIn} под ваши задачи.`,
    fields: [
      { name: "name", label: "Как вас зовут", required: true },
      { name: "phone", label: "Телефон или ник в Telegram", required: true, placeholder: "+7 ..." },
      { name: "space", label: "Интересующая площадка", placeholder: "Если уже выбрали" },
      { name: "when", label: "Когда и на сколько", placeholder: "Например: будни, 10:00–15:00" },
      { name: "comment", label: "Что важно", type: "textarea", placeholder: "Тихо, переговорная, рядом с центром…" }
    ],
    aside: {
      title: "Что дальше",
      items: [
        "Мы читаем заявку и связываемся в тот же день.",
        "Уточняем у площадки время и условия.",
        "Присылаем подтверждение — вы приходите работать.",
        "Оплата напрямую площадке, наша услуга бесплатна."
      ]
    }
  });

  renderForm({
    file: "partner-apply/index.html",
    active: "partner",
    title: `Сдать помещение под рабочие места — ${site.brand}`,
    heading: "Помещение простаивает?<br>Пусть работает",
    intro:
      "Языковой центр, студия, класс, свободный кабинет — если помещение пустует часть дня, оно может приносить доход. Расскажите о нём, мы посмотрим и вернёмся с предложением.",
    subject: "Заявка партнёра: сдать помещение",
    meta: "Сдавайте простаивающее помещение под рабочие места: мы приводим людей и помогаем с обустройством.",
    fields: [
      { name: "name", label: "Ваше имя", required: true },
      { name: "business", label: "Название и тип бизнеса", required: true, placeholder: "Языковой центр «…»" },
      { name: "phone", label: "Телефон или Telegram", required: true, placeholder: "+7 ..." },
      { name: "address", label: "Адрес помещения", required: true },
      { name: "free_hours", label: "Свободные часы", placeholder: "Например: будни, 9:00–16:00" },
      { name: "capacity", label: "Сколько человек помещается", placeholder: "Например: 8" },
      { name: "equipment", label: "Что уже есть", type: "textarea", placeholder: "Wi-Fi, столы, доска, кухня…" }
    ],
    aside: {
      title: "Как мы работаем",
      items: [
        "Созваниваемся и смотрим помещение.",
        "Вместе определяем часы, условия и цену.",
        "Размещаем площадку в каталоге и приводим людей.",
        "Когда спрос подтверждён — помогаем с обустройством: мебель, техника."
      ]
    }
  });

  renderSitemap();

  for (const asset of ["styles.css", "app.js"]) {
    fs.copyFileSync(path.join(ROOT, "src", asset), path.join(DIST, asset));
  }

  const pages = spaces.length + 5;
  console.log(`✓ Makano: собрано ${pages} страниц в dist/ (${spaces.length} площадок)`);
}

build();
