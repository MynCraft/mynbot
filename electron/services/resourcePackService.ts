import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

export function readZipEntries(buffer: Buffer): Map<string, () => Buffer> {
  const entries = new Map<string, () => Buffer>();
  if (buffer.length < 22) return entries;

  // Locate the End of Central Directory (EOCD) signature 0x06054b50
  // by scanning backwards from the end of buffer (up to 65557 bytes).
  let eocdOffset = -1;
  const maxScan = Math.min(buffer.length, 65557);
  const minPos = buffer.length - maxScan;
  for (let i = buffer.length - 22; i >= minPos; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) return entries;

  const centralDirEntries = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirSize = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirOffset = buffer.readUInt32LE(eocdOffset + 16);
  const centralDirEnd = centralDirOffset + centralDirSize;

  let pos = centralDirOffset;
  for (let i = 0; i < centralDirEntries && pos + 46 <= buffer.length && pos + 46 <= centralDirEnd; i++) {
    if (buffer.readUInt32LE(pos) !== 0x02014b50) {
      break;
    }

    const compressionMethod = buffer.readUInt16LE(pos + 10);
    const compressedSize = buffer.readUInt32LE(pos + 20);
    const uncompressedSize = buffer.readUInt32LE(pos + 24);
    void uncompressedSize;
    const fileNameLength = buffer.readUInt16LE(pos + 28);
    const extraFieldLength = buffer.readUInt16LE(pos + 30);
    const commentLength = buffer.readUInt16LE(pos + 32);
    const localHeaderOffset = buffer.readUInt32LE(pos + 42);

    const fileNameRaw = buffer.subarray(pos + 46, pos + 46 + fileNameLength).toString('utf8');
    pos += 46 + fileNameLength + extraFieldLength + commentLength;

    const fileName = fileNameRaw.replace(/\\/g, '/').replace(/^\.?\//, '');
    if (fileName.endsWith('/')) {
      continue;
    }

    let cached: Buffer | null = null;
    const getter = (): Buffer => {
      if (cached) return cached;
      if (localHeaderOffset + 30 > buffer.length) {
        throw new Error(`Invalid local header offset for ${fileName}`);
      }
      if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
        throw new Error(`Invalid local file header signature for ${fileName}`);
      }
      const localNameLen = buffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraLen = buffer.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
      const rawSlice = buffer.subarray(dataStart, dataStart + compressedSize);

      if (compressionMethod === 0) {
        cached = rawSlice;
      } else if (compressionMethod === 8) {
        cached = zlib.inflateRawSync(rawSlice);
      } else {
        throw new Error(`Unsupported compression method ${compressionMethod} for ${fileName}`);
      }
      return cached;
    };

    entries.set(fileName, getter);
    const lower = fileName.toLowerCase();
    if (!entries.has(lower)) {
      entries.set(lower, getter);
    }

    const assetsIdx = fileName.indexOf('assets/');
    if (assetsIdx > 0) {
      const norm = fileName.slice(assetsIdx);
      if (!entries.has(norm)) entries.set(norm, getter);
      const normLower = norm.toLowerCase();
      if (!entries.has(normLower)) entries.set(normLower, getter);
    }
  }

  return entries;
}

export class ParsedPack {
  private readonly entries: Map<string, () => Buffer>;
  private jsonCache = new Map<string, any>();

  constructor(entries: Map<string, () => Buffer>) {
    this.entries = entries;
  }

  hasEntry(path: string): boolean {
    return this.entries.has(path) || this.entries.has(path.toLowerCase());
  }

  getEntryBuffer(path: string): Buffer | null {
    const fn = this.entries.get(path) ?? this.entries.get(path.toLowerCase());
    if (!fn) return null;
    try {
      return fn();
    } catch {
      return null;
    }
  }

  readJson(entryPath: string): any {
    if (this.jsonCache.has(entryPath)) {
      return this.jsonCache.get(entryPath);
    }
    const buf = this.getEntryBuffer(entryPath);
    if (!buf) {
      this.jsonCache.set(entryPath, null);
      return null;
    }
    try {
      let text = buf.toString('utf8');
      if (text.charCodeAt(0) === 0xfeff) {
        text = text.slice(1);
      }
      const data = JSON.parse(text);
      this.jsonCache.set(entryPath, data);
      return data;
    } catch {
      this.jsonCache.set(entryPath, null);
      return null;
    }
  }

  resolveModelPath(ref: string): string {
    let ns = 'minecraft';
    let pathPart = ref;
    if (ref.includes(':')) {
      const parts = ref.split(':');
      ns = parts[0];
      pathPart = parts.slice(1).join(':');
    }
    if (pathPart.endsWith('.json')) {
      pathPart = pathPart.slice(0, -5);
    }
    if (pathPart.startsWith('models/')) {
      return `assets/${ns}/${pathPart}.json`;
    }
    return `assets/${ns}/models/${pathPart}.json`;
  }

  resolveTexturePath(ref: string): string {
    let ns = 'minecraft';
    let pathPart = ref;
    if (ref.includes(':')) {
      const parts = ref.split(':');
      ns = parts[0];
      pathPart = parts.slice(1).join(':');
    }
    if (pathPart.endsWith('.png')) {
      pathPart = pathPart.slice(0, -4);
    }
    if (pathPart.startsWith('textures/')) {
      return `assets/${ns}/${pathPart}.png`;
    }
    return `assets/${ns}/textures/${pathPart}.png`;
  }

  extractTextureFromModel(
    modelRef: string,
    visited = new Set<string>(),
    inheritedTextures: Record<string, string> = {}
  ): string | null {
    if (visited.has(modelRef)) return null;
    visited.add(modelRef);

    const modelPath = this.resolveModelPath(modelRef);
    const modelJson = this.readJson(modelPath);
    if (!modelJson) return null;

    const currentTextures: Record<string, string> = {
      ...inheritedTextures,
      ...(typeof modelJson.textures === 'object' && modelJson.textures !== null ? modelJson.textures : {}),
    };

    if (typeof modelJson.textures === 'object' && modelJson.textures !== null) {
      const preferredKeys = ['layer0', '0', '1', 'texture', 'all', 'front', 'top', 'side', 'particle'];
      const candidateKeys = [...preferredKeys];
      for (const k of Object.keys(modelJson.textures)) {
        if (!candidateKeys.includes(k) && typeof modelJson.textures[k] === 'string') {
          candidateKeys.push(k);
        }
      }

      for (const key of candidateKeys) {
        let val = currentTextures[key];
        if (typeof val !== 'string') continue;

        let hops = 0;
        while (typeof val === 'string' && val.startsWith('#') && hops < 10) {
          const refKey = val.slice(1);
          val = currentTextures[refKey];
          hops++;
        }

        if (typeof val === 'string' && !val.startsWith('#')) {
          const texPath = this.resolveTexturePath(val);
          const pngBuf = this.getEntryBuffer(texPath);
          if (pngBuf) {
            return `data:image/png;base64,${pngBuf.toString('base64')}`;
          }
        }
      }
    }

    if (typeof modelJson.parent === 'string' && modelJson.parent) {
      const parentResult = this.extractTextureFromModel(modelJson.parent, visited, currentTextures);
      if (parentResult) return parentResult;
    }

    return null;
  }
}

export class ResourcePackService {
  private readonly cacheDir: string;
  private readonly onPackLoaded?: () => void;
  private packs = new Map<string, ParsedPack>();
  private loading = new Map<string, Promise<ParsedPack | null>>();
  private resolvedCache = new Map<string, string | null>();

  constructor(cacheDir: string, onPackLoaded?: () => void) {
    this.cacheDir = cacheDir;
    this.onPackLoaded = onPackLoaded;
  }

  async ensurePackLoaded(url: string): Promise<ParsedPack | null> {
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      return null;
    }
    if (this.packs.has(url)) {
      return this.packs.get(url)!;
    }
    if (this.loading.has(url)) {
      return await this.loading.get(url)!;
    }

    const loadPromise = (async () => {
      try {
        await fs.promises.mkdir(this.cacheDir, { recursive: true });
        const hash = crypto.createHash('sha1').update(url).digest('hex');
        const zipPath = path.join(this.cacheDir, `${hash}.zip`);

        let buffer: Buffer | null = null;
        try {
          const stat = await fs.promises.stat(zipPath);
          if (stat.size > 0) {
            buffer = await fs.promises.readFile(zipPath);
          }
        } catch {
          buffer = null;
        }

        if (!buffer) {
          const MAX_PACK_BYTES = 50 * 1024 * 1024;
          const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
          if (!response.ok) {
            return null;
          }
          const contentLen = Number(response.headers.get('content-length') || 0);
          if (contentLen > MAX_PACK_BYTES) {
            console.warn(`[ResourcePackService] Pack exceeds 50 MB limit (${contentLen} bytes): ${url}`);
            return null;
          }
          const ab = await response.arrayBuffer();
          if (ab.byteLength > MAX_PACK_BYTES) {
            console.warn(`[ResourcePackService] Pack exceeds 50 MB limit (${ab.byteLength} bytes): ${url}`);
            return null;
          }
          buffer = Buffer.from(ab);
          await fs.promises.writeFile(zipPath, buffer);
        }

        const entries = readZipEntries(buffer);
        const pack = new ParsedPack(entries);
        this.packs.set(url, pack);
        this.resolvedCache.clear();
        this.onPackLoaded?.();
        return pack;
      } catch (err) {
        console.error(`[ResourcePackService] Error loading pack from ${url}:`, err);
        return null;
      } finally {
        this.loading.delete(url);
      }
    })();

    this.loading.set(url, loadPromise);
    return await loadPromise;
  }

  async preloadUrls(urls: string[]): Promise<void> {
    const validUrls = urls.filter(u => typeof u === 'string' && /^https?:\/\//i.test(u));
    await Promise.allSettled(validUrls.map(u => this.ensurePackLoaded(u)));
  }

  private searchItemDefinitionTexture(pack: ParsedPack, node: any, cmd: number): string | null {
    if (!node || typeof node !== 'object') return null;

    if (node.threshold === cmd || node.when === cmd || node.when === String(cmd)) {
      const modelRef = typeof node.model === 'string' ? node.model : (typeof node.model?.model === 'string' ? node.model.model : null);
      if (modelRef) {
        const tex = pack.extractTextureFromModel(modelRef);
        if (tex) return tex;
      }
    }

    if (Array.isArray(node.entries)) {
      for (const entry of node.entries) {
        if (entry && (entry.threshold === cmd || entry.when === cmd || entry.when === String(cmd))) {
          const modelRef = typeof entry.model === 'string' ? entry.model : (typeof entry.model?.model === 'string' ? entry.model.model : null);
          if (modelRef) {
            const tex = pack.extractTextureFromModel(modelRef);
            if (tex) return tex;
          }
        }
      }

      let bestThreshold = -Infinity;
      let bestModelRef: string | null = null;
      for (const entry of node.entries) {
        if (entry && typeof entry.threshold === 'number' && entry.threshold <= cmd && entry.threshold > bestThreshold) {
          const modelRef = typeof entry.model === 'string' ? entry.model : (typeof entry.model?.model === 'string' ? entry.model.model : null);
          if (modelRef) {
            bestThreshold = entry.threshold;
            bestModelRef = modelRef;
          }
        }
      }
      if (bestModelRef) {
        const tex = pack.extractTextureFromModel(bestModelRef);
        if (tex) return tex;
      }
    }

    if (Array.isArray(node.cases)) {
      for (const c of node.cases) {
        if (c && (c.when === cmd || c.when === String(cmd))) {
          const modelRef = typeof c.model === 'string' ? c.model : (typeof c.model?.model === 'string' ? c.model.model : null);
          if (modelRef) {
            const tex = pack.extractTextureFromModel(modelRef);
            if (tex) return tex;
          }
        }
      }
    }

    for (const val of Object.values(node)) {
      if (val && typeof val === 'object') {
        const tex = this.searchItemDefinitionTexture(pack, val, cmd);
        if (tex) return tex;
      }
    }

    return null;
  }

  async resolveItemTexture(itemName: string, customModelData?: number, urls?: string[]): Promise<string | null> {
    if (urls && urls.length > 0) {
      await Promise.allSettled(urls.map(u => this.ensurePackLoaded(u)));
    }

    const urlKey = urls && urls.length > 0 ? urls.join('|') : [...this.packs.keys()].join('|');
    const cacheKey = `${urlKey}::${itemName}:${customModelData ?? ''}`;
    if (this.resolvedCache.has(cacheKey)) {
      return this.resolvedCache.get(cacheKey)!;
    }

    let ns = 'minecraft';
    let cleanName = itemName;
    if (itemName.includes(':')) {
      const parts = itemName.split(':');
      ns = parts[0];
      cleanName = parts.slice(1).join(':');
    }

    const packList: ParsedPack[] = [];
    const seen = new Set<ParsedPack>();
    if (urls) {
      for (let i = urls.length - 1; i >= 0; i--) {
        const p = this.packs.get(urls[i]);
        if (p && !seen.has(p)) {
          seen.add(p);
          packList.push(p);
        }
      }
    }
    for (const p of [...this.packs.values()].reverse()) {
      if (!seen.has(p)) {
        seen.add(p);
        packList.push(p);
      }
    }

    // 1. If customModelData != null, check overrides
    if (customModelData != null) {
      for (const pack of packList) {
        // Check assets/<ns>/models/item/<itemName>.json overrides
        const modelJson = pack.readJson(`assets/${ns}/models/item/${cleanName}.json`);
        if (modelJson && Array.isArray(modelJson.overrides)) {
          let exactModel: string | null = null;
          let lastLteModel: string | null = null;
          for (const override of modelJson.overrides) {
            const cmd = override?.predicate?.custom_model_data;
            if (typeof cmd === 'number' && typeof override?.model === 'string') {
              if (cmd === customModelData) {
                exactModel = override.model;
              }
              if (cmd <= customModelData) {
                lastLteModel = override.model;
              }
            }
          }
          const targetModel = exactModel ?? lastLteModel;
          if (targetModel) {
            const tex = pack.extractTextureFromModel(targetModel);
            if (tex) {
              this.resolvedCache.set(cacheKey, tex);
              return tex;
            }
          }
        }

        // Check 1.21.4+ item model definition assets/<ns>/items/<itemName>.json
        const itemDefJson = pack.readJson(`assets/${ns}/items/${cleanName}.json`);
        if (itemDefJson) {
          const tex = this.searchItemDefinitionTexture(pack, itemDefJson, customModelData);
          if (tex) {
            this.resolvedCache.set(cacheKey, tex);
            return tex;
          }
        }
      }
    }

    // 2. Base item model or direct png overrides
    for (const pack of packList) {
      const itemTex = `assets/${ns}/textures/item/${cleanName}.png`;
      const itemBuf = pack.getEntryBuffer(itemTex);
      if (itemBuf) {
        const tex = `data:image/png;base64,${itemBuf.toString('base64')}`;
        this.resolvedCache.set(cacheKey, tex);
        return tex;
      }

      const blockTex = `assets/${ns}/textures/block/${cleanName}.png`;
      const blockBuf = pack.getEntryBuffer(blockTex);
      if (blockBuf) {
        const tex = `data:image/png;base64,${blockBuf.toString('base64')}`;
        this.resolvedCache.set(cacheKey, tex);
        return tex;
      }

      const baseModelPath = `assets/${ns}/models/item/${cleanName}.json`;
      if (pack.hasEntry(baseModelPath)) {
        const modelRef = ns === 'minecraft' ? `item/${cleanName}` : `${ns}:item/${cleanName}`;
        const tex = pack.extractTextureFromModel(modelRef);
        if (tex) {
          this.resolvedCache.set(cacheKey, tex);
          return tex;
        }
      }
    }

    if (packList.length > 0) {
      this.resolvedCache.set(cacheKey, null);
    }
    return null;
  }
}
