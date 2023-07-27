import { Application, Router, Context } from "https://deno.land/x/oak/mod.ts";
import { MongoClient } from "https://deno.land/x/mongo/mod.ts";
import { config } from "https://deno.land/x/dotenv/mod.ts";

const app = new Application();
const router = new Router();

const {
  MONGODB_URI,
  MONGODB_DB,
  DISCORD_WEBHOOK_URL,
  PORT = "3000",
} = config();

const client = new MongoClient();
await client.connect({
  db: MONGODB_DB,
  uri: MONGODB_URI,
});

const db = client.database(MONGODB_DB);
const collection = db.collection("counters");

interface Counter {
  _id: { $oid: string };
  key: string;
  count: number;
}

const PLACES = 7;

export function makeSVG(count: number) {
  const countArray = count.toString().padStart(PLACES, "0").split("");
  const parts = countArray.reduce(
    (acc, next, index) => `
        ${acc}
        <rect id="Rectangle" fill="#000000" x="${index *
      32}" width="29" height="29"></rect>
        <text id="0" font-family="Courier" font-size="24" font-weight="normal" fill="#00FF13">
            <tspan x="${index * 32 + 7}" y="22">${next}</tspan>
        </text>
`,
    ""
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg width="${PLACES *
    32}px" height="30px" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
      <title>Count</title>
      <g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
        ${parts}
      </g>
  </svg>
  `;
};

router.get("/:key/count", async (context: Context) => {
  try {
    const { key } = context.params;
    const counter: Counter | null = await collection.findOne({ key });

    if (counter) {
      // Increment the counter
      const updatedCount = counter.count + 1;
      await collection.updateOne(
        { _id: counter._id },
        { $set: { count: updatedCount } }
      );

      // Send message to Discord via webhook
      await fetch(DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `Hit count for ${key}: ${updatedCount}`,
        }),
      });

      // Create SVG
      const svg = makeSVG(updatedCount);

      context.response.headers.set("Content-Type", "image/svg+xml");
      context.response.body = svg;
    } else {
      // If the counter does not exist, create a new one
      const newCount = 1;
      await collection.insertOne({ key, count: newCount });

      // Send message to Discord via webhook
      await fetch(DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `Hit count for ${key}: ${newCount}`,
        }),
      });

      // Create SVG
      const svg = makeSvg(newCount);

      context.response.headers.set("Content-Type", "image/svg+xml");
      context.response.body = svg;
    }
  } catch (error) {
    console.error("Error occurred:", error);
    context.response.status = 500;
    context.response.body = "Internal Server Error";
  }
});

app.use(router.routes());
app.use(router.allowedMethods());

console.log(`Server is running on port ${PORT}`);
await app.listen({ port: parseInt(PORT) });
