import { watch } from "node:fs";
import { file, Glob, serve } from "bun";
import { buildSite } from "./build.ts";

const PORT = 3000;
// The packages are watched too: their JSDoc feeds the generated API docs
const WATCHED = [
	{ dir: ".", ignored: /^(dist|node_modules)(\/|$)/ },
	{ dir: "../packages", ignored: /(^|\/)(dist|node_modules)(\/|$)|metafile\.json$/ },
];
// Reload on a pushed event, and when the stream reconnects after a dev server restart
const RELOAD_SNIPPET = `<script>const es = new EventSource("/__reload");es.onmessage = () => location.reload();es.onerror = () => {es.onopen = () => location.reload();};</script>`;

const clients = new Set<ReadableStreamDefaultController<string>>();
let building = false;
let queued = false;

async function rebuild(): Promise<void> {
	if (building) {
		queued = true;
		return;
	}
	building = true;
	try {
		await buildSite();
		for (const client of clients) client.enqueue("data: reload\n\n");
	} catch (error) {
		console.error("Build failed:", error);
	} finally {
		building = false;
	}
	if (queued) {
		queued = false;
		await rebuild();
	}
}

// Builds copy some source files into dist, which the OS reports as changes; only
// react when a file's modification time moved
const mtimes = new Map<string, number>();
let timer: ReturnType<typeof setTimeout> | undefined;

async function watchDir(dir: string, ignored: RegExp): Promise<void> {
	for await (const path of new Glob("**/*").scan({ cwd: dir })) {
		if (!ignored.test(path)) mtimes.set(`${dir}/${path}`, file(`${dir}/${path}`).lastModified);
	}

	watch(dir, { recursive: true }, (_event, path) => {
		if (!path || ignored.test(path)) return;
		const key = `${dir}/${path}`;
		const modified = file(key).lastModified;
		if (mtimes.get(key) === modified) return;
		mtimes.set(key, modified);
		clearTimeout(timer);
		timer = setTimeout(() => void rebuild(), 50);
	});
}

await Promise.all(WATCHED.map(({ dir, ignored }) => watchDir(dir, ignored)));

await rebuild();

serve({
	port: PORT,
	async fetch(req) {
		const { pathname } = new URL(req.url);

		if (pathname === "/__reload") {
			let controller: ReadableStreamDefaultController<string>;
			const stream = new ReadableStream<string>({
				start(c) {
					controller = c;
					clients.add(c);
				},
				cancel() {
					clients.delete(controller);
				},
			});
			return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
		}

		let path = pathname.endsWith("/") ? `${pathname}index.html` : pathname;
		if (!(await file(`dist${path}`).exists()) && (await file(`dist${path}/index.html`).exists())) {
			path = `${path}/index.html`;
		}
		const asset = file(`dist${path}`);
		if (!(await asset.exists())) return new Response("Not found", { status: 404 });

		if (path.endsWith(".html")) {
			const html = (await asset.text()).replace("</body>", `${RELOAD_SNIPPET}</body>`);
			return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
		}
		return new Response(asset);
	},
});

console.log(`Dev server on http://localhost:${PORT}`);
