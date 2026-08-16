const REPO = 'Next-Tablet-Driver/NextTabletDriver';
const API_ROOT = `https://api.github.com/repos/${REPO}`;

export const REPO_URL = `https://github.com/${REPO}`;
export const RELEASES_URL = `${REPO_URL}/releases`;
export const TABLETS_URL = `${REPO_URL}/tree/main/tablets`;

export interface ReleaseAsset {
	name: string;
	url: string;
	size: number;
}

export interface OSDownload {
	primary: ReleaseAsset;
	checksum: ReleaseAsset | null;
	alt: ReleaseAsset | null;
}

export interface LatestRelease {
	version: string | null;
	publishedAt: string | null;
	releaseUrl: string;
	windows: OSDownload | null;
	linux: OSDownload | null;
}

export interface RepoStats {
	stars: number | null;
	htmlUrl: string;
	license: string | null;
}

export interface GithubData {
	release: LatestRelease;
	repo: RepoStats;
}

function authHeaders(): HeadersInit {
	const headers: Record<string, string> = {
		Accept: 'application/vnd.github+json',
		'X-GitHub-Api-Version': '2022-11-28',
	};
	const token = import.meta.env.GITHUB_TOKEN;
	if (token) headers.Authorization = `Bearer ${token}`;
	return headers;
}

function classifyAssets(assets: ReleaseAsset[]) {
	// linuxdeploy-* assets are build tooling bundled into the release by mistake, not driver installers.
	const installers = assets.filter((a) => !a.name.toLowerCase().startsWith('linuxdeploy'));

	const exe = installers.find((a) => a.name.endsWith('.exe')) ?? null;
	const appImage = installers.find((a) => a.name.endsWith('.AppImage')) ?? null;
	const deb = installers.find((a) => a.name.endsWith('.deb')) ?? null;

	const checksumFor = (asset: ReleaseAsset | null) =>
		asset ? (installers.find((a) => a.name === `${asset.name}.sha256`) ?? null) : null;

	const windows: OSDownload | null = exe
		? { primary: exe, checksum: checksumFor(exe), alt: null }
		: null;

	const linux: OSDownload | null = appImage
		? { primary: appImage, checksum: checksumFor(appImage), alt: deb }
		: deb
			? { primary: deb, checksum: null, alt: null }
			: null;

	return { windows, linux };
}

// Never throws: a GitHub outage or rate limit must not take the whole site down with it.
// On failure this logs a build-time warning and returns `null`, and the caller falls back
// to data that still lets the page render (generic links, hidden stats).
async function safeFetchJson(url: string, headers: HeadersInit): Promise<any | null> {
	try {
		const res = await fetch(url, { headers });
		if (!res.ok) {
			console.warn(`[github] ${url} returned ${res.status}, falling back to degraded data.`);
			return null;
		}
		return await res.json();
	} catch (err) {
		console.warn(`[github] fetch failed for ${url}, falling back to degraded data.`, err);
		return null;
	}
}

export async function getGithubData(): Promise<GithubData> {
	const headers = authHeaders();

	const [releaseData, repoData] = await Promise.all([
		safeFetchJson(`${API_ROOT}/releases/latest`, headers),
		safeFetchJson(API_ROOT, headers),
	]);

	const assets: ReleaseAsset[] =
		releaseData?.assets?.map((a: any) => ({
			name: a.name,
			url: a.browser_download_url,
			size: a.size,
		})) ?? [];

	const { windows, linux } = classifyAssets(assets);

	return {
		release: {
			version: releaseData?.tag_name?.replace(/^v/, '') ?? null,
			publishedAt: releaseData?.published_at ?? null,
			releaseUrl: releaseData?.html_url ?? RELEASES_URL,
			windows,
			linux,
		},
		repo: {
			stars: repoData?.stargazers_count ?? null,
			htmlUrl: repoData?.html_url ?? REPO_URL,
			license: repoData?.license?.spdx_id ?? null,
		},
	};
}

export function formatBytes(bytes: number): string {
	const mb = bytes / (1024 * 1024);
	return `${mb.toFixed(1)} MB`;
}
