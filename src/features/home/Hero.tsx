"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { routeFor, type Locale } from "@/lib/routes";
import { events, getBaseContext } from "@/lib/analytics";
import { HoldNavLink } from "@/components/navigation/HoldNavLink";

const COPY = {
	en: {
		eyebrow: "CODE · GROWTH · KNOWLEDGE",
		lines: ["We build.", "We grow.", "We teach."],
		lede: "Digital solutions built around real goals, not templates. Engineered with precision. Delivered with purpose.",
		primaryCta: "Start a project",
		secondaryCta: "Explore our services",
		trustLabel: "Built on real experience.",
		rating: "5.0 rating",
		products: "Built in-house",
		engineering: "Quality focused",
		privacy: "By design",
		build: {
			title: "BUILD",
			desc: "Websites, apps & digital products",
		},
		grow: {
			title: "GROW",
			desc: "SEO, content & online visibility",
		},
		teach: {
			title: "TEACH",
			desc: "1:1 mentoring & practical guidance",
		},
	},
	pl: {
		eyebrow: "CODE · GROWTH · KNOWLEDGE",
		lines: ["Budujemy.", "Rozwijamy.", "Uczymy."],
		lede: "Rozwiązania cyfrowe dopasowane do realnych potrzeb. Precyzyjnie zaprojektowane. Tworzone z konkretnym celem.",
		primaryCta: "Rozpocznij projekt",
		secondaryCta: "Zobacz nasze usługi",
		trustLabel: "Oparte na realnym doświadczeniu.",
		rating: "ocena 5.0",
		products: "Tworzone przez CCS",
		engineering: "Dbałość o jakość",
		privacy: "Od podstaw",
		build: {
			title: "BUDUJEMY",
			desc: "Strony, aplikacje i produkty cyfrowe",
		},
		grow: {
			title: "ROZWIJAMY",
			desc: "SEO, treści i widoczność online",
		},
		teach: {
			title: "UCZYMY",
			desc: "Mentoring 1:1 i praktyczne wsparcie",
		},
	},
};

export function Hero({ locale }: { locale: Locale }) {
	const t = COPY[locale];
	const fieldRef = useRef<SVGSVGElement>(null);
	const connectorsRef = useRef<SVGSVGElement>(null);
	const glowRef = useRef<HTMLDivElement>(null);
	const heroRef = useRef<HTMLElement>(null);
	const pathname = usePathname();

	// Ports the animated Signal Field (electricity travelling toward the
	// headline) and the logo mark → BUILD/GROW/TEACH circuit connectors.
	useEffect(() => {
		const reduceMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		const coarsePointer = window.matchMedia(
			"(hover:none), (pointer:coarse)",
		).matches;
		const svgns = "http://www.w3.org/2000/svg";
		const cleanups: Array<() => void> = [];

		let gridGroup: SVGGElement | null = null;

		const field = fieldRef.current;
		if (field) {
			const W = 1400;
			const H = 700;
			const defs = document.createElementNS(svgns, "defs");
			defs.innerHTML =
				'<radialGradient id="fieldGlow" cx="78%" cy="46%" r="55%">' +
				'<stop offset="0%" stop-color="#3b82f6" stop-opacity=".22"/>' +
				'<stop offset="100%" stop-color="#3b82f6" stop-opacity="0"/>' +
				"</radialGradient>" +
				'<filter id="dotGlow" x="-200%" y="-200%" width="500%" height="500%">' +
				'<feGaussianBlur stdDeviation="2.4"/></filter>';
			field.appendChild(defs);

			const glowRect = document.createElementNS(svgns, "rect");
			glowRect.setAttribute("width", String(W));
			glowRect.setAttribute("height", String(H));
			glowRect.setAttribute("fill", "url(#fieldGlow)");
			field.appendChild(glowRect);

			gridGroup = document.createElementNS(svgns, "g");
			gridGroup.setAttribute("class", "hero-grid");
			gridGroup.setAttribute("stroke", "rgba(120,150,220,0.10)");
			gridGroup.setAttribute("stroke-width", "1");
			gridGroup.setAttribute("fill", "none");
			for (let x = 140; x < W; x += 80) {
				const l = document.createElementNS(svgns, "line");
				l.setAttribute("x1", String(x));
				l.setAttribute("y1", "0");
				l.setAttribute("x2", String(x));
				l.setAttribute("y2", String(H));
				gridGroup.appendChild(l);
			}
			for (let y = 60; y < H; y += 70) {
				const l2 = document.createElementNS(svgns, "line");
				l2.setAttribute("x1", "0");
				l2.setAttribute("y1", String(y));
				l2.setAttribute("x2", String(W));
				l2.setAttribute("y2", String(y));
				gridGroup.appendChild(l2);
			}
			field.appendChild(gridGroup);

			const paths = [
				"M1180 300 C 950 260, 760 340, 560 250 C 420 190, 300 230, 60 150",
				"M1180 340 C 1000 380, 820 320, 620 380 C 460 430, 320 400, 40 430",
				"M1180 250 C 980 180, 880 250, 700 190 C 520 130, 380 170, 100 90",
				"M1180 400 C 1020 440, 900 410, 700 460 C 500 510, 340 470, 90 520",
			];
			const frames: number[] = [];
			paths.forEach((d, idx) => {
				const p = document.createElementNS(svgns, "path");
				p.setAttribute("d", d);
				p.setAttribute("fill", "none");
				p.setAttribute("stroke", "rgba(127,217,255,0.16)");
				p.setAttribute("stroke-width", "1.4");
				field.appendChild(p);

				if (!reduceMotion) {
					const dot = document.createElementNS(svgns, "circle");
					dot.setAttribute("r", idx % 2 === 0 ? "3.4" : "2.6");
					dot.setAttribute("fill", "#a7e8ff");
					dot.setAttribute("filter", "url(#dotGlow)");
					field.appendChild(dot);

					const duration = 5200 + idx * 900;
					const delay = idx * 700;
					const len = p.getTotalLength();
					let start: number | null = null;
					const frame = (ts: number) => {
						if (start === null) start = ts + delay;
						const t2 = ts - start;
						if (t2 < 0) {
							frames.push(requestAnimationFrame(frame));
							return;
						}
						const progress = (t2 % duration) / duration;
						const pt = p.getPointAtLength(progress * len);
						dot.setAttribute("cx", String(pt.x));
						dot.setAttribute("cy", String(pt.y));
						dot.setAttribute(
							"opacity",
							String(Math.max(0.08, Math.sin(progress * Math.PI))),
						);
						frames.push(requestAnimationFrame(frame));
					};
					frames.push(requestAnimationFrame(frame));
				}
			});
			cleanups.push(() => frames.forEach((id) => cancelAnimationFrame(id)));
		}

		const connectors = connectorsRef.current;
		if (connectors && !reduceMotion) {
			const traces = [
				{ id: "traceBuild", duration: 2600, delay: 1500 },
				{ id: "traceGrow", duration: 1900, delay: 2100 },
				{ id: "traceTeach", duration: 2600, delay: 2700 },
			];
			const frames: number[] = [];
			traces.forEach((cfg) => {
				const path = connectors.querySelector<SVGPathElement>(`#${cfg.id}`);
				if (!path) return;
				const dot = document.createElementNS(svgns, "circle");
				dot.setAttribute("r", "3");
				dot.setAttribute("fill", "#eaf7ff");
				dot.setAttribute("opacity", "0");
				connectors.appendChild(dot);
				const len = path.getTotalLength();
				let start: number | null = null;
				const frame = (ts: number) => {
					if (start === null) start = ts + cfg.delay;
					const t2 = ts - start;
					if (t2 < 0) {
						frames.push(requestAnimationFrame(frame));
						return;
					}
					const progress = (t2 % cfg.duration) / cfg.duration;
					const pt = path.getPointAtLength(progress * len);
					dot.setAttribute("cx", String(pt.x));
					dot.setAttribute("cy", String(pt.y));
					dot.setAttribute("opacity", String(Math.sin(progress * Math.PI)));
					frames.push(requestAnimationFrame(frame));
				};
				frames.push(requestAnimationFrame(frame));
			});
			cleanups.push(() => frames.forEach((id) => cancelAnimationFrame(id)));
		}

		// cursor-reactive hero glow (desktop only)
		const heroEl = heroRef.current;
		const glow = glowRef.current;
		if (heroEl && glow && !coarsePointer && !reduceMotion) {
			const onMove = (e: MouseEvent) => {
				const r = heroEl.getBoundingClientRect();
				glow.style.transform = `translate(${e.clientX - r.left - 260}px,${e.clientY - r.top - 260}px)`;
				glow.style.opacity = "1";
				if (gridGroup) {
					const nx = (e.clientX - r.left) / r.width - 0.5;
					const ny = (e.clientY - r.top) / r.height - 0.5;
					gridGroup.setAttribute(
						"transform",
						`translate(${(nx * 26).toFixed(2)},${(ny * 16).toFixed(2)})`,
					);
				}
			};
			const onLeave = () => {
				glow.style.opacity = "0";
				if (gridGroup) {
					gridGroup.setAttribute("transform", "translate(0,0)");
				}
			};
			heroEl.addEventListener("mousemove", onMove);
			heroEl.addEventListener("mouseleave", onLeave);
			cleanups.push(() => {
				heroEl.removeEventListener("mousemove", onMove);
				heroEl.removeEventListener("mouseleave", onLeave);
			});
		}

		return () => cleanups.forEach((fn) => fn());
	}, []);

	return (
		<section className="hero" style={{ borderTop: 0 }} ref={heroRef}>
			<svg
				ref={fieldRef}
				className="hero-field"
				viewBox="0 0 1400 700"
				preserveAspectRatio="xMidYMid slice"
				aria-hidden="true"
			/>
			<div ref={glowRef} className="cursor-glow" aria-hidden="true" />

			<div className="wrap hero-inner">
				<div className="hero-copy">
					<span className="eyebrow">{t.eyebrow}</span>
					<h1>
						{t.lines.map((line) => (
							<span key={line}>{line}</span>
						))}
					</h1>
					<p className="lede">{t.lede}</p>
					<div className="hero-actions">
						<HoldNavLink
							href={routeFor("contact", locale)}
							className="btn btn-primary"
							onClick={() =>
								events.serviceCtaClick(
									"general",
									"hero",
									getBaseContext(pathname),
								)
							}
						>
							{t.primaryCta}
						</HoldNavLink>
						<HoldNavLink
							href={routeFor("services", locale)}
							className="btn btn-ghost"
							onClick={() =>
								events.serviceCtaClick(
									"services-overview",
									"hero",
									getBaseContext(pathname),
								)
							}
						>
							{t.secondaryCta}
						</HoldNavLink>
					</div>
					<div className="trust">
						<p>{t.trustLabel}</p>
						<div className="trust-row">
							<div className="trust-item">
								<span className="t1">
									Google <span className="stars">★★★★★</span>
								</span>
								<span className="t2">{t.rating}</span>
							</div>
							<div className="trust-item">
								<span className="t1">
									{locale === "en" ? "REAL PRODUCTS" : "WŁASNE PRODUKTY"}
								</span>
								<span className="t2">{t.products}</span>
							</div>
							<div className="trust-item">
								<span className="t1">
									{locale === "en" ? "ENGINEERING" : "INŻYNIERIA"}
								</span>
								<span className="t2">{t.engineering}</span>
							</div>
							<div className="trust-item">
								<span className="t1">
									{locale === "en" ? "PRIVACY" : "PRYWATNOŚĆ"}
								</span>
								<span className="t2">{t.privacy}</span>
							</div>
						</div>
					</div>
				</div>

				<div className="hero-visual">
					<div className="hero-logo">
						<Image
							src="/brand/ccs-logo-full.png"
							alt="Code Consulting Studio"
							width={1400}
							height={788}
							sizes="(max-width: 975px) 70vw, 34vw"
							priority
						/>
					</div>

					<svg
						ref={connectorsRef}
						className="mark-connectors"
						viewBox="0 0 640 420"
						preserveAspectRatio="none"
						aria-hidden="true"
					>
						<g
							className="trace-lines"
							fill="none"
							stroke="rgba(114,216,255,.4)"
							strokeWidth="1.6"
						>
							<path id="traceBuild" d="M281,210 H340 V128 H408" />
							<path id="traceGrow" d="M281,210 H408" />
							<path id="traceTeach" d="M281,210 H340 V292 H408" />
						</g>
						<g className="trace-nodes" fill="#0aa9ff">
							<circle cx="281" cy="210" r="4.5" fill="#eaf7ff">
								<animate
									attributeName="opacity"
									values="1;.5;1"
									dur="2.6s"
									repeatCount="indefinite"
								/>
							</circle>
							<circle cx="340" cy="128" r="2.6" />
							<circle cx="340" cy="292" r="2.6" />
							<circle cx="408" cy="128" r="2.6" />
							<circle cx="408" cy="210" r="2.6" />
							<circle cx="408" cy="292" r="2.6" />
						</g>
					</svg>

					<div className="mode-cards">
						<div className="mode-card">
							<span className="mode-ic">
								<svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="1.8"
								>
									<path d="M8 5 3 12l5 7M16 5l5 7-5 7" />
								</svg>
							</span>
							<span>
								<b>{t.build.title}</b>
								<span>{t.build.desc}</span>
							</span>
						</div>
						<div className="mode-card">
							<span className="mode-ic">
								<svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="1.8"
								>
									<path d="M3 17l6-6 4 4 8-8M21 7v6M15 7h6" />
								</svg>
							</span>
							<span>
								<b>{t.grow.title}</b>
								<span>{t.grow.desc}</span>
							</span>
						</div>
						<div className="mode-card">
							<span className="mode-ic">
								<svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="1.8"
								>
									<circle cx="12" cy="8" r="3.4" />
									<path d="M5 20c1.4-4 4-6 7-6s5.6 2 7 6" />
								</svg>
							</span>
							<span>
								<b>{t.teach.title}</b>
								<span>{t.teach.desc}</span>
							</span>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
