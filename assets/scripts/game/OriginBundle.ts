import {
  Asset,
  AssetManager,
  BufferAsset,
  ImageAsset,
  JsonAsset,
  Prefab,
  assetManager,
  instantiate,
  resources,
} from 'cc';
import { ITEM_DEFS, ItemKind } from './ItemDef';

const EXTS = ['.json', '.js', '.bin', '.jpg', '.jpeg', '.png', '.cconb'];

let _bundle: AssetManager.Bundle | null = null;
let _ready: Promise<boolean> | null = null;
let _hooked = false;
const _files = new Map<string, Asset>();

function relFromUrl(url: string): string {
  const u = url.replace(/\\/g, '/');
  const mark = 'pg-origin/';
  const i = u.indexOf(mark);
  return i >= 0 ? u.slice(i + mark.length).split('?')[0] : u.split('?')[0];
}

function fileKey(rel: string): string {
  return rel.replace(/\\/g, '/').replace(/^\//, '');
}

function remember(asset: Asset): void {
  const url = ((asset as { nativeUrl?: string }).nativeUrl || '').replace(/\\/g, '/');
  const idx = url.indexOf('/origin/');
  if (idx >= 0) {
    const rel = url.slice(idx + '/origin/'.length).split('?')[0];
    _files.set(fileKey(rel), asset);
    _files.set(fileKey(rel.replace(/\.[^.]+$/, '')), asset);
  }
  if (asset.name) _files.set(asset.name, asset);
}

function findFile(rel: string): Asset | null {
  const k = fileKey(rel);
  return (
    _files.get(k) ||
    _files.get(k.replace(/\.[^.]+$/, '')) ||
    _files.get(k.split('/').pop() || '') ||
    null
  );
}

function deliver(rel: string, asset: Asset, onComplete: (e: Error | null, data?: unknown) => void): void {
  if (asset instanceof JsonAsset) {
    onComplete(null, JSON.stringify(asset.json ?? {}));
    return;
  }
  if (asset instanceof BufferAsset) {
    onComplete(null, asset.buffer());
    return;
  }
  if (asset instanceof ImageAsset) {
    const src = asset.nativeUrl;
    if (typeof Image !== 'undefined' && src) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => onComplete(null, img);
      img.onerror = () => onComplete(new Error('origin image ' + rel));
      img.src = src;
      return;
    }
    onComplete(null, asset.data);
    return;
  }
  const anyA = asset as { json?: unknown; buffer?: () => ArrayBuffer };
  if (anyA.json) {
    onComplete(null, JSON.stringify(anyA.json));
    return;
  }
  if (typeof anyA.buffer === 'function') {
    onComplete(null, anyA.buffer());
    return;
  }
  onComplete(new Error('origin type ' + rel));
}

function isOriginUrl(url: unknown): boolean {
  const s = String(url);
  return s.indexOf('pg-origin') >= 0;
}

function hookDownloader(): void {
  if (_hooked) return;
  _hooked = true;
  const dl = assetManager.downloader as unknown as {
    downloaders?: Record<string, (url: string, opts: unknown, cb: (e: Error | null, d?: unknown) => void) => void>;
    _downloaders?: Record<string, (url: string, opts: unknown, cb: (e: Error | null, d?: unknown) => void) => void>;
    register: (ext: string, fn: (url: string, opts: unknown, cb: (e: Error | null, d?: unknown) => void) => void) => void;
    download?: (...args: unknown[]) => unknown;
    downloadScript?: (url: string, opts: unknown, cb?: (e: Error | null, d?: unknown) => void) => void;
  };
  const table = dl.downloaders || dl._downloaders || {};
  for (const ext of EXTS) {
    const prev = table[ext];
    dl.register(ext, (url, opts, cb) => {
      if (!isOriginUrl(url)) {
        if (prev) prev(url, opts, cb);
        else cb(new Error('no downloader ' + ext));
        return;
      }
      const rel = relFromUrl(url);
      if (rel === 'index.js' || rel.endsWith('/index.js')) {
        cb(null, '');
        return;
      }
      const asset = findFile(rel);
      if (!asset) {
        cb(new Error('origin missing ' + rel));
        return;
      }
      deliver(rel, asset, cb);
    });
  }
}

function loadDir(dir: string): Promise<Asset[]> {
  return new Promise((resolve, reject) => {
    resources.loadDir(dir, (err, assets) => {
      if (err) reject(err);
      else resolve((assets || []) as Asset[]);
    });
  });
}

function loadConfig(): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    resources.load('origin/config', JsonAsset, (err, asset) => {
      if (err || !asset?.json) reject(err || new Error('origin config'));
      else resolve({ ...(asset.json as Record<string, unknown>) });
    });
  });
}

function mountBundle(cfg: Record<string, unknown>): AssetManager.Bundle {
  const opts = {
    ...cfg,
    name: 'origin',
    base: 'pg-origin/',
    hasPreloadScript: false,
    deps: [],
  };
  const bundle = new AssetManager.Bundle();
  bundle.init(opts);
  const bags = assetManager.bundles as unknown as {
    add: (k: string, v: AssetManager.Bundle) => void;
  };
  bags.add('origin', bundle);
  return bundle;
}

export function originReady(): boolean {
  return !!_bundle;
}

export function ensureOriginBundle(): Promise<boolean> {
  if (_bundle) return Promise.resolve(true);
  if (_ready) return _ready;
  _ready = (async () => {
    try {
      const assets = await loadDir('origin');
      for (const a of assets) remember(a);
      if (!_files.size) {
        console.warn('PickGeese: origin folder imported 0 files, wait for editor import');
        return false;
      }
      hookDownloader();
      const cfg = await loadConfig();
      _bundle = mountBundle(cfg);
      console.log('PickGeese: origin bundle mounted', _files.size);
      return true;
    } catch (e) {
      console.warn('PickGeese: origin bundle unavailable, using primitives', e);
      return false;
    }
  })();
  return _ready;
}

const _prefabCache = new Map<string, Prefab>();

export function spawnOriginItem(_kind: ItemKind, _parent: NodeLike): import('cc').Node | null {
  return null;
}

function spawnPath(path: string, parent: NodeLike): import('cc').Node | null {
  let prefab = _prefabCache.get(path);
  if (!prefab) {
    prefab = _bundle!.get(path, Prefab) as Prefab | null;
    if (prefab) _prefabCache.set(path, prefab);
  }
  if (!prefab) return null;
  try {
    const node = instantiate(prefab);
    parent.addChild(node);
    return node;
  } catch (e) {
    console.warn('PickGeese: instantiate', path, e);
    return null;
  }
}

export function preloadOriginPrefabs(_kinds: ItemKind[]): Promise<void> {
  if (!_bundle) return Promise.resolve();
  const paths: string[] = [];
  return new Promise((resolve) => {
    let left = paths.length;
    if (!left) {
      resolve();
      return;
    }
    for (const p of paths) {
      _bundle!.load(p, Prefab, (err, prefab) => {
        if (!err && prefab) _prefabCache.set(p, prefab);
        else console.warn('PickGeese: load prefab', p, err);
        left--;
        if (left <= 0) resolve();
      });
    }
  });
}

type NodeLike = { addChild: (n: import('cc').Node) => void };
