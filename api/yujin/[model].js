// Vercel 서버 함수: 유진이 질문을 서버의 GEMINI_API_KEY로 Gemini에 대신 물어요(키는 브라우저로 나가지 않아요)
// - GET  /api/yujin/health   → { ok, ai } : 페이지가 서버 키가 있는지 확인해요
// - POST /api/yujin/<모델>    → Gemini streamGenerateContent(SSE)를 그대로 흘려 보내요
// 아무나 키를 마음대로 쓰지 못하게: 허용 모델만, 요청 크기·출력 길이 제한, IP별·하루 호출 수 제한(서버 인스턴스마다 따로 세요)
const { Readable } = require('stream');

const KEY = process.env.GEMINI_API_KEY || '';
const MODELS = new Set(['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-flash-lite-latest']);
const MAX_BODY = 300 * 1024;          // 요청 본문 최대 300KB
const MAX_OUT = 1500;                 // 답변 최대 토큰
const PER_IP = { n: 30, ms: 10 * 60 * 1000 };   // IP당 10분에 30번
const PER_DAY = Number(process.env.DAILY_LIMIT || 1000);

const hits = new Map(); let day = new Date().toDateString(), dayCount = 0;
function allow(ip) {
  const now = Date.now(), today = new Date().toDateString();
  if (today !== day) { day = today; dayCount = 0; }
  if (dayCount >= PER_DAY) return '오늘 시연용 AI 호출 한도를 다 썼어요. 내일 다시 이용해 주세요.';
  const a = (hits.get(ip) || []).filter(t => now - t < PER_IP.ms);
  if (a.length >= PER_IP.n) { hits.set(ip, a); return '요청이 많아요. 10분 뒤에 다시 물어봐 주세요.'; }
  a.push(now); hits.set(ip, a); dayCount++;
  return null;
}
function err(res, code, message) {
  res.statusCode = code; res.setHeader('content-type', 'application/json; charset=utf-8'); res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify({ error: { code, message } }));
}
async function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;   // Vercel이 이미 JSON으로 읽은 경우
  if (typeof req.body === 'string') return JSON.parse(req.body);
  if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString('utf8'));
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > MAX_BODY) throw Object.assign(new Error('too large'), { code: 413 }); chunks.push(c); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

module.exports = async (req, res) => {
  const model = String((req.query && req.query.model) || '');
  if (model === 'health') {
    res.setHeader('content-type', 'application/json; charset=utf-8'); res.setHeader('cache-control', 'no-store');
    return res.end(JSON.stringify({ ok: true, ai: !!KEY }));
  }
  if (req.method !== 'POST') return err(res, 405, 'POST만 가능해요.');
  if (!KEY) return err(res, 503, '서버에 GEMINI_API_KEY가 설정되지 않았어요.');
  if (!MODELS.has(model)) return err(res, 400, '허용되지 않은 모델이에요: ' + model);
  if (Number(req.headers['content-length'] || 0) > MAX_BODY) return err(res, 413, '질문 내용이 너무 길어요.');
  const ip = String(req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || '').split(',')[0].trim();
  const why = allow(ip); if (why) return err(res, 429, why);

  let b;
  try { b = await readBody(req); } catch (e) { return err(res, e.code === 413 ? 413 : 400, e.code === 413 ? '질문 내용이 너무 길어요.' : '요청 형식이 올바르지 않아요.'); }
  if (JSON.stringify(b).length > MAX_BODY) return err(res, 413, '질문 내용이 너무 길어요.');
  // 필요한 필드만 골라 전달하고 출력 길이를 제한해요(도구 호출 등 다른 기능은 막아요)
  const g = Object.assign({}, b.generationConfig || {});
  g.maxOutputTokens = Math.min(Number(g.maxOutputTokens) || MAX_OUT, MAX_OUT);
  const body = JSON.stringify({ systemInstruction: b.systemInstruction, contents: b.contents, generationConfig: g });

  const ac = new AbortController(); req.on('close', () => { if (!res.writableEnded) ac.abort(); });
  let up;
  try {
    up = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':streamGenerateContent?alt=sse',
      { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': KEY }, body, signal: ac.signal });
  } catch (e) { return err(res, 502, 'Gemini 서버에 연결하지 못했어요.'); }
  res.statusCode = up.status;
  res.setHeader('content-type', up.headers.get('content-type') || 'text/event-stream');
  res.setHeader('cache-control', 'no-store');
  if (!up.body) return res.end();
  await new Promise(resolve => { Readable.fromWeb(up.body).on('error', () => { res.end(); resolve(); }).on('end', resolve).pipe(res); });
};
