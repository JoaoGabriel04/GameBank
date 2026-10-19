// Fase 4 (P2.1): converte as imagens pesadas de client/public/images para
// WebP no tamanho em que são exibidas (no máximo 2x o tamanho de tela).
// Roda no container do cliente, que tem o sharp do Next:
//   docker exec -w /app sgp-client-dev node /repo-scripts/converter-imagens.cjs
// (ou copie o arquivo para client/ e rode `node converter-imagens.cjs`).
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const DIR = path.join(process.cwd(), "public/images");

// [origem, destino, lado máximo em px, qualidade WebP]
const CONVERSOES = [
  // Pacotes da loja: exibidos em cards de ~200-260px (w-3/5) → 512px cobre 2x.
  ...[1, 2, 3, 4, 5, 6].flatMap((n) => [
    [`coin-shop-${n}.png`, `coin-shop-${n}.webp`, 512, 80],
    [`diamond-shop-${n}.png`, `diamond-shop-${n}.webp`, 512, 80],
  ]),
  // Cofres (baús): cards de ~128-160px e a animação de abertura (~300px).
  ["Cofrinho.png", "cofrinho.webp", 640, 82],
  ["Cofre Premium.png", "cofre-premium.webp", 640, 82],
  ["Cofre Lendário.png", "cofre-lendario.webp", 640, 82],
  // Fundo das páginas /user: tela inteira, mas com opacidade de 4%.
  ["hexa-background.png", "hexa-background.webp", 1376, 55],
  // Hero da landing: tela inteira, bg-cover.
  ["ceu-cidade-vistacima.png", "ceu-cidade-vistacima.webp", 1600, 75],
];

(async () => {
  let antes = 0;
  let depois = 0;
  for (const [origem, destino, lado, qualidade] of CONVERSOES) {
    const de = path.join(DIR, origem);
    const para = path.join(DIR, destino);
    await sharp(de)
      .resize({ width: lado, height: lado, fit: "inside", withoutEnlargement: true })
      .webp({ quality: qualidade, effort: 6 })
      .toFile(para);
    const a = fs.statSync(de).size;
    const d = fs.statSync(para).size;
    antes += a;
    depois += d;
    console.log(`${(a / 1024).toFixed(0).padStart(5)} KB → ${(d / 1024).toFixed(0).padStart(4)} KB  ${origem} → ${destino}`);
  }
  console.log(`\nTotal: ${(antes / 1024 / 1024).toFixed(1)} MB → ${(depois / 1024 / 1024).toFixed(2)} MB`);
})();
