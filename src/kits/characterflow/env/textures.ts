// Procedural textures for the environment kit (seeded, file-free).

import { canvasTex, mulberry32, shade } from "../lib/mats.ts";

/** Warm oak plank floor. */
export const plankTex = (rep: [number, number], base = "#a77b55") =>
  canvasTex(`cfplank${rep}${base}`, 512, 1024, (g, w, h) => {
    const r = mulberry32(11);
    const pw = w / 4;
    for (let i = 0; i < 4; i++) {
      let y = -r() * 300;
      while (y < h) {
        const len = 380 + r() * 320;
        g.fillStyle = shade(base, 0.84 + r() * 0.28);
        g.fillRect(i * pw, y, pw, len);
        for (let k = 0; k < 22; k++) {
          g.strokeStyle = `rgba(70,40,20,${0.05 + r() * 0.08})`;
          g.lineWidth = 0.6 + r() * 1.5;
          const x = i * pw + r() * pw;
          g.beginPath();
          g.moveTo(x, y);
          g.bezierCurveTo(x + (r() - 0.5) * 12, y + len * 0.3, x + (r() - 0.5) * 12, y + len * 0.7, x + (r() - 0.5) * 8, y + len);
          g.stroke();
        }
        g.fillStyle = "rgba(40,24,14,0.5)";
        g.fillRect(i * pw, y, pw, 2);
        y += len;
      }
      g.fillStyle = "rgba(40,24,14,0.45)";
      g.fillRect(i * pw, 0, 2, h);
    }
  }, rep);

/** Matte painted wall with a faint roller texture. */
export const paintTex = (key: string, color: string, rep: [number, number]) =>
  canvasTex(`cfpaint${key}`, 256, 256, (g, w, h) => {
    const r = mulberry32(5);
    g.fillStyle = color;
    g.fillRect(0, 0, w, h);
    for (let k = 0; k < 1400; k++) {
      g.fillStyle = `rgba(${r() > 0.5 ? "255,255,255" : "0,0,0"},${0.012 + r() * 0.02})`;
      g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3);
    }
  }, rep);

/** Duvet cover: soft cotton with a small scattered star print. */
export const duvetTex = (key: string, base: string, ink: string, rep: [number, number]) =>
  canvasTex(`cfduvet${key}`, 512, 512, (g, w, h) => {
    const r = mulberry32(23);
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) {
      g.fillStyle = `rgba(255,255,255,${0.025 + r() * 0.02})`;
      g.fillRect(0, y, w, 1);
    }
    g.fillStyle = ink;
    for (let k = 0; k < 46; k++) {
      const x = r() * w, y = r() * h, s = 5 + r() * 6;
      g.save();
      g.translate(x, y);
      g.rotate(r() * Math.PI);
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2, rr = i % 2 ? s * 0.45 : s;
        g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      g.closePath();
      g.globalAlpha = 0.55 + r() * 0.3;
      g.fill();
      g.restore();
    }
  }, rep);

/** Round braided rug. */
export const rugTex = () =>
  canvasTex("cfrug", 512, 512, (g, w, h) => {
    const cols = ["#e9dcc4", "#d7b98f", "#e9dcc4", "#9fbcc9", "#e9dcc4", "#e3a46f"];
    for (let i = 0; i < 30; i++) {
      g.fillStyle = cols[i % cols.length];
      g.beginPath();
      g.arc(w / 2, h / 2, (w / 2) * (1 - i / 30), 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "rgba(0,0,0,0.08)";
      g.lineWidth = 2;
      g.stroke();
    }
  });

/** Night sky seen through the window: gradient, stars, moon, distant rooftops. */
export const skyTex = () =>
  canvasTex("cfsky", 1024, 1024, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, "#0b1a3d");
    gr.addColorStop(0.6, "#1d3a6e");
    gr.addColorStop(1, "#3b5f8f");
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    const r = mulberry32(31);
    for (let k = 0; k < 220; k++) {
      const a = 0.25 + r() * 0.75;
      g.fillStyle = `rgba(230,240,255,${a})`;
      const s = r() < 0.1 ? 2.4 : 1.2;
      g.beginPath();
      g.arc(r() * w, r() * h * 0.75, s, 0, Math.PI * 2);
      g.fill();
    }
    const mx = w * 0.62, my = h * 0.26, mr = 70;
    const halo = g.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 4);
    halo.addColorStop(0, "rgba(220,235,255,0.5)");
    halo.addColorStop(1, "rgba(220,235,255,0)");
    g.fillStyle = halo;
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#f4f6ff";
    g.beginPath();
    g.arc(mx, my, mr, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(170,185,215,0.35)";
    for (const [dx, dy, rr] of [[-20, -10, 16], [18, 22, 11], [24, -26, 8], [-8, 30, 7]]) {
      g.beginPath();
      g.arc(mx + dx, my + dy, rr, 0, Math.PI * 2);
      g.fill();
    }
    // rooftops
    g.fillStyle = "#0a1428";
    let x = 0;
    while (x < w) {
      const bw = 60 + r() * 140, bh = 90 + r() * 170;
      g.fillRect(x, h - bh, bw, bh);
      if (r() < 0.5) {
        g.beginPath();
        g.moveTo(x - 6, h - bh);
        g.lineTo(x + bw / 2, h - bh - 50);
        g.lineTo(x + bw + 6, h - bh);
        g.fill();
      }
      for (let k = 0; k < 4; k++)
        if (r() < 0.35) {
          g.fillStyle = r() < 0.5 ? "#ffcf86" : "#ffe4b0";
          g.fillRect(x + 10 + r() * (bw - 30), h - bh + 20 + r() * (bh - 40), 12, 16);
          g.fillStyle = "#0a1428";
        }
      x += bw + 4;
    }
  });

/** Poster: soft mountains at dusk. */
export const posterTex = (key: string, a: string, b: string, c: string) =>
  canvasTex(`cfposter${key}`, 256, 340, (g, w, h) => {
    g.fillStyle = "#f3ece0";
    g.fillRect(0, 0, w, h);
    const m = 18;
    const gr = g.createLinearGradient(0, m, 0, h - m);
    gr.addColorStop(0, a);
    gr.addColorStop(1, b);
    g.fillStyle = gr;
    g.fillRect(m, m, w - 2 * m, h - 2 * m);
    g.fillStyle = "#fff6dd";
    g.beginPath();
    g.arc(w * 0.66, h * 0.35, 26, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(m, h - m);
    g.lineTo(w * 0.35, h * 0.5);
    g.lineTo(w * 0.55, h * 0.7);
    g.lineTo(w * 0.75, h * 0.45);
    g.lineTo(w - m, h * 0.68);
    g.lineTo(w - m, h - m);
    g.fill();
    g.fillStyle = shade(c, 0.7);
    g.beginPath();
    g.moveTo(m, h - m);
    g.lineTo(w * 0.25, h * 0.72);
    g.lineTo(w * 0.5, h * 0.82);
    g.lineTo(w - m, h * 0.76);
    g.lineTo(w - m, h - m);
    g.fill();
  });

/** Book spines for a shelf. */
export const spineColors = ["#d9534f", "#f0ad4e", "#5bc0de", "#5cb85c", "#8e6cc9", "#e8e1d0", "#2f6f73", "#c97b4a"];

/** Square floor tiles with grout and a faint speckle (classrooms, shops). */
export const tileTex = (base: string, rep: [number, number]) =>
  canvasTex(`cftile${base}${rep}`, 512, 512, (g, w, h) => {
    const r = mulberry32(5);
    const n = 4, s = w / n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        g.fillStyle = shade(base, 0.94 + r() * 0.1);
        g.fillRect(i * s, j * s, s, s);
        for (let k = 0; k < 60; k++) {
          g.fillStyle = `rgba(60,55,50,${0.04 + r() * 0.06})`;
          g.fillRect(i * s + r() * s, j * s + r() * s, 2, 2);
        }
      }
    g.fillStyle = shade(base, 0.7);
    for (let i = 0; i <= n; i++) { g.fillRect(i * s - 2, 0, 4, h); g.fillRect(0, i * s - 2, w, 4); }
  }, rep);

/** Office carpet tiles: soft fibre noise, tiles turned 90° from each other. */
export const carpetTex = (base: string, rep: [number, number]) =>
  canvasTex(`cfcarpet${base}${rep}`, 512, 512, (g, w, h) => {
    const r = mulberry32(9);
    const n = 2, s = w / n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        g.fillStyle = shade(base, (i + j) % 2 ? 0.95 : 1.03);
        g.fillRect(i * s, j * s, s, s);
        for (let k = 0; k < 900; k++) {
          g.fillStyle = `rgba(${r() < 0.5 ? "255,255,255" : "0,0,0"},${0.03 + r() * 0.05})`;
          const horiz = (i + j) % 2 === 0;
          g.fillRect(i * s + r() * s, j * s + r() * s, horiz ? 6 : 1.5, horiz ? 1.5 : 6);
        }
      }
    g.fillStyle = "rgba(0,0,0,0.12)";
    for (let i = 0; i <= n; i++) { g.fillRect(i * s - 1, 0, 2, h); g.fillRect(0, i * s - 1, w, 2); }
  }, rep);

/** Whiteboard (marker diagram + lines), chalkboard, or a café chalk menu. */
export const boardTex = (style: "white" | "chalk" | "menu") =>
  canvasTex(`cfboard${style}`, 1024, 512, (g, w, h) => {
    const r = mulberry32(style === "white" ? 3 : 4);
    g.fillStyle = style === "white" ? "#f7f8f6" : style === "chalk" ? "#2f4a3a" : "#26231f";
    g.fillRect(0, 0, w, h);
    const ink = style === "white" ? ["#1d4e89", "#c0392b", "#2c3e50"] : ["#f4f1e8", "#f6d55c", "#f4f1e8"];
    g.lineCap = "round";
    if (style === "menu") {
      g.fillStyle = "#f4f1e8";
      g.font = "700 64px sans-serif";
      g.textAlign = "center";
      g.fillText("MENU", w / 2, 86);
      g.font = "500 36px sans-serif";
      g.textAlign = "left";
      const items = ["KOPI SUSU", "AMERICANO", "LATTE", "TEH TARIK", "MATCHA", "ROTI BAKAR"];
      items.forEach((it, i) => {
        const x = i < 3 ? 70 : w / 2 + 40, y = 170 + (i % 3) * 100;
        g.fillStyle = "#f4f1e8";
        g.fillText(it, x, y);
        g.fillStyle = "#f6d55c";
        g.fillText(`${18 + i * 3}K`, x + 300, y);
      });
      return;
    }
    // a little diagram: boxes, arrows, handwriting lines
    for (let b = 0; b < 3; b++) {
      g.strokeStyle = ink[b % ink.length];
      g.lineWidth = 6;
      const x = 90 + b * 300, y = 90 + (b % 2) * 50;
      g.strokeRect(x, y, 200, 110);
      for (let l = 0; l < 3; l++) { g.beginPath(); g.moveTo(x + 20, y + 30 + l * 28); g.lineTo(x + 60 + r() * 120, y + 30 + l * 28 + (r() - 0.5) * 6); g.stroke(); }
      if (b < 2) { g.beginPath(); g.moveTo(x + 210, y + 55); g.lineTo(x + 285, y + 75 - (b % 2) * 40); g.stroke(); }
    }
    g.strokeStyle = ink[2];
    g.lineWidth = 5;
    for (let l = 0; l < 4; l++) {
      g.beginPath();
      let x = 90;
      g.moveTo(x, 330 + l * 42);
      while (x < 90 + 500 + r() * 300) { x += 14 + r() * 26; g.lineTo(x, 330 + l * 42 + (r() - 0.5) * 10); }
      g.stroke();
    }
  });

/** What is seen through a window: city, garden or a street, by day / at sunset / at night. */
export const viewTex = (view: "city" | "garden" | "street", time: "day" | "night" | "sunset") =>
  canvasTex(`cfview${view}${time}`, 1024, 512, (g, w, h) => {
    const r = mulberry32(view === "city" ? 21 : view === "garden" ? 22 : 23);
    const night = time === "night", sun = time === "sunset";
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, night ? "#0b1a3d" : sun ? "#f3a66b" : "#7fb8ec");
    sky.addColorStop(1, night ? "#2a4572" : sun ? "#ffd9a8" : "#d6ecfb");
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    if (!night) for (let c = 0; c < 4; c++) {
      g.fillStyle = sun ? "rgba(255,236,214,0.55)" : "rgba(255,255,255,0.75)";
      const cx = r() * w, cy = 40 + r() * 120;
      for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(cx + k * 34, cy + (k % 2) * 8, 46, 22, 0, 0, Math.PI * 2); g.fill(); }
    }
    const lit = (x: number, y: number, ww: number, hh: number) => { g.fillStyle = night ? (r() < 0.55 ? "#ffd48a" : "#1b2a44") : sun ? "#f7c48c" : "#bcd7ee"; g.fillRect(x, y, ww, hh); };
    if (view === "city") {
      for (let layer = 0; layer < 2; layer++) {
        let x = -20;
        while (x < w) {
          const bw = 70 + r() * 120, bh = (layer ? 160 : 230) + r() * 160;
          g.fillStyle = night ? (layer ? "#13203a" : "#0c1628") : layer ? "#9fb3c8" : "#7d93ab";
          g.fillRect(x, h - bh, bw, bh);
          for (let yy = h - bh + 14; yy < h - 10; yy += 22) for (let xx = x + 8; xx < x + bw - 12; xx += 18) if (r() < 0.8) lit(xx, yy, 9, 12);
          x += bw + 6;
        }
      }
    } else if (view === "garden") {
      g.fillStyle = night ? "#0f1d14" : sun ? "#8a8a4a" : "#7cbf6a";
      g.fillRect(0, h * 0.72, w, h * 0.28);
      for (let k = 0; k < 9; k++) {
        const x = r() * w, s = 60 + r() * 70;
        g.fillStyle = night ? "#0b160f" : "#5b4030";
        g.fillRect(x - 6, h * 0.72 - s * 0.9, 12, s);
        g.fillStyle = night ? "#10241a" : sun ? "#6f7a3a" : ["#3f9a54", "#4fae5b", "#2f7d44"][k % 3];
        g.beginPath(); g.arc(x, h * 0.72 - s, s * 0.7, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = night ? "#2a2a2a" : "#f1ede4";
      for (let x = 0; x < w; x += 26) g.fillRect(x, h * 0.78, 8, 70);
      g.fillRect(0, h * 0.8, w, 8);
    } else {
      // street: shopfronts across a road
      g.fillStyle = night ? "#1a1a22" : "#6b6f78";
      g.fillRect(0, h * 0.8, w, h * 0.2);
      g.fillStyle = night ? "#c9b45a" : "#f2f2f2";
      for (let x = 10; x < w; x += 90) g.fillRect(x, h * 0.9, 46, 5);
      let x = 0;
      const cols = ["#e8c39e", "#a8c5da", "#e9a1a1", "#c7d9b5", "#f1d6a4"];
      while (x < w) {
        const bw = 150 + r() * 90, bh = 220 + r() * 90;
        g.fillStyle = night ? "#1d2333" : cols[Math.floor(r() * cols.length)];
        g.fillRect(x, h * 0.8 - bh, bw, bh);
        g.fillStyle = night ? "#ffcf7a" : "#3b4a5a";
        g.fillRect(x + 16, h * 0.8 - 110, bw - 32, 90);
        g.fillStyle = night ? "#ff8f5a" : ["#d1495b", "#00798c", "#edae49"][Math.floor(r() * 3)];
        g.fillRect(x + 10, h * 0.8 - 140, bw - 20, 24);
        for (let k = 0; k < 2; k++) lit(x + 24 + k * (bw / 2 - 10), h * 0.8 - bh + 30, 40, 50);
        x += bw + 8;
      }
    }
  });
