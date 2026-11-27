// kimap/modules/asset-url.js

/* global __KIM_ASSET_ORIGIN__ */
export const KENSHI_CDN_BASE = typeof __KIM_ASSET_ORIGIN__ === 'string' ? __KIM_ASSET_ORIGIN__ : 'https://kim-assets.kenshi.wiki';
export const KENSHI_ASSET_VERSION = '2026-07-13-1';



const CDN_ORIGIN = new URL(KENSHI_CDN_BASE).origin;
const MAP_ASSET_HOSTS = new Set([
    'map.kenshi.wiki',
    'backmap.kenshi.wiki',
    'localhost',
    '127.0.0.1'
]);
const ASSET_ROOT_PATTERN = /^(?:icons|data)\//i;
const MUTABLE_MANIFEST_PATH_PATTERN = /^data\/(?:vanilla|mod-manifests)\//i;

function exposeGlobals() {
    if (typeof window === 'undefined') return;

    window.KENSHI_CDN_BASE = KENSHI_CDN_BASE;
    window.KENSHI_CDN_ORIGIN = KENSHI_CDN_BASE;
    window.KENSHI_ASSET_VERSION = KENSHI_ASSET_VERSION;
    window.kenshiAssetUrl = kenshiAssetUrl;
}

function currentHost() {
    if (typeof window === 'undefined' || !window.location) return '';
    return window.location.hostname.toLowerCase();
}

function isMapAssetHost(hostname) {
    const normalized = hostname.toLowerCase();
    return normalized === currentHost() || MAP_ASSET_HOSTS.has(normalized);
}

function cleanAssetPath(pathname) {
    return decodeURIComponent(pathname)
        .replace(/\\/g, '/')
        .replace(/^\.?\//, '')
        .replace(/^\/+/, '');
}

function splitRelativeUrl(value) {
    const match = String(value).match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);
    if (!match) return null;

    return {
        pathname: match[1] || '',
        search: match[2] || '',
        hash: match[3] || ''
    };
}

function parseAssetUrl(value) {
    if (!value) return null;

    const rawValue = String(value).trim();
    if (!rawValue || /^(?:data|blob):/i.test(rawValue)) return null;

    if (/^https?:\/\//i.test(rawValue)) {
        let url;
        try {
            url = new URL(rawValue);
        } catch (_error) {
            return null;
        }

        if (url.origin === CDN_ORIGIN) {
            return null;
        }

        if (!isMapAssetHost(url.hostname)) {
            return null;
        }

        const assetPath = cleanAssetPath(url.pathname);
        if (!ASSET_ROOT_PATTERN.test(assetPath)) return null;

        return {
            assetPath,
            search: url.search,
            hash: url.hash,
            originalValue: rawValue,
            isAbsolute: true
        };
    }

    const relative = splitRelativeUrl(rawValue);
    if (!relative) return null;

    const assetPath = cleanAssetPath(relative.pathname);
    if (!ASSET_ROOT_PATTERN.test(assetPath)) return null;

    return {
        assetPath,
        search: relative.search,
        hash: relative.hash,
        originalValue: rawValue,
        isAbsolute: false
    };
}

function buildLocalUrl(asset) {
    return `${asset.assetPath}${asset.search}${asset.hash}`;
}

function buildCdnUrl(asset, version) {
    const url = new URL(`${KENSHI_CDN_BASE}/${asset.assetPath}`);
    url.search = asset.search;

    if (version && !url.searchParams.has('v')) {
        url.searchParams.set('v', version);
    }

    return `${url.toString()}${asset.hash}`;
}

export function isMutableManifestAssetPath(value) {
    const asset = parseAssetUrl(value);
    return Boolean(asset && MUTABLE_MANIFEST_PATH_PATTERN.test(asset.assetPath));
}

export function kenshiAssetUrl(value, options = {}) {
    const asset = parseAssetUrl(value);
    if (!asset) return value;

    if (MUTABLE_MANIFEST_PATH_PATTERN.test(asset.assetPath)) {
        return asset.isAbsolute ? asset.originalValue : buildLocalUrl(asset);
    }

    return buildCdnUrl(asset, options.version ?? KENSHI_ASSET_VERSION);
}

export function rewriteElementAssetUrls(root, options = {}) {
    if (!root || !root.querySelectorAll) return;

    root.querySelectorAll('img[src]').forEach((img) => {
        img.src = kenshiAssetUrl(img.getAttribute('src'), options);
    });
}

exposeGlobals();
