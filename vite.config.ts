import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const host = process.env.TAURI_DEV_HOST;
const port = parseInt(process.env.VITE_PORT || '1421', 10);

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
	],

	clearScreen: false,
	server: {
		port,
		strictPort: true,
		host: host || false,
		hmr: host
			? {
				protocol: 'ws',
				host,
				port: port + 1,
			}
			: undefined,
		watch: {
			ignored: ['**/src-tauri/**'],
		},
	},
});
