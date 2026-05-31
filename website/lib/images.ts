// Generates the social card and app icons at build time. The site has no
// designed bitmap assets and the build environment has no rasteriser, so the
// images are drawn here from the same particle motif used on the page and
// encoded as PNG directly.

import { deflateSync } from "node:zlib";
import { write } from "bun";

type RGB = [number, number, number];
type Kind = "circle" | "triangle" | "square";

// Dark-mode particle palette, matching styles.css.
const PALETTE: RGB[] = [
	[224, 112, 96], // red
	[90, 156, 172], // blue
	[108, 160, 110], // green
	[224, 160, 96], // orange
	[156, 124, 170], // purple
];
const BG: RGB = [26, 26, 26]; // #1a1a1a
const KINDS: Kind[] = ["circle", "triangle", "square"];

const crcTable = (() => {
	const table = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) {
			c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		}
		table[n] = c >>> 0;
	}
	return table;
})();

function crc32(buf: Buffer): number {
	let c = 0xffffffff;
	for (let i = 0; i < buf.length; i++) {
		c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
	}
	return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
	const out = Buffer.alloc(12 + data.length);
	out.writeUInt32BE(data.length, 0);
	out.write(type, 4, "ascii");
	data.copy(out, 8);
	out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
	return out;
}

function encodePng(width: number, height: number, rgba: Uint8ClampedArray): Buffer {
	const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 6; // color type: RGBA
	// remaining bytes (compression, filter, interlace) stay 0

	const stride = width * 4;
	const raw = Buffer.alloc((stride + 1) * height);
	const src = Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength);
	for (let y = 0; y < height; y++) {
		raw[y * (stride + 1)] = 0; // filter type: none
		src.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
	}

	return Buffer.concat([
		signature,
		chunk("IHDR", ihdr),
		chunk("IDAT", deflateSync(raw, { level: 9 })),
		chunk("IEND", Buffer.alloc(0)),
	]);
}

function createCanvas(width: number, height: number): Uint8ClampedArray {
	const rgba = new Uint8ClampedArray(width * height * 4);
	for (let i = 0; i < rgba.length; i += 4) {
		rgba[i] = BG[0];
		rgba[i + 1] = BG[1];
		rgba[i + 2] = BG[2];
		rgba[i + 3] = 255;
	}
	return rgba;
}

function edgeSign(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
	return (px - x1) * (y2 - y1) - (py - y1) * (x2 - x1);
}

function inside(kind: Kind, px: number, py: number, cx: number, cy: number, r: number): boolean {
	switch (kind) {
		case "circle": {
			const dx = px - cx;
			const dy = py - cy;
			return dx * dx + dy * dy <= r * r;
		}
		case "square":
			return Math.abs(px - cx) <= r && Math.abs(py - cy) <= r;
		case "triangle": {
			const d1 = edgeSign(px, py, cx, cy - r, cx - r * 0.866, cy + r * 0.5);
			const d2 = edgeSign(px, py, cx - r * 0.866, cy + r * 0.5, cx + r * 0.866, cy + r * 0.5);
			const d3 = edgeSign(px, py, cx + r * 0.866, cy + r * 0.5, cx, cy - r);
			const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
			const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
			return !(hasNeg && hasPos);
		}
	}
}

function paint(
	rgba: Uint8ClampedArray,
	width: number,
	height: number,
	cx: number,
	cy: number,
	r: number,
	kind: Kind,
	col: RGB,
	alpha: number,
): void {
	const ss = 4; // supersampling factor for anti-aliasing
	const minX = Math.max(0, Math.floor(cx - r - 1));
	const maxX = Math.min(width - 1, Math.ceil(cx + r + 1));
	const minY = Math.max(0, Math.floor(cy - r - 1));
	const maxY = Math.min(height - 1, Math.ceil(cy + r + 1));

	for (let y = minY; y <= maxY; y++) {
		for (let x = minX; x <= maxX; x++) {
			let covered = 0;
			for (let sy = 0; sy < ss; sy++) {
				for (let sx = 0; sx < ss; sx++) {
					if (inside(kind, x + (sx + 0.5) / ss, y + (sy + 0.5) / ss, cx, cy, r)) covered++;
				}
			}
			if (covered === 0) continue;
			const a = (covered / (ss * ss)) * alpha;
			const idx = (y * width + x) * 4;
			rgba[idx] = col[0] * a + rgba[idx] * (1 - a);
			rgba[idx + 1] = col[1] * a + rgba[idx + 1] * (1 - a);
			rgba[idx + 2] = col[2] * a + rgba[idx + 2] * (1 - a);
		}
	}
}

function mulberry32(seed: number): () => number {
	let a = seed;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function renderSocialCard(width: number, height: number): Uint8ClampedArray {
	const rgba = createCanvas(width, height);
	const rng = mulberry32(20260531);
	const spacing = 68;

	for (let gy = spacing / 2; gy < height; gy += spacing) {
		for (let gx = spacing / 2; gx < width; gx += spacing) {
			const jx = gx + (rng() - 0.5) * spacing * 0.6;
			const jy = gy + (rng() - 0.5) * spacing * 0.6;
			const kind = KINDS[Math.floor(rng() * KINDS.length)];
			const col = PALETTE[Math.floor(rng() * PALETTE.length)];
			const r = 8 + rng() * 14;
			const bright = rng() < 0.22;
			const alpha = bright ? 0.7 + rng() * 0.15 : 0.1 + rng() * 0.08;
			paint(rgba, width, height, jx, jy, r, kind, col, alpha);
		}
	}

	return rgba;
}

function renderIcon(size: number): Uint8ClampedArray {
	const rgba = createCanvas(size, size);
	const s = size / 32;
	paint(rgba, size, size, 10 * s, 10 * s, 4.5 * s, "circle", [156, 124, 170], 1);
	paint(rgba, size, size, 22 * s, 11 * s, 6 * s, "triangle", [108, 160, 110], 1);
	paint(rgba, size, size, 10 * s, 22 * s, 4.5 * s, "square", [90, 156, 172], 1);
	paint(rgba, size, size, 22 * s, 22 * s, 4.5 * s, "circle", [224, 112, 96], 1);
	return rgba;
}

export async function generateImages(): Promise<void> {
	await Promise.all([
		write("dist/og-image.png", encodePng(1200, 630, renderSocialCard(1200, 630))),
		write("dist/apple-touch-icon.png", encodePng(180, 180, renderIcon(180))),
		write("dist/favicon.png", encodePng(48, 48, renderIcon(48))),
	]);
}
