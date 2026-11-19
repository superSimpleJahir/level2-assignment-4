import { Router } from "express";
import { openApiSpec } from "./openapi";

const router = Router();

// Swagger UI assets come from a CDN. The swagger-ui-express package serves them from
// node_modules, which Vercel does not include in the serverless bundle (blank page).
const SWAGGER_UI_VERSION = "5.35.1";
const CDN = `https://cdn.jsdelivr.net/npm/swagger-ui-dist@${SWAGGER_UI_VERSION}`;

// Helmet's default policy would block the CDN, so docs pages set their own
const docsCsp = [
  "default-src 'self'",
  `script-src 'self' https://cdn.jsdelivr.net`,
  `style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net`,
  "img-src 'self' data: https:",
  "connect-src 'self'",
].join("; ");

// Raw spec - handy for importing into Postman or Insomnia
router.get("/docs.json", (_req, res) => {
  res.json(openApiSpec);
});

router.get("/docs/init.js", (_req, res) => {
  res.setHeader("Content-Security-Policy", docsCsp);
  res.type("application/javascript").send(`
window.onload = function () {
  window.ui = SwaggerUIBundle({
    url: "/api/docs.json",
    dom_id: "#swagger-ui",
    persistAuthorization: true,
    deepLinking: true,
    presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
    layout: "StandaloneLayout",
  });
};`);
});

router.get(["/docs", "/docs/"], (_req, res) => {
  res.setHeader("Content-Security-Policy", docsCsp);
  res.type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>FixItNow API Docs</title>
    <link rel="stylesheet" href="${CDN}/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="${CDN}/swagger-ui-bundle.js"></script>
    <script src="${CDN}/swagger-ui-standalone-preset.js"></script>
    <script src="/api/docs/init.js"></script>
  </body>
</html>`);
});

export default router;
