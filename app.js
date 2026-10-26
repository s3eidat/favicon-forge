/* Favicon Forge — draws every icon on a <canvas> and writes the .ico container by hand. Nothing is uploaded. */
(function () {
  "use strict";
  const $ = S3.$, $$ = S3.$$;
  const M = 512; // master size every icon is scaled down from
  const FONT = 'Inter, "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  const OUT = [
    { size: 16, file: "favicon-16x16.png", note: "favicon.ico + PNG" },
    { size: 32, file: "favicon-32x32.png", note: "favicon.ico + PNG" },
    { size: 48, file: null, note: "favicon.ico only" },
    { size: 180, file: "apple-touch-icon.png", note: "Apple touch icon", solid: true },
    { size: 192, file: "android-chrome-192x192.png", note: "Android / PWA" },
    { size: 512, file: "android-chrome-512x512.png", note: "Android / PWA splash" }
  ];
  const saved = S3.store("favicon") || {};
  const o = Object.assign({ src: "text", text: "S", weight: "900", fg: "#ffffff", bg: "#0e7c86", transparent: false, radius: 22, pad: 14, fit: "contain", name: "My Website", short: "Site" }, saved);
  let img = null, canvases = {};

  // ---------- drawing ----------
  function canvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h || w; return c; }
  function roundRect(x, s, r) {
    x.beginPath();
    x.moveTo(r, 0); x.arcTo(s, 0, s, s, r); x.arcTo(s, s, 0, s, r); x.arcTo(0, s, 0, 0, r); x.arcTo(0, 0, s, 0, r); x.closePath();
  }
  function drawMaster(opt, solid) {
    const c = canvas(M), x = c.getContext("2d"), r = solid ? 0 : opt.radius / 100 * M;
    x.save();
    if (r > 0) { roundRect(x, M, r); x.clip(); }
    if (!opt.transparent || solid) { x.fillStyle = opt.transparent ? "#ffffff" : opt.bg; x.fillRect(0, 0, M, M); }
    const p = opt.pad / 100 * M, a = M - 2 * p;
    if (opt.src === "image" && opt.img) {
      const iw = opt.img.naturalWidth || M, ih = opt.img.naturalHeight || M;
      const s = opt.fit === "cover" ? Math.max(a / iw, a / ih) : Math.min(a / iw, a / ih), w = iw * s, h = ih * s;
      x.beginPath(); x.rect(p, p, a, a); x.clip();
      x.imageSmoothingQuality = "high";
      x.drawImage(opt.img, p + (a - w) / 2, p + (a - h) / 2, w, h);
    } else if (opt.text.trim()) {
      x.font = opt.weight + " 300px " + FONT;
      const m = x.measureText(opt.text);
      const tw = m.actualBoundingBoxLeft + m.actualBoundingBoxRight, th = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
      const k = Math.min(a / Math.max(tw, 1), a / Math.max(th, 1));
      x.font = opt.weight + " " + (300 * k) + "px " + FONT;
      const n = x.measureText(opt.text);
      const w2 = n.actualBoundingBoxLeft + n.actualBoundingBoxRight, h2 = n.actualBoundingBoxAscent + n.actualBoundingBoxDescent;
      x.fillStyle = opt.fg; x.textBaseline = "alphabetic"; x.textAlign = "left";
      x.fillText(opt.text, M / 2 - w2 / 2 + n.actualBoundingBoxLeft, M / 2 - h2 / 2 + n.actualBoundingBoxAscent);
    }
    x.restore();
    return c;
  }
  // Halve repeatedly, then one smooth pass: crisp small icons without aliasing.
  function scaled(src, size) {
    let cur = src;
    while (cur.width / 2 >= size) {
      const n = canvas(cur.width / 2), x = n.getContext("2d");
      x.imageSmoothingQuality = "high"; x.drawImage(cur, 0, 0, n.width, n.height); cur = n;
    }
    if (cur.width === size) return cur;
    const out = canvas(size), x = out.getContext("2d");
    x.imageSmoothingQuality = "high"; x.drawImage(cur, 0, 0, size, size);
    return out;
  }
  function renderAll(opt) {
    const m = drawMaster(opt, false), ms = drawMaster(opt, true), res = {};
    OUT.forEach(t => { res[t.size] = scaled(t.solid ? ms : m, t.size); });
    return res;
  }

  // ---------- files ----------
  function pngBytes(c) { return new Promise((res, rej) => c.toBlob(b => b ? b.arrayBuffer().then(a => res(new Uint8Array(a))) : rej(new Error("encode failed")), "image/png")); }
  // ICO = 6-byte header + 16-byte directory entry per image + PNG payloads (PNG-in-ICO, supported everywhere since Vista).
  function ico(images) {
    const head = 6 + 16 * images.length, total = images.reduce((s, i) => s + i.bytes.length, head);
    const b = new Uint8Array(total), v = new DataView(b.buffer);
    v.setUint16(0, 0, true); v.setUint16(2, 1, true); v.setUint16(4, images.length, true);
    let off = head;
    images.forEach((im, i) => {
      const e = 6 + 16 * i;
      b[e] = im.size >= 256 ? 0 : im.size; b[e + 1] = im.size >= 256 ? 0 : im.size; b[e + 2] = 0; b[e + 3] = 0;
      v.setUint16(e + 4, 1, true); v.setUint16(e + 6, 32, true);
      v.setUint32(e + 8, im.bytes.length, true); v.setUint32(e + 12, off, true);
      b.set(im.bytes, off); off += im.bytes.length;
    });
    return b;
  }
  function manifest(opt) {
    const color = opt.transparent ? "#ffffff" : opt.bg;
    return JSON.stringify({
      name: opt.name || "My Website", short_name: opt.short || opt.name || "Site",
      icons: [{ src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" }, { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" }],
      theme_color: color, background_color: color, display: "standalone"
    }, null, 2) + "\n";
  }
  function snippet(opt) {
    return '<link rel="icon" href="/favicon.ico" sizes="48x48">\n' +
      '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">\n' +
      '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">\n' +
      '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">\n' +
      '<link rel="manifest" href="/site.webmanifest">\n' +
      '<meta name="theme-color" content="' + (opt.transparent ? "#ffffff" : opt.bg) + '">';
  }
  async function buildFiles(cs, opt) {
    const png = {};
    for (const t of OUT) png[t.size] = await pngBytes(cs[t.size]);
    const files = [{ name: "favicon.ico", data: ico([16, 32, 48].map(s => ({ size: s, bytes: png[s] }))) }];
    OUT.forEach(t => { if (t.file) files.push({ name: t.file, data: png[t.size] }); });
    files.push({ name: "site.webmanifest", data: manifest(opt) });
    files.push({ name: "head-snippet.html", data: snippet(opt) + "\n" });
    return files;
  }

  // ---------- UI ----------
  const sizes = $("#sizes");
  function seg(el, value, onPick) {
    $$("button", el).forEach(b => {
      b.setAttribute("aria-pressed", String(b.dataset.v === value));
      b.addEventListener("click", () => { $$("button", el).forEach(x => x.setAttribute("aria-pressed", String(x === b))); onPick(b.dataset.v); });
    });
  }
  OUT.forEach(t => {
    const tile = S3.h("div", { "class": "ff-size" }, [
      S3.h("div", { "class": "ff-pic checker" }),
      S3.h("b", { text: t.size + "×" + t.size }),
      S3.h("span", { text: t.note })
    ]);
    tile.appendChild(t.file ? S3.h("button", { "class": "btn small", "data-size": t.size, "aria-label": "Download " + t.file, html: S3.icon("download") + "PNG" })
      : S3.h("span", { "class": "chip", text: "in the .ico" }));
    t.tile = tile; sizes.appendChild(tile);
  });
  function draw() {
    const save = Object.assign({}, o); delete save.img; S3.store("favicon", save);
    $("#textBox").hidden = o.src !== "text"; $("#imageBox").hidden = o.src !== "image";
    $("#bg").disabled = o.transparent;
    $("#rv").textContent = o.radius + "%"; $("#pv").textContent = o.pad + "%";
    canvases = renderAll(Object.assign({}, o, { img }));
    OUT.forEach(t => {
      const c = canvases[t.size], box = $(".ff-pic", t.tile);
      const show = t.size <= 48 ? t.size * Math.floor(96 / t.size > 3 ? 3 : 96 / t.size) : 96;
      c.style.width = c.style.height = show + "px";
      c.style.imageRendering = t.size <= 48 ? "pixelated" : "auto";
      box.textContent = ""; box.appendChild(c);
    });
    $("#tabIcon").src = canvases[32].toDataURL(); $("#homeIcon").src = canvases[180].toDataURL();
    $("#tabTitle").textContent = o.name || "My Website"; $("#homeName").textContent = o.short || o.name || "Site";
    $("#snippet").textContent = snippet(o);
  }
  const later = S3.debounce(draw, 60);
  function bind(id, key, ev, conv) {
    const el = $("#" + id);
    if (el.type === "checkbox") el.checked = o[key]; else el.value = o[key];
    el.addEventListener(ev || "input", () => { o[key] = el.type === "checkbox" ? el.checked : conv ? conv(el.value) : el.value; later(); });
  }
  bind("text", "text"); bind("weight", "weight", "change"); bind("fg", "fg"); bind("bg", "bg");
  bind("transparent", "transparent", "change"); bind("radius", "radius", "input", Number); bind("pad", "pad", "input", Number);
  bind("name", "name"); bind("short", "short");
  seg($("#src"), o.src, v => { o.src = v; draw(); });
  seg($("#fit"), o.fit, v => { o.fit = v; draw(); });

  async function setImage(file) {
    const url = URL.createObjectURL(file), im = new Image();
    im.src = url;
    try { await im.decode(); } catch (e) { URL.revokeObjectURL(url); S3.toast("Can't read that image", "error"); return; }
    if (img) URL.revokeObjectURL(img.src);
    img = im; o.src = "image";
    $$("#src button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === "image")));
    $("#dropLbl").textContent = file.name;
    if (im.naturalWidth && Math.min(im.naturalWidth, im.naturalHeight) < 192) S3.toast("Small image: icons above " + Math.min(im.naturalWidth, im.naturalHeight) + " px will look soft");
    draw();
  }
  S3.drop($("#drop"), fs => setImage(fs[0]), { accept: "image/*,.svg", multiple: false });

  sizes.addEventListener("click", async e => {
    const b = e.target.closest("[data-size]"); if (!b) return;
    const t = OUT.filter(x => x.size === +b.dataset.size)[0];
    S3.download(new Blob([await pngBytes(canvases[t.size])], { type: "image/png" }), t.file); S3.done();
  });
  $("#copy").addEventListener("click", () => S3.copy(snippet(o)));
  $("#zip").addEventListener("click", async () => {
    try { S3.download(S3.zip(await buildFiles(canvases, o)), "favicons.zip"); S3.done(); }
    catch (e) { S3.toast("Could not build the icons: " + e.message, "error"); }
  });

  const fontReady = (document.fonts && document.fonts.load ? document.fonts.load("900 40px Inter") : Promise.resolve()).catch(() => {});
  fontReady.then(draw);

  window.S3_DEMO = async function () {
    await fontReady;
    Object.assign(o, { src: "text", text: "S3", weight: "900", fg: "#ffffff", bg: "#0e7c86", transparent: false, radius: 24, pad: 16, name: "S3eidat Tools", short: "S3eidat" });
    ["text", "weight", "fg", "bg", "radius", "pad", "name", "short"].forEach(k => { $("#" + k).value = o[k]; });
    $("#transparent").checked = false;
    $$("#src button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === "text")));
    draw();
  };

  window.S3_SELFTEST = async function () {
    await fontReady;
    const base = { src: "text", text: "A", weight: "900", fg: "#ffffff", bg: "#ff0000", transparent: false, radius: 0, pad: 10, fit: "contain", name: "Test", short: "T" };
    const cs = renderAll(base), files = await buildFiles(cs, base);
    const icoF = files[0].data, v = new DataView(icoF.buffer);
    // Header: reserved 0, type 1 (icon), 3 images; entries 16/32/48, 32 bpp, first image right after the directory, each a PNG.
    let ok = v.getUint16(0, true) === 0 && v.getUint16(2, true) === 1 && v.getUint16(4, true) === 3;
    [16, 32, 48].forEach((s, i) => {
      const e = 6 + 16 * i, off = v.getUint32(e + 12, true), len = v.getUint32(e + 8, true);
      ok = ok && icoF[e] === s && icoF[e + 1] === s && v.getUint16(e + 6, true) === 32 && off + len <= icoF.length &&
        icoF[off] === 0x89 && icoF[off + 1] === 0x50 && icoF[off + 2] === 0x4E && icoF[off + 3] === 0x47;
    });
    ok = ok && v.getUint32(6 + 12, true) === 54 && icoF.length === 54 + [0, 1, 2].reduce((s, i) => s + v.getUint32(6 + 16 * i + 8, true), 0);
    // The browser itself must be able to decode our .ico.
    const u = URL.createObjectURL(new Blob([icoF], { type: "image/x-icon" })), im = new Image(); im.src = u;
    let decodes = false; try { await im.decode(); decodes = im.naturalWidth >= 16; } catch (e) { decodes = false; } URL.revokeObjectURL(u);
    // Pixels: square red corner; with 50% radius the corner is transparent but the apple icon stays solid.
    const px = (c, x, y) => c.getContext("2d").getImageData(x, y, 1, 1).data;
    const round = renderAll(Object.assign({}, base, { radius: 50 }));
    const pix = px(cs[32], 0, 0)[0] === 255 && px(cs[32], 0, 0)[3] === 255 && px(round[32], 0, 0)[3] === 0 && px(round[180], 0, 0)[3] === 255 &&
      cs[16].width === 16 && cs[512].width === 512 && cs[180].width === 180;
    const names = files.map(f => f.name).join();
    const man = JSON.parse(files.filter(f => f.name === "site.webmanifest")[0].data);
    const okFiles = names === "favicon.ico,favicon-16x16.png,favicon-32x32.png,apple-touch-icon.png,android-chrome-192x192.png,android-chrome-512x512.png,site.webmanifest,head-snippet.html" &&
      man.icons[1].sizes === "512x512" && man.theme_color === "#ff0000";
    return (ok && decodes && pix && okFiles) || { ok, decodes, pix, okFiles };
  };
})();
