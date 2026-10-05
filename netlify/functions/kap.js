const KAP_BASE = "https://www.kap.org.tr";
const LIST_URL = `${KAP_BASE}/tr/api/disclosure/members/byCriteria`;

function corsHeaders() {
  return {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "Content-Type",
    "cache-control": "public, max-age=60, s-maxage=120"
  };
}

function isoDateTR(daysAgo = 0) {
  const now = new Date();
  const trNow = new Date(
    now.toLocaleString("en-US", { timeZone: "Europe/Istanbul" })
  );

  trNow.setDate(trNow.getDate() - daysAgo);

  const y = trNow.getFullYear();
  const m = String(trNow.getMonth() + 1).padStart(2, "0");
  const d = String(trNow.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

function splitSymbols(value) {
  if (!value) return [];

  return String(value)
    .toUpperCase()
    .split(/[,\s;/]+/)
    .map(x => x.trim())
    .filter(Boolean)
    .slice(0, 50);
}

function disclosureSymbols(d) {
  const raw = [
    d.relatedStocks,
    d.stockCodes,
    d.fundCode
  ]
    .filter(Boolean)
    .join(",");

  return [
    ...new Set(
      raw
        .toUpperCase()
        .split(/[,\s;/]+/)
        .map(x => x.trim())
        .filter(Boolean)
    )
  ];
}

function normalizeDisclosure(d) {
  const symbols = disclosureSymbols(d);
  const index = d.disclosureIndex;

  const subject =
    d.subject ||
    d.summary ||
    "KAP Bildirimi";

  const company = d.kapTitle || "";
  const summary = d.summary || "";

  const title =
    company && company !== subject
      ? `${company} — ${subject}`
      : subject;

  return {
    id: index,
    date: d.publishDate || "",
    symbols,
    title,
    text: summary || subject,
    subject,
    company,

    url: index
      ? `${KAP_BASE}/tr/Bildirim/${index}`
      : `${KAP_BASE}/tr/bildirim-sorgu`,

    disclosureClass: d.disclosureClass || "",
    disclosureType: d.disclosureType || "",
    isLate: !!d.isLate
  };
}

async function fetchWithTimeout(url, options = {}, ms = 12000) {
  const controller = new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    ms
  );

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

exports.handler = async event => {
  const headers = corsHeaders();

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers,
      body: ""
    };
  }

  try {
    const wanted = splitSymbols(
      event.queryStringParameters?.symbols
    );

    const body = {
      fromDate: isoDateTR(7),
      toDate: isoDateTR(0),
      mkkMemberOidList: [],
      subjectList: []
    };

    const commonHeaders = {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",

      accept:
        "application/json, text/plain, */*",

      "accept-language":
        "tr-TR,tr;q=0.9,en;q=0.8",

      referer:
        `${KAP_BASE}/tr/bildirim-sorgu`,

      origin:
        KAP_BASE
    };

    let cookie = "";

    try {
      const warm = await fetchWithTimeout(
        `${KAP_BASE}/tr/bildirim-sorgu`,
        {
          method: "GET",
          headers: commonHeaders,
          redirect: "follow"
        },
        8000
      );

      if (warm?.headers?.getSetCookie) {
        cookie = warm.headers
          .getSetCookie()
          .map(v => v.split(";")[0])
          .join("; ");
      } else {
        const setCookie =
          warm?.headers?.get("set-cookie");

        if (setCookie) {
          cookie = setCookie
            .split(",")
            .map(v => v.split(";")[0])
            .join("; ");
        }
      }
    } catch (_) {}

    const apiHeaders = {
      ...commonHeaders,
      "content-type": "application/json"
    };

    if (cookie) {
      apiHeaders.cookie = cookie;
    }

    const response =
      await fetchWithTimeout(
        LIST_URL,
        {
          method: "POST",
          headers: apiHeaders,
          body: JSON.stringify(body),
          redirect: "follow"
        },
        15000
      );

    if (!response.ok) {
      const preview =
        (await response.text()).slice(0, 300);

      throw new Error(
        `KAP HTTP ${response.status}${
          preview ? " - " + preview : ""
        }`
      );
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error(
        "KAP beklenmeyen veri biçimi döndürdü."
      );
    }

    let items =
      data.map(normalizeDisclosure);

    if (wanted.length) {
      items = items.filter(item =>
        item.symbols.some(symbol =>
          wanted.includes(symbol)
        )
      );
    }

    items = items.slice(0, 20);

    return {
      statusCode: 200,
      headers,

      body: JSON.stringify({
        ok: true,
        source: "KAP",
        fetchedAt:
          new Date().toISOString(),

        requestedSymbols: wanted,
        items
      })
    };

  } catch (error) {
    return {
      statusCode: 502,

      headers: {
        ...headers,
        "cache-control": "no-store"
      },

      body: JSON.stringify({
        ok: false,

        error:
          error?.name === "AbortError"
            ? "KAP isteği zaman aşımına uğradı."
            : String(
                error?.message || error
              ),

        items: []
      })
    };
  }
};
