// Converte as imagens da visita de 2023 (referencias/) para WebP em client/public/tour.
// Uso: node scripts/convert-tour-images.mjs (precisa de referencias/kampus-front clonado).
// [POR CONFIRMAR: autoria e licença das imagens da visita]
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const SRC = "referencias/kampus-front/kampus/src/assets/images";
const OUT = "client/public/tour";
mkdirSync(OUT, { recursive: true });

const scenes = {
  "entrance.jpg": "entrance",
  "sala_web.jpg": "web-dev",
  "sala-ux.jpg": "ux-ui",
  "sala-data.jpg": "data",
  "kitchen.jpg": "kitchen",
  "sala-lazer.jpg": "lounge",
};
const guides = {
  "T3.png": "guide-program-manager",
  "T1.png": "guide-lead-teacher",
  "T2.png": "guide-teaching-assistant",
  "T4.png": "guide-career-coach",
};

for (const [file, name] of Object.entries(scenes)) {
  for (const width of [1600, 900]) {
    const suffix = width === 1600 ? "" : `-${width}`;
    await sharp(`${SRC}/${file}`).resize({ width }).webp({ quality: 72 }).toFile(`${OUT}/${name}${suffix}.webp`);
  }
}
for (const [file, name] of Object.entries(guides)) {
  await sharp(`${SRC}/${file}`).resize({ width: 480, height: 480, fit: "inside" }).webp({ quality: 80 }).toFile(`${OUT}/${name}.webp`);
}
console.log("Tour images converted.");
