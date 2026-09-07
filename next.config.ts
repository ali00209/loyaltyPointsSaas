import path from "node:path";
import withStylex from "@stylexswc/nextjs-plugin/turbopack";

const rootDir = __dirname;

export default withStylex({
  rsOptions: {
    dev: process.env.NODE_ENV !== "production",
    aliases: {
      "@/*": [path.join(rootDir, "*")],
    },
    unstable_moduleResolution: {
      type: "commonJS",
    },
  },
  stylexImports: ["@stylexjs/stylex"],
})({
  crossOrigin: "anonymous",
  output: "standalone",
});