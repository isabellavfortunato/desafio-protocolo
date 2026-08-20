// Função de servidor que fala com a Anthropic usando a SUA chave.
// A chave fica numa variável de ambiente do Netlify (ANTHROPIC_API_KEY),
// nunca no código nem no navegador.
//
// Camadas de proteção desta função:
//  1. Trava de origem (CORS): só aceita chamadas vindas do seu próprio site.
//     Defina a variável SITE_ORIGIN no Netlify com o endereço do seu site,
//     por exemplo https://seu-site.netlify.app. Aceita mais de um, separados
//     por vírgula. Se você não definir, a função funciona mas sem essa trava.
//  2. Sessão: confere que quem chama é um usuário autenticado do SEU projeto
//     Firebase, usando FIREBASE_WEB_API_KEY (o apiKey público do firebaseConfig).
//     O token vem pelo cabeçalho Authorization, nunca pela URL.
//  3. Limite de tamanho: recusa imagens muito grandes.

const MODEL = "claude-sonnet-5"; // troque aqui se quiser um modelo mais econômico
const MAX_IMAGE_BASE64 = 5 * 1024 * 1024; // ~5 MB de imagem já em base64

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

exports.handler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin || "";
  const headers = corsHeaders(origin);

  // resposta ao preflight do navegador
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "Método não permitido" }) };

  // trava de origem: se você configurou SITE_ORIGIN, só passa quem vier de lá
  const list = allowedOrigins();
  if (list.length > 0 && origin && !list.includes(origin)) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: "Origem não autorizada" }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { image, media_type } = body;

    // sessão do usuário, lida do cabeçalho Authorization
    const authHeader = event.headers.authorization || event.headers.Authorization || "";
    const idToken = authHeader.replace(/^Bearer\s+/i, "") || body.idToken;
    const webKey = process.env.FIREBASE_WEB_API_KEY;
    if (!webKey) return { statusCode: 500, headers, body: JSON.stringify({ error: "FIREBASE_WEB_API_KEY não configurada no Netlify" }) };
    if (!idToken) return { statusCode: 401, headers, body: JSON.stringify({ error: "Sessão ausente" }) };
    const vr = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + webKey, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idToken }),
    });
    const vd = await vr.json();
    if (!vd.users || !vd.users.length) return { statusCode: 401, headers, body: JSON.stringify({ error: "Sessão inválida" }) };

    if (!image) return { statusCode: 400, headers, body: JSON.stringify({ error: "Imagem ausente" }) };
    if (typeof image !== "string" || image.length > MAX_IMAGE_BASE64)
      return { statusCode: 413, headers, body: JSON.stringify({ error: "Imagem muito grande" }) };

    const prompt =
      "Você está analisando um print dos insights de um vídeo do Instagram de uma criadora de conteúdo. " +
      "Leia da imagem, quando aparecerem: número de visualizações, número de seguidores ganhos, número de interações, " +
      "número de salvamentos e o tempo de retenção no vídeo (copie exatamente como aparecer, por exemplo em segundos ou em porcentagem). " +
      "Depois faça uma análise curta e encorajadora em português do Brasil, com no máximo três frases, comentando o desempenho e sugerindo um próximo passo. " +
      "Responda apenas com um objeto JSON válido, sem markdown e sem texto ao redor, no formato exato: " +
      '{"visualizacoes": number ou null, "seguidores_ganhos": number ou null, "interacoes": number ou null, "salvamentos": number ou null, "retencao": "texto" ou null, "analise": "texto"}. ' +
      "Use null quando o dado não aparecer no print.";

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: media_type || "image/jpeg", data: image } },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });
    const data = await r.json();
    if (data.error) return { statusCode: 502, headers, body: JSON.stringify({ error: data.error.message || "Erro na API" }) };
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
    return { statusCode: 200, headers, body: JSON.stringify({ text }) };
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: String(e) }) };
  }
};
