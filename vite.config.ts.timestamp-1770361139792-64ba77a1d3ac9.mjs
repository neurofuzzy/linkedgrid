// vite.config.ts
import { defineConfig } from "file:///Users/geoff/dev/linkedgrid/node_modules/vite/dist/node/index.js";
import dts from "file:///Users/geoff/dev/linkedgrid/node_modules/vite-plugin-dts/dist/index.mjs";
import tsconfigPaths from "file:///Users/geoff/dev/linkedgrid/node_modules/vite-tsconfig-paths/dist/index.js";
import { resolve } from "path";
var __vite_injected_original_dirname = "/Users/geoff/dev/linkedgrid";
var commonConfig = {
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      "@linkedgrid/grid": resolve(__vite_injected_original_dirname, "packages/grid")
    }
  }
};
var vite_config_default = defineConfig(() => {
  return {
    ...commonConfig,
    plugins: [
      tsconfigPaths(),
      dts({
        include: ["packages/**/*"],
        outDir: "dist",
        rollupTypes: true
      })
    ],
    server: {
      host: "0.0.0.0",
      // Allow access from all network interfaces (including geoff.local)
      port: 5183,
      open: "/dev/index.html"
      // Auto-open interactive playground
    },
    build: {
      lib: {
        entry: resolve(__vite_injected_original_dirname, "packages/spartan/index.ts"),
        name: "Spartan",
        fileName: "spartan",
        formats: ["es"]
      },
      sourcemap: true
    },
    test: {
      globals: true,
      environment: "node",
      include: [
        "packages/**/test/**/*.test.ts",
        "packages/**/test/**/*.visual.test.ts",
        "test-integration/**/*.test.ts"
      ],
      exclude: ["**/node_modules/**", "**/dist/**"]
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvZ2VvZmYvZGV2L2xpbmtlZGdyaWRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy9nZW9mZi9kZXYvbGlua2VkZ3JpZC92aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvZ2VvZmYvZGV2L2xpbmtlZGdyaWQvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCBkdHMgZnJvbSAndml0ZS1wbHVnaW4tZHRzJztcbmltcG9ydCB0c2NvbmZpZ1BhdGhzIGZyb20gJ3ZpdGUtdHNjb25maWctcGF0aHMnO1xuaW1wb3J0IHsgcmVzb2x2ZSB9IGZyb20gJ3BhdGgnO1xuXG4vLyBDb21tb24gY29uZmlndXJhdGlvbiBmb3IgYWxsIG1vZGVzXG5jb25zdCBjb21tb25Db25maWcgPSB7XG4gIHBsdWdpbnM6IFt0c2NvbmZpZ1BhdGhzKCldLFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgICdAbGlua2VkZ3JpZC9ncmlkJzogcmVzb2x2ZShfX2Rpcm5hbWUsICdwYWNrYWdlcy9ncmlkJyksXG4gICAgfSxcbiAgfSxcbn07XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoKSA9PiB7XG4gIC8vIExpYnJhcnkgYnVpbGQgbW9kZSAobnBtIHJ1biBidWlsZClcbiAgcmV0dXJuIHtcbiAgICAuLi5jb21tb25Db25maWcsXG4gICAgcGx1Z2luczogW1xuICAgICAgdHNjb25maWdQYXRocygpLFxuICAgICAgZHRzKHtcbiAgICAgICAgaW5jbHVkZTogWydwYWNrYWdlcy8qKi8qJ10sXG4gICAgICAgIG91dERpcjogJ2Rpc3QnLFxuICAgICAgICByb2xsdXBUeXBlczogdHJ1ZSxcbiAgICAgIH0pLFxuICAgIF0sXG4gICAgc2VydmVyOiB7XG4gICAgICBob3N0OiAnMC4wLjAuMCcsIC8vIEFsbG93IGFjY2VzcyBmcm9tIGFsbCBuZXR3b3JrIGludGVyZmFjZXMgKGluY2x1ZGluZyBnZW9mZi5sb2NhbClcbiAgICAgIHBvcnQ6IDUxODMsXG4gICAgICBvcGVuOiAnL2Rldi9pbmRleC5odG1sJywgLy8gQXV0by1vcGVuIGludGVyYWN0aXZlIHBsYXlncm91bmRcbiAgICB9LFxuICAgIGJ1aWxkOiB7XG4gICAgICBsaWI6IHtcbiAgICAgICAgZW50cnk6IHJlc29sdmUoX19kaXJuYW1lLCAncGFja2FnZXMvc3BhcnRhbi9pbmRleC50cycpLFxuICAgICAgICBuYW1lOiAnU3BhcnRhbicsXG4gICAgICAgIGZpbGVOYW1lOiAnc3BhcnRhbicsXG4gICAgICAgIGZvcm1hdHM6IFsnZXMnXSxcbiAgICAgIH0sXG4gICAgICBzb3VyY2VtYXA6IHRydWUsXG4gICAgfSxcbiAgICB0ZXN0OiB7XG4gICAgICBnbG9iYWxzOiB0cnVlLFxuICAgICAgZW52aXJvbm1lbnQ6ICdub2RlJyxcbiAgICAgIGluY2x1ZGU6IFtcbiAgICAgICAgJ3BhY2thZ2VzLyoqL3Rlc3QvKiovKi50ZXN0LnRzJyxcbiAgICAgICAgJ3BhY2thZ2VzLyoqL3Rlc3QvKiovKi52aXN1YWwudGVzdC50cycsXG4gICAgICAgICd0ZXN0LWludGVncmF0aW9uLyoqLyoudGVzdC50cycsXG4gICAgICBdLFxuICAgICAgZXhjbHVkZTogWycqKi9ub2RlX21vZHVsZXMvKionLCAnKiovZGlzdC8qKiddLFxuICAgIH0sXG4gIH07XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBbVEsU0FBUyxvQkFBb0I7QUFDaFMsT0FBTyxTQUFTO0FBQ2hCLE9BQU8sbUJBQW1CO0FBQzFCLFNBQVMsZUFBZTtBQUh4QixJQUFNLG1DQUFtQztBQU16QyxJQUFNLGVBQWU7QUFBQSxFQUNuQixTQUFTLENBQUMsY0FBYyxDQUFDO0FBQUEsRUFDekIsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsb0JBQW9CLFFBQVEsa0NBQVcsZUFBZTtBQUFBLElBQ3hEO0FBQUEsRUFDRjtBQUNGO0FBRUEsSUFBTyxzQkFBUSxhQUFhLE1BQU07QUFFaEMsU0FBTztBQUFBLElBQ0wsR0FBRztBQUFBLElBQ0gsU0FBUztBQUFBLE1BQ1AsY0FBYztBQUFBLE1BQ2QsSUFBSTtBQUFBLFFBQ0YsU0FBUyxDQUFDLGVBQWU7QUFBQSxRQUN6QixRQUFRO0FBQUEsUUFDUixhQUFhO0FBQUEsTUFDZixDQUFDO0FBQUEsSUFDSDtBQUFBLElBQ0EsUUFBUTtBQUFBLE1BQ04sTUFBTTtBQUFBO0FBQUEsTUFDTixNQUFNO0FBQUEsTUFDTixNQUFNO0FBQUE7QUFBQSxJQUNSO0FBQUEsSUFDQSxPQUFPO0FBQUEsTUFDTCxLQUFLO0FBQUEsUUFDSCxPQUFPLFFBQVEsa0NBQVcsMkJBQTJCO0FBQUEsUUFDckQsTUFBTTtBQUFBLFFBQ04sVUFBVTtBQUFBLFFBQ1YsU0FBUyxDQUFDLElBQUk7QUFBQSxNQUNoQjtBQUFBLE1BQ0EsV0FBVztBQUFBLElBQ2I7QUFBQSxJQUNBLE1BQU07QUFBQSxNQUNKLFNBQVM7QUFBQSxNQUNULGFBQWE7QUFBQSxNQUNiLFNBQVM7QUFBQSxRQUNQO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNGO0FBQUEsTUFDQSxTQUFTLENBQUMsc0JBQXNCLFlBQVk7QUFBQSxJQUM5QztBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
