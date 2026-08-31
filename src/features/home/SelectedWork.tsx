import Image from "next/image";
import Link from "next/link";
import type { ComponentType } from "react";
import { routeFor, type Locale } from "@/lib/routes";
import { getAllProjects } from "@/features/work/projects";

const ARROW = (
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="1.8"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
	>
		<path d="M7 17 17 7" />
		<path d="M9 7h8v8" />
	</svg>
);

// Homepage copy only. Project data comes from projects.ts.
const COPY = {
	en: {
		eyebrow: "Selected work",
		title: "Ideas brought to life.",
		viewAll: "View all projects",
		exploreProject: "Explore project",
	},
	pl: {
		eyebrow: "Wybrane realizacje",
		title: "Pomysły, które stały się rzeczywistością.",
		viewAll: "Zobacz wszystkie projekty",
		exploreProject: "Poznaj projekt",
	},
};

export function TakBliskoArt() {
	return (
		<svg
			viewBox="0 0 400 220"
			width="100%"
			height="100%"
			preserveAspectRatio="xMidYMid slice"
			aria-hidden="true"
		>
			<rect width="400" height="220" fill="#0c1120" />
			<g stroke="#22304f" strokeWidth="1">
				<path d="M0 40h400M0 80h400M0 120h400M0 160h400M40 0v220M110 0v220M180 0v220M250 0v220M320 0v220" />
			</g>
			<path
				d="M20 190 C90 120 140 150 200 90 C250 45 300 70 380 20"
				fill="none"
				stroke="#3b82f6"
				strokeWidth="2"
				opacity=".55"
			/>
			<circle cx="205" cy="98" r="34" fill="url(#pinGlow)" />
			<circle cx="205" cy="98" r="9" fill="#7fd9ff" />
			<circle cx="205" cy="98" r="4" fill="#08101f" />
			<circle cx="120" cy="150" r="4" fill="#5b9dff" />
			<circle cx="290" cy="60" r="4" fill="#5b9dff" />
			<defs>
				<radialGradient id="pinGlow">
					<stop offset="0%" stopColor="#3b82f6" stopOpacity=".55" />
					<stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
				</radialGradient>
			</defs>
		</svg>
	);
}

export function PlmsArt() {
	return (
		<svg
			viewBox="0 0 400 220"
			width="100%"
			height="100%"
			preserveAspectRatio="xMidYMid slice"
			aria-hidden="true"
		>
			<rect width="400" height="220" fill="#0c1120" />
			<rect x="18" y="18" width="364" height="30" rx="6" fill="#141d33" />
			<circle cx="34" cy="33" r="5" fill="#3b82f6" />
			<rect x="50" y="28" width="90" height="8" rx="4" fill="#2a3654" />
			<g fill="#141d33">
				<rect x="18" y="60" width="364" height="34" rx="6" />
				<rect x="18" y="102" width="364" height="34" rx="6" />
				<rect x="18" y="144" width="364" height="34" rx="6" />
			</g>
			<g fill="#34d399">
				<circle cx="34" cy="77" r="4" />
				<circle cx="34" cy="119" r="4" />
			</g>
			<circle cx="34" cy="161" r="4" fill="#fbbf24" />
			<g fill="#2a3654">
				<rect x="50" y="72" width="130" height="8" rx="4" />
				<rect x="50" y="114" width="150" height="8" rx="4" />
				<rect x="50" y="156" width="110" height="8" rx="4" />
			</g>
			<g fill="#1c2947">
				<rect x="300" y="72" width="66" height="8" rx="4" />
				<rect x="300" y="114" width="66" height="8" rx="4" />
				<rect x="300" y="156" width="66" height="8" rx="4" />
			</g>
		</svg>
	);
}

export function VaultArt() {
	return (
		<svg
			viewBox="0 0 400 220"
			width="100%"
			height="100%"
			preserveAspectRatio="xMidYMid slice"
			aria-hidden="true"
		>
			<rect width="400" height="220" fill="#070a14" />
			<g stroke="#1c2947" strokeWidth="1">
				<path d="M40 30v160M90 30v160M140 30v160M190 30v160M240 30v160M290 30v160M340 30v160" />
			</g>
			<rect
				x="150"
				y="80"
				width="100"
				height="70"
				rx="10"
				fill="#0d1526"
				stroke="#3b82f6"
				strokeWidth="1.4"
			/>
			<path
				d="M170 100v-8a30 30 0 0 1 60 0v8"
				fill="none"
				stroke="#7fd9ff"
				strokeWidth="4"
				strokeLinecap="round"
			/>
			<rect
				x="182"
				y="108"
				width="36"
				height="26"
				rx="4"
				fill="#3b82f6"
				opacity=".85"
			/>
			<circle cx="200" cy="121" r="4" fill="#08101f" />
		</svg>
	);
}

// Visual components mapped to project keys.
const ART_BY_KEY: Record<string, ComponentType> = {
	takblisko: TakBliskoArt,
	plms: PlmsArt,
	vault: VaultArt,
};

export function SelectedWork({ locale }: { locale: Locale }) {
	const t = COPY[locale];
	const projects = getAllProjects();
	return (
		<section id="work">
			<div className="wrap">
				<div className="section-head reveal">
					<div>
						<span className="eyebrow">{t.eyebrow}</span>
						<h2>{t.title}</h2>
					</div>
					<Link href={routeFor("work", locale)} className="view-all">
						{t.viewAll} {ARROW}
					</Link>
				</div>

				<div className="work-grid reveal-stagger">
					{projects.map((project) => {
						const ArtComponent =
							project.visual.kind === "art"
								? ART_BY_KEY[project.visual.key]
								: null;
						return (
							<Link
								href={routeFor("work", locale)}
								className="work-card card"
								key={project.slug}
							>
								<div className="work-visual">
									{project.visual.kind === "image" ? (
										<Image
											src={project.visual.src}
											alt={project.visual.alt[locale]}
											width={project.visual.width}
											height={project.visual.height}
											className="work-visual-img"
										/>
									) : ArtComponent ? (
										<ArtComponent />
									) : null}
								</div>
								<div className="work-body">
									<b>{project.name}</b>
									<p>{project.shortDescription[locale]}</p>
									<div className="tag-row">
										{project.tags.map((tag) => (
											<span className="tag" key={tag}>
												{tag}
											</span>
										))}
									</div>
									<span className="case-link">
										{t.exploreProject} {ARROW}
									</span>
								</div>
							</Link>
						);
					})}
				</div>
			</div>
		</section>
	);
}
