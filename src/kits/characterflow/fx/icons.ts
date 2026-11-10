// Flat glyph textures for thought bubbles and the swarm (drawn, not emoji — every machine renders them
// the same). White glyph on transparent; bubbles tint them.

import { canvasTex } from "../lib/mats.ts";
import { FONT } from "../../../core/type/fonts.ts";

export type IconName = "question" | "exclaim" | "cross" | "clock" | "chat" | "cloud" | "heart" | "chart" | "bell" | "dots";

export const ICONS: IconName[] = ["question", "exclaim", "cross", "clock", "chat", "cloud", "heart", "chart"];

export const iconTex = (name: IconName) =>
  canvasTex(`cficon${name}`, 256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = "#ffffff";
    g.strokeStyle = "#ffffff";
    g.lineCap = "round";
    g.lineJoin = "round";
    const cx = w / 2, cy = h / 2;
    if (name === "question" || name === "exclaim") {
      g.font = `600 170px ${FONT}, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(name === "question" ? "?" : "!", cx, cy + 8);
    } else if (name === "cross") {
      g.lineWidth = 30;
      g.beginPath();
      g.moveTo(cx - 55, cy - 55); g.lineTo(cx + 55, cy + 55);
      g.moveTo(cx + 55, cy - 55); g.lineTo(cx - 55, cy + 55);
      g.stroke();
    } else if (name === "clock" || name === "bell") {
      if (name === "bell") {
        g.beginPath();
        g.moveTo(cx - 70, cy + 45);
        g.quadraticCurveTo(cx - 60, cy - 85, cx, cy - 85);
        g.quadraticCurveTo(cx + 60, cy - 85, cx + 70, cy + 45);
        g.closePath();
        g.fill();
        g.fillRect(cx - 85, cy + 40, 170, 20);
        g.beginPath();
        g.arc(cx, cy + 75, 18, 0, Math.PI * 2);
        g.fill();
        g.lineWidth = 12;
        for (const s of [-1, 1]) {
          g.beginPath();
          g.arc(cx, cy - 10, 105, s > 0 ? -0.5 : Math.PI - 0.3, s > 0 ? 0.3 : Math.PI + 0.5);
          g.stroke();
        }
      } else {
        g.lineWidth = 18;
        g.beginPath();
        g.arc(cx, cy, 80, 0, Math.PI * 2);
        g.stroke();
        g.lineWidth = 16;
        g.beginPath();
        g.moveTo(cx, cy); g.lineTo(cx, cy - 50);
        g.moveTo(cx, cy); g.lineTo(cx + 38, cy + 14);
        g.stroke();
      }
    } else if (name === "chat" || name === "dots") {
      g.beginPath();
      g.roundRect(cx - 95, cy - 70, 190, 120, 40);
      g.fill();
      g.beginPath();
      g.moveTo(cx - 40, cy + 40); g.lineTo(cx - 70, cy + 90); g.lineTo(cx - 5, cy + 48);
      g.fill();
      g.globalCompositeOperation = "destination-out";
      for (const dx of [-45, 0, 45]) {
        g.beginPath();
        g.arc(cx + dx, cy - 10, 15, 0, Math.PI * 2);
        g.fill();
      }
      g.globalCompositeOperation = "source-over";
    } else if (name === "cloud") {
      for (const [dx, dy, r] of [[-45, 10, 45], [10, -20, 60], [60, 15, 40], [0, 25, 45]]) {
        g.beginPath();
        g.arc(cx + dx, cy + dy - 20, r, 0, Math.PI * 2);
        g.fill();
      }
      g.lineWidth = 10;
      for (const dx of [-40, 0, 40]) {
        g.beginPath();
        g.moveTo(cx + dx, cy + 55); g.lineTo(cx + dx - 12, cy + 95);
        g.stroke();
      }
    } else if (name === "heart") {
      g.beginPath();
      g.moveTo(cx, cy + 80);
      g.bezierCurveTo(cx - 140, cy - 10, cx - 60, cy - 110, cx, cy - 40);
      g.bezierCurveTo(cx + 60, cy - 110, cx + 140, cy - 10, cx, cy + 80);
      g.fill();
      g.globalCompositeOperation = "destination-out";
      g.lineWidth = 12;
      g.beginPath();
      g.moveTo(cx - 5, cy - 40); g.lineTo(cx + 15, cy); g.lineTo(cx - 12, cy + 25); g.lineTo(cx + 6, cy + 70);
      g.stroke();
      g.globalCompositeOperation = "source-over";
    } else if (name === "chart") {
      g.lineWidth = 18;
      g.beginPath();
      g.moveTo(cx - 90, cy - 60); g.lineTo(cx - 30, cy - 10); g.lineTo(cx + 5, cy - 35); g.lineTo(cx + 80, cy + 55);
      g.stroke();
      g.beginPath();
      g.moveTo(cx + 85, cy + 60); g.lineTo(cx + 35, cy + 60); g.lineTo(cx + 85, cy + 10);
      g.closePath();
      g.fill();
    }
  });

/** Soft round bubble backdrop: bright core, rim highlight, transparent outside. */
export const bubbleTex = () =>
  canvasTex("cfbubble", 512, 512, (g, w, h) => {
    const cx = w / 2, cy = h / 2, r = w * 0.47;
    const gr = g.createRadialGradient(cx, cy - r * 0.2, r * 0.1, cx, cy, r);
    gr.addColorStop(0, "rgba(255,255,255,0.96)");
    gr.addColorStop(0.75, "rgba(255,255,255,0.88)");
    gr.addColorStop(0.93, "rgba(255,255,255,0.96)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
  });

/** Outer glow halo. */
export const haloTex = () =>
  canvasTex("cfhalo", 256, 256, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, "rgba(255,255,255,0.6)");
    gr.addColorStop(0.45, "rgba(255,255,255,0.22)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });

/** Small label texture (speech bubble text, phone UI, screen text). */
export const labelTex = (key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) => canvasTex(`cflabel${key}`, w, h, draw);

/** Text for a thought bubble: up to ~4 short lines, auto-wrapped and sized to fit the circle. */
export const textTex = (text: string) =>
  canvasTex(`cftext${text}`, 512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = "#0d1430";
    g.textAlign = "center";
    g.textBaseline = "middle";
    const words = text.split(/\s+/);
    let size = 92;
    let lines: string[] = [];
    for (; size >= 40; size -= 6) {
      g.font = `600 ${size}px ${FONT}, sans-serif`;
      lines = [];
      let cur = "";
      for (const wd of words) {
        const next = cur ? `${cur} ${wd}` : wd;
        if (g.measureText(next).width > w * 0.72 && cur) { lines.push(cur); cur = wd; } else cur = next;
      }
      lines.push(cur);
      if (lines.length * size * 1.12 < h * 0.62 && lines.every((l) => g.measureText(l).width < w * 0.78)) break;
    }
    const lh = size * 1.12, y0 = h / 2 - ((lines.length - 1) * lh) / 2;
    lines.forEach((l, i) => g.fillText(l, w / 2, y0 + i * lh));
  });
