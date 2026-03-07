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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxudWtlXFxcXERvY3VtZW50c1xcXFxWb25uZSBYMnggTWFuYWdlbWVudCBTeXN0ZW1cXFxcVm9ubmllWDJcXFxcdm9ubmUteDJ4XFxcXGZyb250ZW5kXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxudWtlXFxcXERvY3VtZW50c1xcXFxWb25uZSBYMnggTWFuYWdlbWVudCBTeXN0ZW1cXFxcVm9ubmllWDJcXFxcdm9ubmUteDJ4XFxcXGZyb250ZW5kXFxcXHZpdGUuY29uZmlnLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9udWtlL0RvY3VtZW50cy9Wb25uZSUyMFgyeCUyME1hbmFnZW1lbnQlMjBTeXN0ZW0vVm9ubmllWDIvdm9ubmUteDJ4L2Zyb250ZW5kL3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnLCBsb2FkRW52IH0gZnJvbSAndml0ZSdcclxuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xyXG5cclxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cclxuZXhwb3J0IGRlZmF1bHQgKHsgbW9kZSB9KSA9PiB7XHJcbiAgY29uc3QgZW52ID0gbG9hZEVudihtb2RlLCBwcm9jZXNzLmN3ZCgpLCAnJylcclxuICAvLyBEZXJpdmUgb3JpZ2luIGZyb20gVklURV9BUElfVVJMIChlLmcuLCBodHRwOi8vbG9jYWxob3N0OjUwMDIvYXBpIC0+IGh0dHA6Ly9sb2NhbGhvc3Q6NTAwMilcclxuICBjb25zdCBhcGlVcmwgPSBlbnYuVklURV9BUElfVVJMXHJcbiAgY29uc3QgdGFyZ2V0ID0gYXBpVXJsID8gbmV3IFVSTChhcGlVcmwpLm9yaWdpbiA6IHVuZGVmaW5lZFxyXG5cclxuICByZXR1cm4gZGVmaW5lQ29uZmlnKHtcclxuICAgIHBsdWdpbnM6IFtyZWFjdCgpXSxcclxuICAgIHJlc29sdmU6IHtcclxuICAgICAgYWxpYXM6IHtcclxuICAgICAgICAnQCc6ICcvc3JjJ1xyXG4gICAgICB9XHJcbiAgICB9LFxyXG4gICAgc2VydmVyOiB7XHJcbiAgICAgIC8vIFJlbW92ZSBoYXJkY29kZWQgcG9ydDsgbGV0IFZpdGUgY2hvb3NlIG9yIHVzZSBDTEkvZW52XHJcbiAgICAgIHByb3h5OiB0YXJnZXRcclxuICAgICAgICA/IHtcclxuICAgICAgICAgICAgJy9hcGknOiB7XHJcbiAgICAgICAgICAgICAgdGFyZ2V0LFxyXG4gICAgICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcclxuICAgICAgICAgICAgICBzZWN1cmU6IGZhbHNlLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgfVxyXG4gICAgICAgIDogdW5kZWZpbmVkLFxyXG4gICAgfSxcclxuICAgIGJ1aWxkOiB7XHJcbiAgICAgIG91dERpcjogJ2Rpc3QnLFxyXG4gICAgICBzb3VyY2VtYXA6IHRydWUsXHJcbiAgICB9LFxyXG4gIH0pXHJcbn1cclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFxYixTQUFTLGNBQWMsZUFBZTtBQUMzZCxPQUFPLFdBQVc7QUFHbEIsSUFBTyxzQkFBUSxDQUFDLEVBQUUsS0FBSyxNQUFNO0FBQzNCLFFBQU0sTUFBTSxRQUFRLE1BQU0sUUFBUSxJQUFJLEdBQUcsRUFBRTtBQUUzQyxRQUFNLFNBQVMsSUFBSTtBQUNuQixRQUFNLFNBQVMsU0FBUyxJQUFJLElBQUksTUFBTSxFQUFFLFNBQVM7QUFFakQsU0FBTyxhQUFhO0FBQUEsSUFDbEIsU0FBUyxDQUFDLE1BQU0sQ0FBQztBQUFBLElBQ2pCLFNBQVM7QUFBQSxNQUNQLE9BQU87QUFBQSxRQUNMLEtBQUs7QUFBQSxNQUNQO0FBQUEsSUFDRjtBQUFBLElBQ0EsUUFBUTtBQUFBO0FBQUEsTUFFTixPQUFPLFNBQ0g7QUFBQSxRQUNFLFFBQVE7QUFBQSxVQUNOO0FBQUEsVUFDQSxjQUFjO0FBQUEsVUFDZCxRQUFRO0FBQUEsUUFDVjtBQUFBLE1BQ0YsSUFDQTtBQUFBLElBQ047QUFBQSxJQUNBLE9BQU87QUFBQSxNQUNMLFFBQVE7QUFBQSxNQUNSLFdBQVc7QUFBQSxJQUNiO0FBQUEsRUFDRixDQUFDO0FBQ0g7IiwKICAibmFtZXMiOiBbXQp9Cg==
