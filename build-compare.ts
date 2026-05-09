const result = await Bun.build({
  entrypoints: [import.meta.dir + "/compare-client.ts"],
  outdir: import.meta.dir,
  target: "browser",
  naming: "[name].[ext]",
  plugins: [
    {
      name: "napi-canvas-stub",
      setup(build) {
        build.onResolve({ filter: /^@napi-rs\/canvas$/ }, () => ({
          path: import.meta.dir + "/stubs/@napi-rs/canvas/index.js",
        }));
        build.onResolve({ filter: /^@napi-rs\/canvas\/(.+)$/ }, (args) => ({
          path: import.meta.dir + `/stubs/@napi-rs/canvas/${args.path.replace("@napi-rs/canvas/", "")}`,
        }));
      },
    },
    {
      name: "onnxruntime-node-stub",
      setup(build) {
        build.onResolve({ filter: /^onnxruntime-node$/ }, () => ({
          path: import.meta.dir + "/stubs/onnxruntime-node.js",
        }));
      },
    },
  ],
});

if (!result.success) {
  console.error("Build failed:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

console.log("Build succeeded:");
for (const output of result.outputs) {
  console.log(`  ${output.path} (${(output.size / 1024).toFixed(1)} KB)`);
}