import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createServer as createViteServer } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function createServer() {
  const isProd = process.env.NODE_ENV === "production";
  const resolve = (p) => path.resolve(__dirname, p);

  const app = express();

  /**
   * @type {import('vite').ViteDevServer}
   */
  let vite;

  if (!isProd) {
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "custom",
    });

    app.use(vite.middlewares);
  } else {
    app.use((await import("compression")).default());
    app.use(
      (await import("serve-static")).default(resolve("dist/client"), {
        index: false, // disables sending "index.html" files by default.
      })
    );
  }

  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    let template, render;
    try {
      if (!isProd) {
        template = fs.readFileSync(resolve("index.html"), "utf-8");
        template = await vite.transformIndexHtml(url, template);

        render = (await vite.ssrLoadModule("/src/entry-server.tsx")).render;
      } else {
        template = fs.readFileSync(resolve("dist/client/index.html"), "utf-8");
        // @ts-ignore
        render = (await import("./dist/server/entry-server.js")).render;
      }

      const appHtml = await render(url);

      const html = template.replace(`<!--ssr-outlet-->`, appHtml);

      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });

  app.listen(5173);
}

createServer();
