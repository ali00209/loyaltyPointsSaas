import path from "node:path";

const postcssConfig = {
  plugins: {
    "@tailwindcss/postcss": {},
    "@stylexswc/postcss-plugin": {
      include: [
        "src/app/**/*.{js,jsx,ts,tsx}",
        "src/components/**/*.{js,jsx,ts,tsx}",
      ],
      rsOptions: {
        aliases: {
          "@/*": [path.join(process.cwd(), "*")],
        },
        unstable_moduleResolution: {
          type: "commonJS",
        },
        dev: process.env.NODE_ENV === "development",
      },
    },
  },
};

export default postcssConfig;