exports.handler = async function () {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=30"
  };

  try {
    const r = await fetch("https://www.genelpara.com/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BorsaDanisman/1.0)",
        "Accept-Language": "tr-TR,tr;q=0.9"
      }
    });

    if (!r.ok) {
      throw new Error("Kaynak HTTP " + r.status);
    }

    const html = await r.text();

    const clean = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ");

    const defs = {
      USD: ["Dolar", "USD"],
      EUR: ["Euro", "EUR"],
      GA: ["Gram Altın", "GA"],
      GAG: ["Gram Gümüş", "GAG"]
    };

    const data = {};

    const num = (s) =>
      Number(
        String(s)
          .replace(/\./g, "")
          .replace(",", ".")
      );

    for (const [code, [name, sym]] of Object.entries(defs)) {
      const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      let m = clean.match(
        new RegExp(
          esc +
            "\\s+" +
            sym +
            "\\s+([0-9.]+,[0-9]+)\\s+TRY\\s+([+-]?[0-9.,]+)%",
          "i"
        )
      );

      if (!m) {
        m = clean.match(
          new RegExp(
            esc +
              "\\s+([0-9.]+,[0-9]+)\\s+([+-]?[0-9.,]+)%",
            "i"
          )
        );
      }

      if (m) {
        data[code] = {
          price: num(m[1]),
          change: num(m[2])
        };
      }
    }

    if (Object.keys(data).length < 4) {
      throw new Error(
        "Kaynak biçimi değişti; dört piyasa verisi birlikte okunamadı."
      );
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        data,
        updated_at: new Date().toISOString(),
        source: "GenelPara"
      })
    };
  } catch (e) {
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({
        ok: false,
        error: e.message,
        data: {}
      })
    };
  }
};
