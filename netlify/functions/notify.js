// Função de servidor que avisa a organização por e-mail quando alguém escreve
// no diário dos bastidores. O aviso sai pelo Resend, usando a sua chave, que
// fica numa variável de ambiente do Netlify e nunca aparece no navegador.
//
// Variáveis usadas no Netlify:
//  RESEND_API_KEY   a chave do Resend, começa com re_
//  NOTIFY_TO        os e-mails que recebem o aviso, separados por vírgula
//  NOTIFY_FROM      opcional, o remetente. Sem domínio próprio verificado no
//                   Resend, deixe em branco e ele usa onboarding@resend.dev
//  NOTIFY_INCLUDE_TEXT  opcional. Escreva nao para o e-mail avisar sem copiar
//                   o texto do diário, servindo só como sinal de que chegou algo
//
// Se a chave não estiver configurada, a função responde sem erro e o
// aplicativo segue funcionando normalmente, apenas sem o aviso.

const MAX_TEXT = 4000;

function allowedOrigins() {
  return (process.env.SITE_ORIGIN || "")
    .split(",").map((s) => s.trim()).filter(Boolean);
}
function corsHeaders(origin) {
  const list = allowedOrigins();
  const h = { "content-type": "application/json" };
  if (list.length === 0) { h["Access-Control-Allow-Origin"] = "*"; }
  else if (origin && list.includes(origin)) { h["Access-Control-Allow-Origin"] = origin; }
  h["Vary"] = "Origin";
  h["Access-Control-Allow-Methods"] = "POST, OPTIONS";
  h["Access-Control-Allow-Headers"] = "content-type, authorization";
  return h;
}
const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

exports.handler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin || "";
  const headers = corsHeaders(origin);

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "Método não permitido" }) };

  const list = allowedOrigins();
  if (list.length > 0 && origin && !list.includes(origin)) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: "Origem não autorizada" }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");

    // sessão do usuário, lida do cabeçalho Authorization
    const authHeader = event.headers.authorization || event.headers.Authorization || "";
    const idToken = authHeader.replace(/^Bearer\s+/i, "");
    const webKey = process.env.FIREBASE_WEB_API_KEY;
    if (!webKey) return { statusCode: 500, headers, body: JSON.stringify({ error: "FIREBASE_WEB_API_KEY não configurada no Netlify" }) };
    if (!idToken) return { statusCode: 401, headers, body: JSON.stringify({ error: "Sessão ausente" }) };
    const vr = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + webKey, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idToken }),
    });
    const vd = await vr.json();
    if (!vd.users || !vd.users.length) return { statusCode: 401, headers, body: JSON.stringify({ error: "Sessão inválida" }) };

    const key = process.env.RESEND_API_KEY;
    const to = (process.env.NOTIFY_TO || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (!key || to.length === 0) return { statusCode: 200, headers, body: JSON.stringify({ ok: true, enviado: false }) };

    const nome = String(body.name || vd.users[0].email || "uma participante").slice(0, 80);
    const texto = String(body.text || "").slice(0, MAX_TEXT);
    const comTexto = String(process.env.NOTIFY_INCLUDE_TEXT || "sim").trim().toLowerCase() !== "nao";
    const from = process.env.NOTIFY_FROM || "Desafio 50 vídeos <onboarding@resend.dev>";
    const quando = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    const corpo = comTexto
      ? '<p style="font-family:Georgia,serif;font-size:16px;">' + esc(nome) + " escreveu no diário dos bastidores em " + esc(quando) + ".</p>"
        + '<blockquote style="font-family:Georgia,serif;font-size:16px;line-height:1.6;border-left:3px solid #ff0095;margin:16px 0;padding:4px 0 4px 14px;white-space:pre-wrap;">'
        + esc(texto) + "</blockquote>"
        + '<p style="font-family:Georgia,serif;font-size:14px;color:#666;">Abra o aplicativo e entre em Organização para responder ou ver o histórico.</p>'
      : '<p style="font-family:Georgia,serif;font-size:16px;">' + esc(nome) + " escreveu no diário dos bastidores em " + esc(quando) + "."
        + " Abra o aplicativo e entre em Organização para ler.</p>";

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + key },
      body: JSON.stringify({
        from,
        to,
        subject: "Diário dos bastidores: " + nome + " escreveu",
        html: corpo,
      }),
    });
    const data = await r.json();
    if (!r.ok) return { statusCode: 200, headers, body: JSON.stringify({ ok: true, enviado: false, detalhe: data && data.message }) };
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, enviado: true }) };
  } catch (e) {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, enviado: false, detalhe: String(e) }) };
  }
};
