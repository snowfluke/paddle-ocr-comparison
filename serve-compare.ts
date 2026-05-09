Bun.serve({
  routes: {
    "/": () => new Response(Bun.file(import.meta.dir + "/compare.html"), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }),
    "/receipt.jpg": () => new Response(Bun.file(import.meta.dir + "/receipt.jpg"), {
      headers: { "Content-Type": "image/jpeg" },
    }),
    "/out/:file": async (req) => {
      const file = req.params.file;
      const filePath = import.meta.dir + "/out/" + file;
      const ext = file.endsWith(".js") ? "application/javascript" : "application/octet-stream";
      return new Response(Bun.file(filePath), {
        headers: { "Content-Type": ext },
      });
    },
  },
  development: {
    hmr: true,
    console: true,
  },
});

console.log("Comparison server running at http://localhost:3000");