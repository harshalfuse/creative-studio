// Vercel Serverless Function — /api/generate
// Accepts POST { command, platform } and returns a structured design JSON.
// Auto-detects which LLM provider to use based on which env var is set:
//   GEMINI_API_KEY  → Google Gemini 1.5 Flash   (recommended — generous free tier)
//   GROQ_API_KEY    → Groq Llama 3.3 70B        (fastest — free)
//   ANTHROPIC_API_KEY → Claude Haiku            (if you have Anthropic credit)
//   OPENROUTER_API_KEY → any model (default free Llama)
//   OPENAI_API_KEY  → gpt-4o-mini
//
// If none is set, returns 503 and the frontend falls back to a keyword parser.

const VALID = {
  styles:   ['bold','pro','creative','minimal','tech','warm','editorial','retro'],
  layouts:  ['full','split','card','quote','stat','top'],
  themes:   ['indigo','midnight','sunset','ocean','forest','coral','cream','lilac','mono','paper','grape','slate','neon','brand'],
  fonts:    ['inter','space','playfair','archivo','bricolage','dmserif','manrope','jakarta','caslon','mono'],
  platforms:['li-land','li-sq','ig-sq','ig-port','ig-story','tw','fb','wa']
};

const SYSTEM_PROMPT = `You are a senior in-house social-media designer at Joveo — a programmatic recruitment-advertising and talent-marketing platform. The user will give you a short natural-language command describing a post they want. Your job is to respond with a strict JSON object describing a single on-brand social media post.

Return EXACTLY this JSON shape and nothing else (no markdown fences, no prose, no explanation):

{
  "eyebrow": string,      // short label/tag above the headline, uppercase, <= 24 chars. Can be "".
  "headline": string,     // the big punchy line, <= 60 chars.
  "subhead": string,      // optional supporting line, <= 80 chars. Can be "".
  "body": string,         // optional body / details, <= 140 chars. Can be "".
  "cta": string,          // call to action, <= 24 chars. Include an arrow if fitting (e.g. "Apply now →"). Can be "".
  "handle": string,       // social handle. Default "@joveo".
  "style": one of: ${VALID.styles.join(' | ')},
  "layout": one of: ${VALID.layouts.join(' | ')},
  "theme": one of: ${VALID.themes.join(' | ')},
  "font": one of: ${VALID.fonts.join(' | ')}
}

STYLE GUIDE:
- bold: heavy display type, high contrast. Use for launches, events, flash moments.
- pro: clean corporate, structured. Use for hiring, client wins, reports.
- creative: geometric, playful. Use for brand moments, fun announcements.
- minimal: airy, elegant. Use for quotes, subtle announcements.
- tech: dark, neon. Use for engineering posts, AI updates, data stories.
- warm: soft, friendly. Use for team, culture, celebrations.
- editorial: serif-forward, magazine-like. Use for quotes, opinion.
- retro: punchy vintage. Use for attention-grabbing drops.

LAYOUT:
- full: default full-bleed headline-centered.
- split: text on one side, visual on the other.
- card: centered card treatment with extra padding.
- quote: centered, editorial quote-style.
- stat: oversize number first — use when headline is a number.
- top: text pushed to top of canvas (carousel covers).

THEME PALETTES:
- indigo: corporate navy + gold
- midnight: dark + neon-green
- sunset: warm red
- ocean: teal
- forest: deep green + cream
- coral: warm peach
- cream: light paper + black
- lilac: lavender + purple
- mono: black + electric-yellow
- paper: off-white + red-accent
- grape: deep purple + pink
- slate: charcoal + sky-blue
- neon: dark + electric-cyan
- brand: the user's saved brand kit colors (Joveo)

Pick the style, layout, theme, and font that best fit the command. Be opinionated.

Keep copy punchy, scroll-stopping, and platform-appropriate. Never invent competitor names, client names, or numbers. If the user provides a specific quote or number, keep it verbatim.

Output ONLY the JSON object.`;

function headers(key) {
  return { 'Content-Type': 'application/json', ...(key ? { 'Authorization': `Bearer ${key}` } : {}) };
}

async function callGemini(command, platform) {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: `Platform: ${platform}\nCommand: ${command}` }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.7, maxOutputTokens: 512 }
  };
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${await r.text()}`);
  const data = await r.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return parseAndValidate(text);
}

async function callGroq(command, platform) {
  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST', headers: headers(process.env.GROQ_API_KEY),
    body: JSON.stringify({
      model, temperature: 0.7, max_tokens: 512,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Platform: ${platform}\nCommand: ${command}` }
      ]
    })
  });
  if (!r.ok) throw new Error(`Groq ${r.status}: ${await r.text()}`);
  const data = await r.json();
  return parseAndValidate(data?.choices?.[0]?.message?.content);
}

async function callAnthropic(command, platform) {
  const model = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model, max_tokens: 1024, temperature: 0.7,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Platform: ${platform}\nCommand: ${command}` }]
    })
  });
  if (!r.ok) throw new Error(`Anthropic ${r.status}: ${await r.text()}`);
  const data = await r.json();
  return parseAndValidate(data?.content?.[0]?.text);
}

async function callOpenRouter(command, platform) {
  const model = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free';
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST', headers: headers(process.env.OPENROUTER_API_KEY),
    body: JSON.stringify({
      model, temperature: 0.7, max_tokens: 512,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Platform: ${platform}\nCommand: ${command}` }
      ]
    })
  });
  if (!r.ok) throw new Error(`OpenRouter ${r.status}: ${await r.text()}`);
  const data = await r.json();
  return parseAndValidate(data?.choices?.[0]?.message?.content);
}

async function callOpenAI(command, platform) {
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: headers(process.env.OPENAI_API_KEY),
    body: JSON.stringify({
      model, temperature: 0.7, max_tokens: 512,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Platform: ${platform}\nCommand: ${command}` }
      ]
    })
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${await r.text()}`);
  const data = await r.json();
  return parseAndValidate(data?.choices?.[0]?.message?.content);
}

function parseAndValidate(text) {
  if (!text) throw new Error('Empty model output');
  const cleaned = String(text).replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  let obj;
  try { obj = JSON.parse(cleaned); }
  catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('Model did not return JSON: ' + cleaned.slice(0, 200));
    obj = JSON.parse(m[0]);
  }
  const clamp = (v, list, fb) => list.includes(v) ? v : fb;
  return {
    eyebrow:  String(obj.eyebrow  ?? '').slice(0, 60),
    headline: String(obj.headline ?? '').slice(0, 120),
    subhead:  String(obj.subhead  ?? '').slice(0, 160),
    body:     String(obj.body     ?? '').slice(0, 300),
    cta:      String(obj.cta      ?? '').slice(0, 40),
    handle:   String(obj.handle   ?? '@joveo').slice(0, 40),
    style:    clamp(obj.style,  VALID.styles,  'pro'),
    layout:   clamp(obj.layout, VALID.layouts, 'split'),
    theme:    clamp(obj.theme,  VALID.themes,  'indigo'),
    font:     clamp(obj.font,   VALID.fonts,   'space')
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  const { command, platform = 'li-land' } = body;
  if (!command || typeof command !== 'string') {
    return res.status(400).json({ error: 'Missing "command" string in request body' });
  }

  try {
    let design, provider;
    if      (process.env.GEMINI_API_KEY)     { design = await callGemini(command, platform);     provider = 'gemini'; }
    else if (process.env.GROQ_API_KEY)       { design = await callGroq(command, platform);       provider = 'groq'; }
    else if (process.env.ANTHROPIC_API_KEY)  { design = await callAnthropic(command, platform);  provider = 'anthropic'; }
    else if (process.env.OPENROUTER_API_KEY) { design = await callOpenRouter(command, platform); provider = 'openrouter'; }
    else if (process.env.OPENAI_API_KEY)     { design = await callOpenAI(command, platform);     provider = 'openai'; }
    else {
      return res.status(503).json({
        error: 'No LLM API key configured on the server',
        hint: 'Set one of these as a Vercel env var: GEMINI_API_KEY (recommended), GROQ_API_KEY, ANTHROPIC_API_KEY, OPENROUTER_API_KEY, OPENAI_API_KEY'
      });
    }
    return res.status(200).json({ ok: true, provider, ...design });
  } catch (e) {
    console.error('[generate] error:', e);
    return res.status(500).json({ error: e.message || 'LLM request failed' });
  }
}
