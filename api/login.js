// Login verification endpoint for the access-code gate.
//
// The browser sends the access code as an x-access-code header; this checks it against
// the ACCESS_CODE env var and returns 200 {ok:true} or 401. No Anthropic call — instant and free.
// The real AI proxy (api/anthropic.js) still re-validates the code on every request, so this
// endpoint is purely for the login UX (reject a wrong code up front instead of letting the user in).

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }
  if (!process.env.ACCESS_CODE) {
    res.status(500).json({ ok: false, error: 'Server not configured: missing ACCESS_CODE.' });
    return;
  }
  const provided = req.headers['x-access-code'];
  if (provided && provided === process.env.ACCESS_CODE) {
    res.status(200).json({ ok: true });
    return;
  }
  res.status(401).json({ ok: false });
};
