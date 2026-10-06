exports.handler = async function () {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=30"
  };

  try {
    const apiKey = process.env.HESAPLI_ALTIN_API_KEY;

    if (!apiKey) {
      throw new Error("API anahtarı bulunamadı");
    }

    const response = await fetch(
      "https://hesaplialtin.com/api/v1/public-prices",
      {
        headers: {
          "X-API-Key": apiKey,
          "Accept": "application/json"
        }
      }
    );

    if (!response.ok) {
      throw new Error("API HTTP " + response.status);
    }

    const raw = await response.json();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        data: raw,
        updated_at: new Date().toISOString(),
        source: "Hesaplı Altın"
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
