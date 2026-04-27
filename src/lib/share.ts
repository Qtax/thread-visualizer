import type { Thread, Workspace } from "./thread-visualizer-types";

/** Hash prefix that marks a URL as carrying a shared workspace payload. */
export const SHARE_HASH_PREFIX = "#share=";

export type SharePayload = {
	name: string;
	threads: { name: string; code: string }[];
};

async function compress(data: Uint8Array): Promise<Uint8Array> {
	const stream = new Blob([data as BlobPart])
		.stream()
		.pipeThrough(new CompressionStream("deflate-raw"));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function decompress(data: Uint8Array): Promise<Uint8Array> {
	const stream = new Blob([data as BlobPart])
		.stream()
		.pipeThrough(new DecompressionStream("deflate-raw"));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
	let s = "";
	for (const b of bytes) s += String.fromCharCode(b);
	return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str: string): Uint8Array {
	const padded = str + "===".slice((str.length + 3) % 4);
	const s = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
	const arr = new Uint8Array(s.length);
	for (let i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i);
	return arr;
}

export async function encodeShare(payload: SharePayload): Promise<string> {
	const json = JSON.stringify(payload);
	return toBase64Url(await compress(new TextEncoder().encode(json)));
}

export async function decodeShare(token: string): Promise<SharePayload | null> {
	try {
		const decompressed = await decompress(fromBase64Url(token));
		const parsed = JSON.parse(new TextDecoder().decode(decompressed)) as unknown;
		if (
			!parsed ||
			typeof parsed !== "object" ||
			!Array.isArray((parsed as SharePayload).threads)
		) {
			return null;
		}
		const p = parsed as SharePayload;
		const threads = p.threads
			.filter((t) => t && typeof t.name === "string" && typeof t.code === "string")
			.map((t) => ({ name: t.name, code: t.code }));
		return { name: typeof p.name === "string" ? p.name : "Shared", threads };
	} catch {
		return null;
	}
}

export function readShareTokenFromHash(): string | null {
	if (typeof window === "undefined") return null;
	const h = window.location.hash;
	return h.startsWith(SHARE_HASH_PREFIX) ? h.slice(SHARE_HASH_PREFIX.length) : null;
}

export function clearShareHash(): void {
	if (typeof window === "undefined") return;
	const { pathname, search } = window.location;
	window.history.replaceState(null, "", `${pathname}${search}`);
}

export function buildShareUrl(token: string): string {
	const { origin, pathname, search } = window.location;
	return `${origin}${pathname}${search}${SHARE_HASH_PREFIX}${token}`;
}

/** True when the workspace's current name+threads match a shared payload exactly. */
export function workspaceMatchesPayload(workspace: Workspace, payload: SharePayload): boolean {
	if (workspace.name !== payload.name) return false;
	if (workspace.threads.length !== payload.threads.length) return false;
	return workspace.threads.every(
		(t: Thread, i) => t.name === payload.threads[i].name && t.code === payload.threads[i].code
	);
}
