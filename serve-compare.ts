Bun.serve({
  routes: {
    "/": () => new Response(Bun.file(import.meta.dir + "/index.html"), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }),
    "/receipt.jpg": () => new Response(Bun.file(import.meta.dir + "/receipt.jpg"), {
      headers: { "Content-Type": "image/jpeg" },
    }),
  },
  development: {
    hmr: true,
    console: true,
  },
});

console.log("Comparison server running at http://localhost:3000");