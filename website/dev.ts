import { watch } from "node:fs";
import { file, Glob, serve } from "bun";
import { buildSite } from "./build.ts";

const PORT = 3000;
const IGNORED = /^(dist|node_modules)(\/|$)/;
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
for await (const path of new Glob("**/*").scan(".")) {
	if (!IGNORED.test(path)) mtimes.set(path, file(path).lastModified);
}

let timer: ReturnType<typeof setTimeout> | undefined;
watch(".", { recursive: true }, (_event, path) => {
	if (!path || IGNORED.test(path)) return;
	const modified = file(path).lastModified;
	if (mtimes.get(path) === modified) return;
	mtimes.set(path, modified);
	clearTimeout(timer);
	timer = setTimeout(() => void rebuild(), 50);
});

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

		const path = pathname === "/" ? "/index.html" : pathname;
		const asset = file(`dist${path}`);
		if (!(await asset.exists())) return new Response("Not found", { status: 404 });

		if (path === "/index.html") {
			const html = (await asset.text()).replace("</body>", `${RELOAD_SNIPPET}</body>`);
			return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
		}
		return new Response(asset);
	},
});

console.log(`Dev server on http://localhost:${PORT}`);
