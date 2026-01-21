// Particle grid system - each particle has filterable properties

export type Shape = "circle" | "triangle" | "square";
export type Color = "red" | "blue" | "green" | "orange" | "purple";

export interface Particle {
	x: number;
	y: number;
	shape: Shape;
	color: Color;
	size: number; // 1-5
	active: boolean;
	// Animation state
	currentAlpha: number;
	targetAlpha: number;
}

const SHAPES: readonly Shape[] = ["circle", "triangle", "square"];
const COLORS: readonly Color[] = ["red", "blue", "green", "orange", "purple"];

// Get particle colors from CSS variables
function getColorValues(): Record<Color, string> {
	const style = getComputedStyle(document.documentElement);
	return {
		red: style.getPropertyValue("--particle-red").trim(),
		blue: style.getPropertyValue("--particle-blue").trim(),
		green: style.getPropertyValue("--particle-green").trim(),
		orange: style.getPropertyValue("--particle-orange").trim(),
		purple: style.getPropertyValue("--particle-purple").trim(),
	};
}

const INACTIVE_ALPHA = 0.08;
const ACTIVE_ALPHA = 0.7;
const LERP_SPEED = 0.08;
const FADE_IN_DURATION = 2000;
const ALPHA_THRESHOLD = 0.001; // Consider animation done when diff is below this

export class ParticleGrid {
	private canvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;
	private particles: Particle[] = [];
	private animationId: number | null = null;
	private gridSpacing = 40;
	private lastTime = 0;
	private startTime = 0;
	private fadeInProgress = 0; // 0 to 1
	private colorValues: Record<Color, string>;
	private isAnimating = false;
	private resizeTimeout: ReturnType<typeof setTimeout> | null = null;
	private currentFilter: ((item: Record<string, unknown>) => boolean) | null = null;
	private lastWidth = 0;
	private lastHeight = 0;

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("Could not get 2d context");
		this.ctx = ctx;
		this.colorValues = getColorValues();

		window.addEventListener("resize", this.handleResize);
		window
			.matchMedia("(prefers-color-scheme: dark)")
			.addEventListener("change", this.handleColorSchemeChange);
		document.addEventListener("visibilitychange", this.handleVisibilityChange);
		this.applyResize();
	}

	private handleVisibilityChange = (): void => {
		if (document.hidden) {
			this.stopAnimation();
		} else {
			// Always render immediately when becoming visible
			this.render();
			if (this.needsAnimation()) {
				this.startAnimation();
			}
		}
	};

	private handleColorSchemeChange = (): void => {
		this.colorValues = getColorValues();
		this.render();
	};

	private handleResize = (): void => {
		if (this.resizeTimeout) {
			clearTimeout(this.resizeTimeout);
		}
		this.resizeTimeout = setTimeout(() => {
			this.resizeTimeout = null;
			this.applyResize();
		}, 150);
	};

	private applyResize(): void {
		const dpr = window.devicePixelRatio || 1;
		const width = window.innerWidth;
		// Use CSS lvh equivalent: window.screen.height gives stable height on mobile
		// that doesn't change with address bar. Fall back to innerHeight on desktop.
		const isMobile = "ontouchstart" in window || navigator.maxTouchPoints > 0;
		const height = isMobile ? window.screen.height : window.innerHeight;

		// Only regenerate if width changed (rotation, actual resize)
		const widthChanged = Math.abs(width - this.lastWidth) > 10;

		if (!widthChanged && this.particles.length > 0) {
			return;
		}

		this.lastWidth = width;
		this.lastHeight = height;

		this.canvas.width = width * dpr;
		this.canvas.height = height * dpr;
		this.ctx.scale(dpr, dpr);

		this.generateParticles();
		this.applyFilter(this.currentFilter);
		this.startAnimation();
	}

	private generateParticles(): void {
		this.particles = [];

		// Calculate particle count based on area, aiming for ~40px average spacing
		const area = this.lastWidth * this.lastHeight;
		const targetCount = Math.floor(area / (this.gridSpacing * this.gridSpacing));

		// Random distribution - different each visit
		const random = (): number => Math.random();

		// Minimum distance between particle centers
		const minDistance = 20;
		const minDistSq = minDistance * minDistance;
		const maxAttempts = 50;

		for (let i = 0; i < targetCount; i++) {
			let x: number;
			let y: number;
			let attempts = 0;
			let valid = false;

			// Try to find a non-overlapping position
			while (attempts < maxAttempts && !valid) {
				x = random() * this.lastWidth;
				y = random() * this.lastHeight;
				valid = true;

				// Check distance to existing particles
				for (const p of this.particles) {
					const dx = p.x - x;
					const dy = p.y - y;
					if (dx * dx + dy * dy < minDistSq) {
						valid = false;
						break;
					}
				}
				attempts++;
			}

			// Only add if we found a valid position
			if (valid) {
				const shape = SHAPES[Math.floor(random() * SHAPES.length)];
				const color = COLORS[Math.floor(random() * COLORS.length)];
				const size = Math.floor(random() * 5) + 1;

				this.particles.push({
					x: x!,
					y: y!,
					shape,
					color,
					size,
					active: false,
					currentAlpha: INACTIVE_ALPHA,
					targetAlpha: INACTIVE_ALPHA,
				});
			}
		}
	}

	public applyFilter(filterFn: ((item: Record<string, unknown>) => boolean) | null): {
		total: number;
		matched: number;
	} {
		this.currentFilter = filterFn;
		let matched = 0;
		for (const particle of this.particles) {
			if (filterFn) {
				try {
					particle.active = filterFn({
						shape: particle.shape,
						color: particle.color,
						size: particle.size,
					});
				} catch {
					particle.active = false;
				}
			} else {
				particle.active = false;
			}
			if (particle.active) matched++;
			particle.targetAlpha = particle.active ? ACTIVE_ALPHA : INACTIVE_ALPHA;
		}
		// Start animating when filter changes
		this.startAnimation();
		return { total: this.particles.length, matched };
	}

	private needsAnimation(): boolean {
		// Need animation during fade-in
		if (this.fadeInProgress < 1) return true;

		// Need animation if any particle hasn't reached target
		for (const p of this.particles) {
			if (Math.abs(p.targetAlpha - p.currentAlpha) > ALPHA_THRESHOLD) {
				return true;
			}
		}

		return false;
	}

	private startAnimation(): void {
		if (this.isAnimating || document.hidden) return;
		this.isAnimating = true;
		this.lastTime = performance.now();
		if (this.startTime === 0) {
			this.startTime = this.lastTime;
		}
		this.animate();
	}

	private stopAnimation(): void {
		if (this.animationId) {
			cancelAnimationFrame(this.animationId);
			this.animationId = null;
		}
		this.isAnimating = false;
	}

	private animate = (): void => {
		if (!this.isAnimating) return;

		const now = performance.now();
		const dt = Math.min((now - this.lastTime) / 16.67, 2); // Normalize to ~60fps, cap at 2x
		this.lastTime = now;

		this.update(dt);
		this.render();

		// Only continue if animation is needed
		if (this.needsAnimation()) {
			this.animationId = requestAnimationFrame(this.animate);
		} else {
			this.isAnimating = false;
			this.animationId = null;
		}
	};

	private update(dt: number): void {
		const now = performance.now();

		// Update fade-in progress
		if (this.fadeInProgress < 1) {
			this.fadeInProgress = Math.min(1, (now - this.startTime) / FADE_IN_DURATION);
		}

		for (const particle of this.particles) {
			// Lerp alpha toward target
			const diff = particle.targetAlpha - particle.currentAlpha;
			if (Math.abs(diff) > ALPHA_THRESHOLD) {
				particle.currentAlpha += diff * LERP_SPEED * dt;
			} else {
				particle.currentAlpha = particle.targetAlpha;
			}
		}
	}

	private render(): void {
		this.ctx.clearRect(0, 0, this.lastWidth, this.lastHeight);

		// Group particles by rendering state for batching
		const batches = new Map<string, Particle[]>();

		for (const particle of this.particles) {
			const easeOut = 1 - Math.pow(1 - this.fadeInProgress, 3);
			const alpha = particle.currentAlpha * easeOut;
			const roundedAlpha = Math.round(alpha * 100) / 100; // Round to 2 decimals
			const key = `${particle.color}_${roundedAlpha}_${particle.shape}`;

			if (!batches.has(key)) {
				batches.set(key, []);
			}
			batches.get(key)!.push(particle);
		}

		// Render each batch
		for (const [key, particles] of batches) {
			const [color, alphaStr, shape] = key.split("_");
			const alpha = Number.parseFloat(alphaStr);

			this.ctx.save();
			this.ctx.globalAlpha = alpha;
			this.ctx.fillStyle = this.colorValues[color as Color];

			for (const p of particles) {
				const size = 2 + p.size * 1.5;

				this.ctx.save();
				this.ctx.translate(p.x, p.y);

				switch (shape as Shape) {
					case "circle":
						this.ctx.beginPath();
						this.ctx.arc(0, 0, size, 0, Math.PI * 2);
						this.ctx.fill();
						break;

					case "square":
						this.ctx.fillRect(-size, -size, size * 2, size * 2);
						break;

					case "triangle":
						this.ctx.beginPath();
						this.ctx.moveTo(0, -size);
						this.ctx.lineTo(size, size);
						this.ctx.lineTo(-size, size);
						this.ctx.closePath();
						this.ctx.fill();
						break;
				}

				this.ctx.restore();
			}

			this.ctx.restore();
		}
	}

	public destroy(): void {
		this.stopAnimation();
		window.removeEventListener("resize", this.handleResize);
		window
			.matchMedia("(prefers-color-scheme: dark)")
			.removeEventListener("change", this.handleColorSchemeChange);
		document.removeEventListener("visibilitychange", this.handleVisibilityChange);
	}
}
