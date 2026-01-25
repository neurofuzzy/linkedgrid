import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import tsconfigPaths from 'vite-tsconfig-paths';
import { resolve } from 'path';

// Common configuration for all modes
const commonConfig = {
    plugins: [tsconfigPaths()],
    resolve: {
        alias: {
            '@linkedgrid/grid': resolve(__dirname, 'packages/grid'),
        },
    },
};

export default defineConfig(({ command: _command, mode }) => {

    // Library build mode (npm run build)
    return {
        ...commonConfig,
        plugins: [
            tsconfigPaths(),
            dts({
                include: ['src/**/*', 'packages/**/*'],
                outDir: 'dist',
                rollupTypes: true,
            }),
        ],
        server: {
            host: '0.0.0.0', // Allow access from all network interfaces (including geoff.local)
            port: 5183,
        },
        build: {
            lib: {
                entry: resolve(__dirname, 'src/index.ts'),
                name: 'LinkedGrid',
                fileName: 'linkedgrid',
                formats: ['es'],
            },
            sourcemap: true,
        },
        test: {
            globals: true,
            environment: 'node',
            exclude: [
                '**/node_modules/**',
                '**/dist/**',
            ],
        },
    };
});
