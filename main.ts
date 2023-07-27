import { Application, Router, Context, send } from "https://deno.land/x/oak/mod.ts";
import { Redis } from "https://deno.land/x/upstash_redis/mod.ts";

const app = new Application();
const router = new Router();

const UPSTASH_REDIS_REST_URL = Deno.env.get("UPSTASH_REDIS_REST_URL");
const UPSTASH_REDIS_REST_TOKEN = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");
const DISCORD_WEBHOOK_URL = Deno.env.get("DISCORD_WEBHOOK_URL");
const PORT = Deno.env.get("PORT") || "3000";

console.log(UPSTASH_REDIS_REST_URL)
const redis = new Redis({
  url: UPSTASH_REDIS_REST_URL,
  token: UPSTASH_REDIS_REST_TOKEN,
})
const PLACES = 7;

export function makeSvg(count: number) {
  const countArray = count.toString().padStart(PLACES, "0").split("");
  const parts = countArray.reduce(
    (acc, next, index) =>
      `${acc}
       <rect id="Rectangle" fill="#000000" x="${index * 32}" width="29" height="29"></rect>
       <text id="0" font-family="Courier" font-size="24" font-weight="normal" fill="#00FF13">
           <tspan x="${index * 32 + 7}" y="22">${next}</tspan>
       </text>
`,
    ""
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg width="${PLACES * 32}px" height="30px" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
      <title>Count</title>
      <g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
        ${parts}
      </g>
  </svg>
  `;
}

router.get("/:key/count.svg", async (context: Context) => {
  try {
    const { key } = context.params;
    let count = await redis.get(key);

    if (!count) {
      count = "1";
      await redis.set(key, count);
    } else {
      count = String(parseInt(count) + 1);
      await redis.set(key, count);
    }

    // Send message to Discord via webhook
    await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `Hit count for ${key}: ${count}`,
      }),
    });

    // Create SVG
    const svg = makeSvg(parseInt(count));

    context.response.headers.set("Content-Type", "image/svg+xml");
    context.response.headers.set("Cache-Control":"max-age=0, no-cache, no-store, must-revalidate")

    context.response.body = svg;
  } catch (error) {
    console.error("Error occurred:", error);
    context.response.status = 500;
    context.response.body = "Internal Server Error";
  }
});

router.get("/:key/", async (context: Context) => {
  try {
    const { key } = context.params;
    let count = await redis.get(key);

    if (!count) {
      count = "0";
    }

    const response = {
      key,
      count,
    };

    context.response.headers.set("Content-Type", "application/json");
    context.response.body = JSON.stringify(response);
  } catch (error) {
    console.error("Error occurred:", error);
    context.response.status = 500;
    context.response.body = "Internal Server Error";
  }
});


app.use(router.routes());
app.use(router.allowedMethods());

// app.use(async (context: Context) => {
//   await send(context, context.request.url.pathname, {
//     root: `${Deno.cwd()}/public`,
//   });
// });

console.log(`Server is running on port ${PORT}`);
await app.listen({ port: parseInt(PORT) });
