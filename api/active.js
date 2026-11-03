'use strict';
/**
 * /api/active — bo de dang dung CHUNG cho moi thiet bi (Vercel Serverless Function).
 *   GET  -> { set: "goc" | "de400" | null }          (null = chua dat / chua cau hinh luu tru)
 *   POST -> { password, set }  doi bo de (can mat khau admin)
 *
 * Luu o Redis qua REST (Upstash / Vercel KV). Can 2 bien moi truong, Vercel tu them khi
 * ban noi "Upstash Redis" vao project:  KV_REST_API_URL + KV_REST_API_TOKEN
 * (hoac UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN).
 * Tuy chon: ADMIN_HASH = SHA-256("tnthu-admin:" + mat_khau) de doi mat khau ma khong sua code.
 */
const crypto = require('crypto');

const KEY = 'tn:activeSet';
const SALT = 'tnthu-admin:';
const DEFAULT_HASH = '95f0584a75d7774fdd04471cef27c685fa7d5c1616395905acd46090f6404ffe';
const ALLOWED = ['goc', 'de400'];

const redisUrl = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const redisToken = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';

async function redis(...cmd) {
  const res = await fetch(redisUrl(), {
    method: 'POST',
    headers: { Authorization: `Bearer ${redisToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) throw new Error(`redis ${res.status}`);
  return (await res.json()).result;
}

function passwordOk(password) {
  const want = (process.env.ADMIN_HASH || DEFAULT_HASH).toLowerCase();
  const got = crypto.createHash('sha256').update(SALT + String(password || '')).digest('hex');
  const a = Buffer.from(got);
  const b = Buffer.from(want);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const configured = Boolean(redisUrl() && redisToken());

  if (req.method === 'GET') {
    if (!configured) return res.status(200).json({ set: null, configured: false });
    try {
      const value = await redis('GET', KEY);
      return res.status(200).json({ set: ALLOWED.includes(value) ? value : null, configured: true });
    } catch (err) {
      return res.status(200).json({ set: null, configured: true, error: 'redis' });
    }
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (err) { body = {}; } }
    body = body || {};
    if (!passwordOk(body.password)) return res.status(401).json({ error: 'Sai mật khẩu.' });
    if (!ALLOWED.includes(body.set)) return res.status(400).json({ error: 'Bộ đề không hợp lệ.' });
    if (!configured) return res.status(501).json({ error: 'Chưa nối Redis (thiếu KV_REST_API_URL / KV_REST_API_TOKEN).' });
    try {
      await redis('SET', KEY, body.set);
      return res.status(200).json({ set: body.set });
    } catch (err) {
      return res.status(502).json({ error: 'Không ghi được vào Redis.' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
};
