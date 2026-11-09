// Servidor mínimo (sin dependencias) para guardar las evaluaciones en data/evaluaciones.json
//
// Uso:   node guardar-evaluacion.js
// Rutas: POST /api/evaluar        body {"estrellas": 1..5}  -> suma el voto y devuelve el JSON actualizado
//        GET  /api/evaluaciones   -> devuelve el JSON actual
//
// Variables opcionales:
//   PORT            puerto (por defecto 3000)
//   ALLOWED_ORIGIN  dominio de la web, p. ej. https://am-beauty-studio.github.io

const http = require('http');
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'data', 'evaluaciones.json');
const PORT = process.env.PORT || 3000;
const ORIGIN = process.env.ALLOWED_ORIGIN || '*';

function read() {
  try {
    const d = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (Array.isArray(d.votos) && d.votos.length === 5) return d;
  } catch (e) { /* sin archivo todavía: 0 evaluaciones */ }
  return { votos: [0, 0, 0, 0, 0] };
}

function write(d) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(d, null, 2));
  fs.renameSync(tmp, FILE);
}

function send(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  const url = req.url.split('?')[0];

  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  if (req.method === 'GET' && url === '/api/evaluaciones') return send(res, 200, read());

  if (req.method === 'POST' && url === '/api/evaluar') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; if (body.length > 1024) req.destroy(); });
    req.on('end', () => {
      let n = 0;
      try { n = Number(JSON.parse(body).estrellas); } catch (e) { /* cuerpo inválido */ }
      if (!Number.isInteger(n) || n < 1 || n > 5) return send(res, 400, { error: 'estrellas debe ser un entero de 1 a 5' });
      const d = read();
      d.votos[n - 1]++;
      write(d);
      send(res, 200, d);
    });
    return;
  }

  send(res, 404, { error: 'No encontrado' });
}).listen(PORT, () => console.log('Evaluaciones en http://localhost:' + PORT));
