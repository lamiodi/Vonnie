// vite.config.js
import { defineConfig, loadEnv } from "file:///C:/Users/nuke/Documents/Vonne%20X2x%20Management%20System/VonnieX2/vonne-x2x/frontend/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/nuke/Documents/Vonne%20X2x%20Management%20System/VonnieX2/vonne-x2x/frontend/node_modules/@vitejs/plugin-react/dist/index.mjs";
var vite_config_default = ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiUrl = env.VITE_API_URL;
  const target = apiUrl ? new URL(apiUrl).origin : void 0;
  return defineConfig({
    plugins: [react()],
    resolve: {
      alias: {
        "@": "/src"
      }
    },
    server: {
      // Remove hardcoded port; let Vite choose or use CLI/env
      proxy: target ? {
        "/api": {
          target,
          changeOrigin: true,
          secure: false
        }
      } : void 0
    },
    build: {
      outDir: "dist",
      sourcemap: true
    }
  });
};
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxudWtlXFxcXERvY3VtZW50c1xcXFxWb25uZSBYMnggTWFuYWdlbWVudCBTeXN0ZW1cXFxcVm9ubmllWDJcXFxcdm9ubmUteDJ4XFxcXGZyb250ZW5kXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxudWtlXFxcXERvY3VtZW50c1xcXFxWb25uZSBYMnggTWFuYWdlbWVudCBTeXN0ZW1cXFxcVm9ubmllWDJcXFxcdm9ubmUteDJ4XFxcXGZyb250ZW5kXFxcXHZpdGUuY29uZmlnLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9udWtlL0RvY3VtZW50cy9Wb25uZSUyMFgyeCUyME1hbmFnZW1lbnQlMjBTeXN0ZW0vVm9ubmllWDIvdm9ubmUteDJ4L2Zyb250ZW5kL3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnLCBsb2FkRW52IH0gZnJvbSAndml0ZSdcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCdcblxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cbmV4cG9ydCBkZWZhdWx0ICh7IG1vZGUgfSkgPT4ge1xuICBjb25zdCBlbnYgPSBsb2FkRW52KG1vZGUsIHByb2Nlc3MuY3dkKCksICcnKVxuICAvLyBEZXJpdmUgb3JpZ2luIGZyb20gVklURV9BUElfVVJMIChlLmcuLCBodHRwOi8vbG9jYWxob3N0OjUwMDIvYXBpIC0+IGh0dHA6Ly9sb2NhbGhvc3Q6NTAwMilcbiAgY29uc3QgYXBpVXJsID0gZW52LlZJVEVfQVBJX1VSTFxuICBjb25zdCB0YXJnZXQgPSBhcGlVcmwgPyBuZXcgVVJMKGFwaVVybCkub3JpZ2luIDogdW5kZWZpbmVkXG5cbiAgcmV0dXJuIGRlZmluZUNvbmZpZyh7XG4gICAgcGx1Z2luczogW3JlYWN0KCldLFxuICAgIHJlc29sdmU6IHtcbiAgICAgIGFsaWFzOiB7XG4gICAgICAgICdAJzogJy9zcmMnXG4gICAgICB9XG4gICAgfSxcbiAgICBzZXJ2ZXI6IHtcbiAgICAgIC8vIFJlbW92ZSBoYXJkY29kZWQgcG9ydDsgbGV0IFZpdGUgY2hvb3NlIG9yIHVzZSBDTEkvZW52XG4gICAgICBwcm94eTogdGFyZ2V0XG4gICAgICAgID8ge1xuICAgICAgICAgICAgJy9hcGknOiB7XG4gICAgICAgICAgICAgIHRhcmdldCxcbiAgICAgICAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICAgICAgICBzZWN1cmU6IGZhbHNlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9XG4gICAgICAgIDogdW5kZWZpbmVkLFxuICAgIH0sXG4gICAgYnVpbGQ6IHtcbiAgICAgIG91dERpcjogJ2Rpc3QnLFxuICAgICAgc291cmNlbWFwOiB0cnVlLFxuICAgIH0sXG4gIH0pXG59XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXFiLFNBQVMsY0FBYyxlQUFlO0FBQzNkLE9BQU8sV0FBVztBQUdsQixJQUFPLHNCQUFRLENBQUMsRUFBRSxLQUFLLE1BQU07QUFDM0IsUUFBTSxNQUFNLFFBQVEsTUFBTSxRQUFRLElBQUksR0FBRyxFQUFFO0FBRTNDLFFBQU0sU0FBUyxJQUFJO0FBQ25CLFFBQU0sU0FBUyxTQUFTLElBQUksSUFBSSxNQUFNLEVBQUUsU0FBUztBQUVqRCxTQUFPLGFBQWE7QUFBQSxJQUNsQixTQUFTLENBQUMsTUFBTSxDQUFDO0FBQUEsSUFDakIsU0FBUztBQUFBLE1BQ1AsT0FBTztBQUFBLFFBQ0wsS0FBSztBQUFBLE1BQ1A7QUFBQSxJQUNGO0FBQUEsSUFDQSxRQUFRO0FBQUE7QUFBQSxNQUVOLE9BQU8sU0FDSDtBQUFBLFFBQ0UsUUFBUTtBQUFBLFVBQ047QUFBQSxVQUNBLGNBQWM7QUFBQSxVQUNkLFFBQVE7QUFBQSxRQUNWO0FBQUEsTUFDRixJQUNBO0FBQUEsSUFDTjtBQUFBLElBQ0EsT0FBTztBQUFBLE1BQ0wsUUFBUTtBQUFBLE1BQ1IsV0FBVztBQUFBLElBQ2I7QUFBQSxFQUNGLENBQUM7QUFDSDsiLAogICJuYW1lcyI6IFtdCn0K
