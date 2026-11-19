/**
 * Builds docs/FixItNow.postman_collection.json from the OpenAPI spec,
 * so Swagger and Postman can never drift apart.
 *
 *   npm run docs:postman
 */
import fs from "node:fs";
import path from "node:path";
import { openApiSpec } from "../src/docs/openapi";

type Item = Record<string, any>;

const folders = new Map<string, Item[]>();

const sampleValue = (schema: any): any => {
  if (!schema) return "";
  if (schema.example !== undefined) return schema.example;
  if (schema.enum) return schema.enum[0];
  switch (schema.type) {
    case "integer":
    case "number":
      return 1;
    case "boolean":
      return true;
    case "array":
      return [];
    default:
      return "string";
  }
};

// Saves the token returned by login/register so every later request is authorized
const saveTokenScript = [
  "const json = pm.response.json();",
  "if (json && json.data && json.data.token) {",
  "  pm.collectionVariables.set('token', json.data.token);",
  "}",
];

for (const [route, methods] of Object.entries<any>(openApiSpec.paths)) {
  for (const [method, op] of Object.entries<any>(methods)) {
    const tag = op.tags?.[0] ?? "Other";
    const urlPath = route.replace(/\{(\w+)\}/g, ":$1");
    const pathVariables = (op.parameters ?? [])
      .filter((p: any) => p.in === "path")
      .map((p: any) => ({ key: p.name, value: `<${p.name}>`, description: p.description }));
    const query = (op.parameters ?? [])
      .filter((p: any) => p.in === "query")
      .map((p: any) => ({ key: p.name, value: "", description: p.description, disabled: true }));
    const headers: Item[] = [];
    if (op.requestBody) headers.push({ key: "Content-Type", value: "application/json" });
    if (route === "/payments/webhook") headers.push({ key: "Stripe-Signature", value: "<signature>" });

    const bodySchema = op.requestBody?.content?.["application/json"];
    const example =
      bodySchema?.example ??
      Object.fromEntries(Object.entries<any>(bodySchema?.schema?.properties ?? {}).map(([k, v]) => [k, sampleValue(v)]));

    const item: Item = {
      name: `${method.toUpperCase()} ${route}  -  ${op.summary}`,
      request: {
        method: method.toUpperCase(),
        header: headers,
        url: {
          raw: `{{baseUrl}}${urlPath}`,
          host: ["{{baseUrl}}"],
          path: urlPath.split("/").filter(Boolean),
          ...(query.length ? { query } : {}),
          ...(pathVariables.length ? { variable: pathVariables } : {}),
        },
        ...(op.description ? { description: op.description } : {}),
        ...(op.requestBody ? { body: { mode: "raw", raw: JSON.stringify(example, null, 2), options: { raw: { language: "json" } } } } : {}),
      },
      response: [],
    };

    // The webhook is called by Stripe, so it does not use our bearer token
    if (!op.security) item.request.auth = { type: "noauth" };

    if (route === "/auth/login" || route === "/auth/register") {
      item.event = [{ listen: "test", script: { type: "text/javascript", exec: saveTokenScript } }];
    }

    if (!folders.has(tag)) folders.set(tag, []);
    folders.get(tag)!.push(item);
  }
}

const collection = {
  info: {
    name: "FixItNow API",
    description:
      "Run **Auth > POST /auth/login** first. The token is saved to the `token` collection variable automatically and used by every other request.\n\nDemo logins (after `npm run db:seed`):\n- admin@fixitnow.com / Admin@12345\n- tania@example.com / Customer@123\n- rahim.plumber@fixitnow.com / Tech@12345",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  auth: { type: "bearer", bearer: [{ key: "token", value: "{{token}}", type: "string" }] },
  variable: [
    { key: "baseUrl", value: "http://localhost:4000/api" },
    { key: "token", value: "" },
  ],
  item: [...folders.entries()].map(([name, items]) => ({ name, item: items })),
};

const out = path.join(__dirname, "..", "docs", "FixItNow.postman_collection.json");
fs.writeFileSync(out, JSON.stringify(collection, null, 2) + "\n");
console.log(`Wrote ${out} (${[...folders.values()].flat().length} requests)`);
