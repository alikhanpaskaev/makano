// Makano — «Живой орнамент»: WebGL-поле ромбов в герое.
// Raw WebGL, без библиотек. Мотив взят из орнаментальной ленты (--ornament):
// ромбы цвета терракоты и мха, размер которых ведёт медленное волновое поле.
//
// Деградирует тихо: нет WebGL / слабый экран / prefers-reduced-motion —
// холст просто не включается, остаётся CSS-градиент из styles.css.

(function () {
  "use strict";

  var canvas = document.getElementById("hero-field");
  if (!canvas) return;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var gl =
    canvas.getContext("webgl", { alpha: true, antialias: false, premultipliedAlpha: false }) ||
    canvas.getContext("experimental-webgl", { alpha: true, antialias: false });
  if (!gl) return;

  /* ------------------------------------------------------------- шейдеры */

  var VERT = [
    "attribute vec2 pos;",
    "void main(){ gl_Position = vec4(pos, 0.0, 1.0); }"
  ].join("\n");

  var FRAG = [
    "precision mediump float;",
    "uniform vec2  uRes;",
    "uniform float uTime;",
    "uniform vec2  uMouse;",   // 0..1, сглаженный
    "uniform float uIntro;",   // 0..1 — проявление при загрузке

    // палитра сайта
    "const vec3 PAPER = vec3(0.957, 0.929, 0.886);", // #f4ede2
    "const vec3 SAND  = vec3(0.886, 0.831, 0.749);", // #e2d4bf
    "const vec3 CLAY  = vec3(0.722, 0.271, 0.165);", // #b8452a
    "const vec3 MOSS  = vec3(0.173, 0.231, 0.188);", // #2c3b30

    // ромб: манхэттенское расстояние
    "float diamond(vec2 p){ return abs(p.x) + abs(p.y); }",

    "float hash(vec2 p){",
    "  return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453);",
    "}",

    // мягкое волновое поле — «дыхание» ткани
    "float flow(vec2 p, float t){",
    "  float a = sin(p.x * 1.35 + t * 0.42);",
    "  float b = cos(p.y * 1.05 - t * 0.31);",
    "  float c = sin((p.x + p.y) * 0.72 + t * 0.24);",
    "  float d = cos(length(p * 0.55) * 1.6 - t * 0.5);",
    "  return (a + b + c * 0.8 + d * 0.7) * 0.25;",
    "}",

    "void main(){",
    "  vec2 frag = gl_FragCoord.xy;",
    "  vec2 uv = frag / uRes;",
    "  float aspect = uRes.x / max(uRes.y, 1.0);",

    // рабочие координаты с поправкой на пропорции
    "  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);",

    // лёгкий наклон решётки — как у тканого узора
    "  float ang = 0.20 + sin(uTime * 0.045) * 0.05;",
    "  mat2 rot = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));",
    "  vec2 q = rot * p;",

    "  float t = uTime;",

    // курсор: мягкая волна вокруг указателя
    "  vec2 m = vec2((uMouse.x - 0.5) * aspect, uMouse.y - 0.5);",
    "  float md = length(q - rot * m);",
    "  float ripple = exp(-md * 3.2) * 0.55;",

    // решётка
    "  float cells = 15.0;",
    "  vec2 g = q * cells;",
    "  vec2 id = floor(g);",
    "  vec2 lp = fract(g) - 0.5;",

    // размер ромба ведёт волновое поле + курсор + немного шума на ячейку
    "  float f = flow(q * 2.1 + vec2(0.0, t * 0.06), t);",
    "  float n = hash(id) * 0.34;",
    // держим ромбы раздельными: при size >= ~0.45 соседи смыкаются в сплошную сетку
    "  float size = 0.26 + f * 0.10 + ripple * 0.5 + n * 0.28;",
    "  size = clamp(size, 0.03, 0.42);",

    // сам ромб + тонкая внутренняя огранка
    "  float d = diamond(lp);",
    "  float aa = 1.6 / uRes.y * cells * 2.2;",
    "  float shape = smoothstep(size + aa, size - aa, d);",
    "  float inner = smoothstep(size * 0.52 + aa, size * 0.52 - aa, d);",
    "  float glyph = shape - inner * 0.55;",

    // соединительные штрихи между ромбами — как в орнаментальной ленте
    "  float bar = smoothstep(0.055, 0.0, abs(lp.y)) * smoothstep(0.5, 0.34, abs(lp.x));",
    "  bar *= smoothstep(0.30, 0.40, size) * 0.35;",

    // цвет: терракота ↔ мох по второму, более медленному полю
    "  float mixv = 0.5 + 0.5 * sin(q.x * 0.9 - q.y * 0.7 + t * 0.13 + n * 3.0);",
    // терракота ведёт, мох — редкий акцент, иначе поле уходит в серо-зелёный
    "  vec3 tint = mix(CLAY, MOSS, smoothstep(0.62, 0.96, mixv));",

    // подложка — бумага с песочной подсветкой сверху справа
    "  vec3 base = mix(PAPER, SAND, smoothstep(0.15, 1.0, uv.x * 0.55 + uv.y * 0.65));",

    "  float ink = clamp(glyph + bar, 0.0, 1.0);",

    // читаемость: гасим поле слева (там заголовок) и у нижней кромки
    "  float leftFade  = smoothstep(0.08, 0.58, uv.x);",
    "  float lowerFade = smoothstep(-0.10, 0.30, uv.y);",
    "  float edgeFade  = smoothstep(1.0, 0.72, uv.x) * 0.35 + 0.65;",
    "  float mask = leftFade * lowerFade * edgeFade;",

    "  float alpha = ink * mask * 0.50 * uIntro;",
    "  vec3 col = mix(base, tint, ink * 0.92);",

    "  gl_FragColor = vec4(col, alpha);",
    "}"
  ].join("\n");

  /* ------------------------------------------------------------ программа */

  function compile(type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  var vs = compile(gl.VERTEX_SHADER, VERT);
  var fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;

  var prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, "pos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  var uRes = gl.getUniformLocation(prog, "uRes");
  var uTime = gl.getUniformLocation(prog, "uTime");
  var uMouse = gl.getUniformLocation(prog, "uMouse");
  var uIntro = gl.getUniformLocation(prog, "uIntro");

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  /* -------------------------------------------------------------- размеры */

  // Потолок плотности пикселей. Узор мягкий, разница между 1.5x и 2x не видна,
  // а работы для GPU почти вдвое меньше. На слабых машинах опускаем ещё ниже.
  var dprCap = 1.5;

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    var w = Math.round(canvas.clientWidth * dpr);
    var h = Math.round(canvas.clientHeight * dpr);
    if (w === 0 || h === 0) return;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    gl.uniform2f(uRes, w, h);
  }

  /* ------------------------------------------------------- ввод и рисование */

  var mouse = { x: 0.72, y: 0.62 };
  var smooth = { x: 0.72, y: 0.62 };

  if (!reduceMotion && window.matchMedia("(hover: hover)").matches) {
    window.addEventListener(
      "pointermove",
      function (e) {
        var r = canvas.getBoundingClientRect();
        mouse.x = (e.clientX - r.left) / r.width;
        mouse.y = 1 - (e.clientY - r.top) / r.height;
      },
      { passive: true }
    );
  }

  var visible = true;
  var started = performance.now();
  var raf = 0;

  // Наблюдение за стоимостью кадра: если машина не тянет, сначала снижаем
  // плотность пикселей, а если и это не помогает — замораживаем последний кадр.
  var prev = 0;
  var slow = 0;
  var degraded = false;
  var frozen = false;

  function watchCost(now) {
    if (prev) {
      var dt = now - prev;
      // >32 мс — стабильно ниже 30 fps; единичные всплески игнорируем
      if (dt > 32) {
        slow++;
        if (slow === 12 && !degraded) {
          degraded = true;
          dprCap = 1;
          slow = 0;
        } else if (slow > 24) {
          frozen = true;
        }
      } else if (slow > 0) {
        slow--;
      }
    }
    prev = now;
  }

  function frame(now) {
    raf = 0;
    if (!visible) return;

    watchCost(now);
    resize();

    var elapsed = (now - started) / 1000;
    smooth.x += (mouse.x - smooth.x) * 0.06;
    smooth.y += (mouse.y - smooth.y) * 0.06;

    gl.uniform1f(uTime, reduceMotion ? 6.0 : elapsed);
    gl.uniform2f(uMouse, smooth.x, smooth.y);
    // при reduce-motion кадр всего один — проявлять по времени нечему
    gl.uniform1f(uIntro, reduceMotion ? 1 : Math.min(elapsed / 1.1, 1));
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    canvas.classList.add("is-live");
    // frozen: последний кадр остаётся как статичный фон — узор виден, нагрузки нет
    if (!reduceMotion && !frozen) raf = requestAnimationFrame(frame);
  }

  function start() {
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    // пауза — не «медленный кадр»: сбрасываем отсчёт, иначе простой
    // во вкладке-невидимке ошибочно засчитается как тормоза
    prev = 0;
  }

  // не крутим анимацию, когда герой ушёл за экран или вкладка спрятана
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      function (entries) {
        visible = entries[0].isIntersecting;
        visible ? start() : stop();
      },
      { threshold: 0 }
    ).observe(canvas);
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      stop();
    } else if (visible) {
      start();
    }
  });

  window.addEventListener("resize", function () {
    if (reduceMotion) {
      resize();
      start();
    }
  });

  start();
})();
