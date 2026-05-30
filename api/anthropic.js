// Serverless proxy for the Anthropic Messages API.
//
// Why this exists: the pharmacy uses ONE shared Anthropic key. If the browser called
// api.anthropic.com directly, anyone could read the key from network traffic and burn credits.
// This function keeps the key server-side and gates access with a shared pharmacy passcode.
//
// It also OWNS the model id and a max_tokens ceiling — the client only sends `task` + `messages`,
// so a leaked access code can't be used to call arbitrary models at arbitrary cost.
//
// Required env vars (set in the Vercel dashboard, never commit them):
//   ANTHROPIC_API_KEY   - your Anthropic API key (sk-ant-...)
//   ACCESS_CODE         - the shared passcode pharmacy staff type into the app
// Optional overrides:
//   CLAUDE_TEXT_MODEL   - default "claude-sonnet-4-6"  (Drug Enrichment, text)
//   CLAUDE_VISION_MODEL - default "claude-opus-4-8"    (PharmAudit, photo extraction)
//   MAX_TOKENS_CEILING  - default 4000

const TEXT_MODEL = process.env.CLAUDE_TEXT_MODEL || 'claude-sonnet-4-6';
const VISION_MODEL = process.env.CLAUDE_VISION_MODEL || 'claude-opus-4-8';
const MAX_TOKENS_CEILING = parseInt(process.env.MAX_TOKENS_CEILING || '4000', 10);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Method not allowed' } });
    return;
  }

  // Server misconfiguration guard.
  if (!process.env.ANTHROPIC_API_KEY || !process.env.ACCESS_CODE) {
    res.status(500).json({ error: { message: 'Server not configured: missing ANTHROPIC_API_KEY or ACCESS_CODE.' } });
    return;
  }

  // Access gate.
  const provided = req.headers['x-access-code'];
  if (!provided || provided !== process.env.ACCESS_CODE) {
    res.status(401).json({ error: { message: 'Invalid or missing access code.' } });
    return;
  }

  // Body may arrive parsed (Vercel) or as a raw string — handle both.
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const { task, messages, system } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: { message: 'Request must include a non-empty messages array.' } });
    return;
  }

  const model = task === 'vision' ? VISION_MODEL : TEXT_MODEL;
  const maxTokens = Math.min(parseInt(body.max_tokens, 10) || 1024, MAX_TOKENS_CEILING);

  const payload = { model, max_tokens: maxTokens, messages };
  if (system) payload.system = system;

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });

    // Pass Anthropic's status + body straight through so the existing client code
    // (`if (data.error) throw ...`, `data.content.map(c => c.text)`) keeps working unchanged.
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', 'application/json');
    res.send(text);
  } catch (err) {
    res.status(502).json({ error: { message: 'Upstream request to Anthropic failed: ' + (err.message || 'unknown error') } });
  }
};
