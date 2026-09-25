const ALLOWED_ORIGIN = "https://nxdev002.github.io/";

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin)
      });
    }

    if (request.method !== "GET") {
      return jsonResponse(
        { error: "Method not allowed" },
        405,
        origin
      );
    }

    const url = new URL(request.url);

    if (url.pathname !== "/rate") {
      return jsonResponse(
        { error: "Not found" },
        404,
        origin
      );
    }

    if (origin !== ALLOWED_ORIGIN) {
      return jsonResponse(
        { error: "Forbidden" },
        403,
        origin
      );
    }

    if (!env.WISE_API_TOKEN) {
      return jsonResponse(
        { error: "Wise API token is not configured" },
        500,
        origin
      );
    }

    try {
      const wiseUrl = new URL("https://api.wise.com/2026Q3/rates");

      wiseUrl.searchParams.set("source", "AUD");
      wiseUrl.searchParams.set("target", "PHP");

      const response = await fetch(wiseUrl.toString(), {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${env.WISE_API_TOKEN}`,
          "Accept": "application/json"
        }
      });

      if (!response.ok) {
        const errorText = await response.text();

        console.error("Wise API error:", response.status, errorText);

        return jsonResponse(
          {
            error: "Wise API request failed",
            status: response.status
          },
          502,
          origin
        );
      }

      const data = await response.json();

      if (!Array.isArray(data) || !data.length || typeof data[0].rate !== "number") {
        console.error("Unexpected Wise response:", data);

        return jsonResponse(
          { error: "Invalid response from Wise" },
          502,
          origin
        );
      }

      const rateData = data[0];

      return jsonResponse(
        {
          rate: rateData.rate,
          source: rateData.source,
          target: rateData.target,
          time: rateData.time
        },
        200,
        origin,
        {
          "Cache-Control": "public, max-age=3600"
        }
      );
    } catch (error) {
      console.error("Worker error:", error);

      return jsonResponse(
        { error: "Unable to retrieve exchange rate" },
        500,
        origin
      );
    }
  }
};

function corsHeaders(origin) {
  const headers = {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };

  if (origin === ALLOWED_ORIGIN) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

function jsonResponse(data, status, origin, additionalHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin),
      ...additionalHeaders
    }
  });
}