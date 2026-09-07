// Servidor estático simples para revisar os mockups localmente.
// Sem dependências: usa só o que vem no Node.
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT) || 4173;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".obj": "text/plain; charset=utf-8",
  ".sh3d": "application/zip",
  ".zip": "application/zip",
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);

  // Atalho: a raiz abre direto o mockup da galeria.
  if (urlPath === "/") urlPath = "/mockups/galeria-casas/mockup.html";

  const filePath = path.join(ROOT, urlPath);

  // Impede sair da pasta do projeto.
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403).end("403 — fora do diretório do projeto");
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || stat.isDirectory()) {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<meta charset="utf-8"><body style="font-family:system-ui;padding:40px">
        <h1>404</h1><p>Não encontrei <code>${urlPath}</code></p>
        <p><a href="/">Abrir a galeria</a></p></body>`);
      return;
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store", // sempre serve a versão mais recente do arquivo
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`Servindo ${ROOT}`);
  console.log(`Galeria:  http://localhost:${PORT}/`);
  console.log(`Dossiê:   http://localhost:${PORT}/plans/showroom-3d/ANALISE-GLB.html`);
});
