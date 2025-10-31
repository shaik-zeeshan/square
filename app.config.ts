import { defineConfig } from "@solidjs/start/config";
import tailwindcss from "@tailwindcss/vite";
import Icons from "unplugin-icons/vite";

export default defineConfig({
  ssr: false,
  vite: {
    plugins: [tailwindcss(), Icons({ compiler: "solid" })],
  },
  server: {
    watchOptions: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
