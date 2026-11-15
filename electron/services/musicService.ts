import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { MusicCatalogState, MusicTrackInfo } from '../../src/types/bot';

const KNOWN_TRACKS: Record<string, { title: string; author: string }> = {
  // C418 Overworld & Legacy Names
  calm1: { title: 'Minecraft', author: 'C418' },
  calm2: { title: 'Clark', author: 'C418' },
  calm3: { title: 'Sweden', author: 'C418' },
  minecraft: { title: 'Minecraft', author: 'C418' },
  clark: { title: 'Clark', author: 'C418' },
  sweden: { title: 'Sweden', author: 'C418' },

  hal1: { title: 'Subwoofer Lullaby', author: 'C418' },
  hal2: { title: 'Living Mice', author: 'C418' },
  hal3: { title: 'Haggstrom', author: 'C418' },
  hal4: { title: 'Danny', author: 'C418' },
  subwoofer_lullaby: { title: 'Subwoofer Lullaby', author: 'C418' },
  living_mice: { title: 'Living Mice', author: 'C418' },
  haggstrom: { title: 'Haggstrom', author: 'C418' },
  danny: { title: 'Danny', author: 'C418' },

  nuance1: { title: 'Key', author: 'C418' },
  nuance2: { title: 'Oxygène', author: 'C418' },
  key: { title: 'Key', author: 'C418' },
  oxygene: { title: 'Oxygène', author: 'C418' },

  piano1: { title: 'Dry Hands', author: 'C418' },
  piano2: { title: 'Wet Hands', author: 'C418' },
  piano3: { title: 'Mice on Venus', author: 'C418' },
  dry_hands: { title: 'Dry Hands', author: 'C418' },
  wet_hands: { title: 'Wet Hands', author: 'C418' },
  mice_on_venus: { title: 'Mice on Venus', author: 'C418' },

  // C418 Creative
  creative1: { title: 'Biome Fest', author: 'C418' },
  creative2: { title: 'Blind Spots', author: 'C418' },
  creative3: { title: 'Haunt Muskie', author: 'C418' },
  creative4: { title: 'Aria Math', author: 'C418' },
  creative5: { title: 'Dreiton', author: 'C418' },
  creative6: { title: 'Taswell', author: 'C418' },
  biome_fest: { title: 'Biome Fest', author: 'C418' },
  blind_spots: { title: 'Blind Spots', author: 'C418' },
  haunt_muskie: { title: 'Haunt Muskie', author: 'C418' },
  aria_math: { title: 'Aria Math', author: 'C418' },
  dreiton: { title: 'Dreiton', author: 'C418' },
  taswell: { title: 'Taswell', author: 'C418' },

  // C418 Menu
  menu1: { title: 'Mutation', author: 'C418' },
  menu2: { title: 'Moog City 2', author: 'C418' },
  menu3: { title: 'Beginning 2', author: 'C418' },
  menu4: { title: 'Floating Trees', author: 'C418' },
  mutation: { title: 'Mutation', author: 'C418' },
  moog_city_2: { title: 'Moog City 2', author: 'C418' },
  beginning_2: { title: 'Beginning 2', author: 'C418' },
  floating_trees: { title: 'Floating Trees', author: 'C418' },

  // C418 Nether
  nether1: { title: 'Concrete Halls', author: 'C418' },
  nether2: { title: 'Dead Voxel', author: 'C418' },
  nether3: { title: 'Warmth', author: 'C418' },
  nether4: { title: 'Ballad of the Cats', author: 'C418' },
  concrete_halls: { title: 'Concrete Halls', author: 'C418' },
  dead_voxel: { title: 'Dead Voxel', author: 'C418' },
  warmth: { title: 'Warmth', author: 'C418' },
  ballad_of_the_cats: { title: 'Ballad of the Cats', author: 'C418' },

  // C418 End & Boss & Credits
  end: { title: 'The End', author: 'C418' },
  the_end: { title: 'The End', author: 'C418' },
  boss: { title: 'Boss', author: 'C418' },
  credits: { title: 'Alpha', author: 'C418' },
  alpha: { title: 'Alpha', author: 'C418' },

  // C418 Water
  axolotl: { title: 'Axolotl', author: 'C418' },
  dragon_fish: { title: 'Dragon Fish', author: 'C418' },
  shuniji: { title: 'Shuniji', author: 'C418' },

  // Lena Raine
  rubedo: { title: 'Rubedo', author: 'Lena Raine' },
  chrysopoeia: { title: 'Chrysopoeia', author: 'Lena Raine' },
  so_below: { title: 'So Below', author: 'Lena Raine' },
  pigstep: { title: 'Pigstep', author: 'Lena Raine' },
  otherside: { title: 'Otherside', author: 'Lena Raine' },
  infinite_amethyst: { title: 'Infinite Amethyst', author: 'Lena Raine' },
  left_to_bloom: { title: 'Left to Bloom', author: 'Lena Raine' },
  one_more_day: { title: 'One More Day', author: 'Lena Raine' },
  stand_tall: { title: 'Stand Tall', author: 'Lena Raine' },
  wending: { title: 'Wending', author: 'Lena Raine' },
  ancestry: { title: 'Ancestry', author: 'Lena Raine' },
  firebugs: { title: 'Firebugs', author: 'Lena Raine' },
  labyrinthine: { title: 'Labyrinthine', author: 'Lena Raine' },
  aerie: { title: 'Aerie', author: 'Lena Raine' },
  creator: { title: 'Creator', author: 'Lena Raine' },
  creator_music_box: { title: 'Creator (Music Box)', author: 'Lena Raine' },

  // Kumi Tanioka
  floating_dream: { title: 'Floating Dream', author: 'Kumi Tanioka' },
  comforting_memories: { title: 'Comforting Memories', author: 'Kumi Tanioka' },
  an_ordinary_day: { title: 'An Ordinary Day', author: 'Kumi Tanioka' },
  komorebi: { title: 'Komorebi', author: 'Kumi Tanioka' },
  pokopoko: { title: 'Pokopoko', author: 'Kumi Tanioka' },
  yakusoku: { title: 'Yakusoku', author: 'Kumi Tanioka' },

  // Aaron Cherof
  a_familiar_room: { title: 'A Familiar Room', author: 'Aaron Cherof' },
  bromeliad: { title: 'Bromeliad', author: 'Aaron Cherof' },
  crescent_dunes: { title: 'Crescent Dunes', author: 'Aaron Cherof' },
  echo_in_the_wind: { title: 'Echo in the Wind', author: 'Aaron Cherof' },
  relic: { title: 'Relic', author: 'Aaron Cherof' },
  featherfall: { title: 'Featherfall', author: 'Aaron Cherof' },
  deeper: { title: 'Deeper', author: 'Aaron Cherof' },
  eld_unknown: { title: 'Eld Unknown', author: 'Aaron Cherof' },
  endless: { title: 'Endless', author: 'Aaron Cherof' },
  watcher: { title: 'Watcher', author: 'Aaron Cherof' },
  precipice: { title: 'Precipice', author: 'Aaron Cherof' },

  // Samuel Åberg
  '5': { title: '5', author: 'Samuel Åberg' },

  // Discs by C418
  '11': { title: '11', author: 'C418' },
  '13': { title: '13', author: 'C418' },
  blocks: { title: 'Blocks', author: 'C418' },
  cat: { title: 'Cat', author: 'C418' },
  chirp: { title: 'Chirp', author: 'C418' },
  far: { title: 'Far', author: 'C418' },
  mall: { title: 'Mall', author: 'C418' },
  mellohi: { title: 'Mellohi', author: 'C418' },
  stal: { title: 'Stal', author: 'C418' },
  strad: { title: 'Strad', author: 'C418' },
  wait: { title: 'Wait', author: 'C418' },
  ward: { title: 'Ward', author: 'C418' },
};

function toTitleCase(name: string): string {
  return name
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function parseCategory(key: string): string {
  if (key.startsWith('minecraft/sounds/records/')) {
    return 'Records';
  }
  const lower = key.toLowerCase();
  if (lower.includes('/menu/')) return 'Menu';
  if (lower.includes('/credits') || lower.endsWith('credits.ogg') || lower.endsWith('alpha.ogg')) return 'Credits';
  if (lower.includes('/nether/')) return 'Nether';
  if (lower.includes('/end/') || lower.endsWith('/the_end.ogg') || lower.endsWith('/boss.ogg') || lower.endsWith('/end.ogg')) return 'The End';
  if (lower.includes('/creative/')) return 'Creative';
  if (lower.includes('/water/') || lower.includes('/underwater/')) return 'Underwater';
  if (lower.includes('/swamp/')) return 'Swamp';
  if (lower.includes('/game/')) return 'Overworld';
  return 'Music';
}

export function parseTrackMetadata(objectKey: string): { id: string; title: string; author: string; category: string } {
  const sanitizedId = objectKey
    .replace(/^minecraft\/sounds\//, '')
    .replace(/\.ogg$/, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_');

  const basename = path.posix.basename(objectKey, '.ogg').toLowerCase();
  const known = KNOWN_TRACKS[basename];

  const title = known?.title ?? toTitleCase(basename);
  const author = known?.author ?? 'Minecraft';
  const category = parseCategory(objectKey);

  return {
    id: sanitizedId,
    title,
    author,
    category,
  };
}

export class MusicService {
  private tracks: MusicTrackInfo[] = [];
  private catalogPromise: Promise<void> | null = null;
  private inFlightTracks = new Map<string, Promise<boolean>>();
  private downloading = false;
  private lastError?: string;
  private lastNotificationTime = 0;
  private notifyTimeout: NodeJS.Timeout | null = null;

  constructor(
    private readonly musicDir: string,
    private readonly onUpdate?: () => void,
  ) {}

  public parseTrackMetadata(objectKey: string) {
    return parseTrackMetadata(objectKey);
  }

  public getState(): MusicCatalogState {
    const downloadedCount = this.tracks.filter(t => t.downloaded).length;
    return {
      tracks: this.tracks.map(t => ({ ...t })),
      downloadedCount,
      totalCount: this.tracks.length,
      downloading: this.downloading,
      error: this.lastError,
    };
  }

  private triggerUpdate(immediate = false): void {
    if (!this.onUpdate) return;
    const now = Date.now();

    if (immediate) {
      if (this.notifyTimeout) {
        clearTimeout(this.notifyTimeout);
        this.notifyTimeout = null;
      }
      this.lastNotificationTime = now;
      this.onUpdate();
      return;
    }

    const elapsed = now - this.lastNotificationTime;
    if (elapsed >= 400) {
      if (this.notifyTimeout) {
        clearTimeout(this.notifyTimeout);
        this.notifyTimeout = null;
      }
      this.lastNotificationTime = now;
      this.onUpdate();
    } else if (!this.notifyTimeout) {
      this.notifyTimeout = setTimeout(() => {
        this.notifyTimeout = null;
        this.lastNotificationTime = Date.now();
        this.onUpdate?.();
      }, 400 - elapsed);
    }
  }

  private async refreshDownloadedStatus(): Promise<void> {
    await Promise.all(
      this.tracks.map(async (track) => {
        const filePath = path.join(this.musicDir, `${track.id}.ogg`);
        try {
          const st = await fs.stat(filePath);
          track.downloaded = st.size > 1024;
        } catch {
          track.downloaded = false;
        }
      }),
    );
  }

  public async ensureCatalog(): Promise<void> {
    if (this.catalogPromise) {
      return this.catalogPromise;
    }

    this.catalogPromise = this.doEnsureCatalog().finally(() => {
      // If we failed and have no tracks, allow subsequent attempts to re-try
      if (this.tracks.length === 0) {
        this.catalogPromise = null;
      }
    });

    return this.catalogPromise;
  }

  private async doEnsureCatalog(): Promise<void> {
    await fs.mkdir(this.musicDir, { recursive: true });
    const catalogPath = path.join(this.musicDir, 'catalog.json');

    // 1. Check local catalog.json
    try {
      const content = await fs.readFile(catalogPath, 'utf8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 10) {
        this.tracks = parsed;
        await this.refreshDownloadedStatus();
        this.lastError = undefined;
        this.triggerUpdate(true);
        return;
      }
    } catch {
      // catalog.json does not exist or is invalid, proceed to fetch
    }

    // 2. Fetch official catalog from Mojang CDN
    try {
      const manifestRes = await fetch('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json', {
        signal: AbortSignal.timeout(15000),
      });
      if (!manifestRes.ok) {
        throw new Error(`Failed to fetch version manifest: HTTP ${manifestRes.status}`);
      }
      const manifest = (await manifestRes.json()) as {
        latest?: { release?: string };
        versions?: Array<{ id: string; url: string }>;
      };

      const latestRelease = manifest.latest?.release;
      const verObj = manifest.versions?.find(v => v.id === latestRelease);
      if (!verObj?.url) {
        throw new Error(`Could not find version URL for latest release: ${latestRelease}`);
      }

      const verRes = await fetch(verObj.url, { signal: AbortSignal.timeout(15000) });
      if (!verRes.ok) {
        throw new Error(`Failed to fetch version data: HTTP ${verRes.status}`);
      }
      const verData = (await verRes.json()) as { assetIndex?: { url?: string } };
      if (!verData.assetIndex?.url) {
        throw new Error('Version data does not contain assetIndex URL');
      }

      const assetRes = await fetch(verData.assetIndex.url, { signal: AbortSignal.timeout(20000) });
      if (!assetRes.ok) {
        throw new Error(`Failed to fetch asset index: HTTP ${assetRes.status}`);
      }
      const assetData = (await assetRes.json()) as {
        objects?: Record<string, { hash: string; size: number }>;
      };

      const objects = assetData.objects || {};
      const seenHashes = new Set<string>();
      const tracks: MusicTrackInfo[] = [];

      for (const [key, obj] of Object.entries(objects)) {
        if (
          (!key.startsWith('minecraft/sounds/music/') && !key.startsWith('minecraft/sounds/records/')) ||
          !key.endsWith('.ogg')
        ) {
          continue;
        }
        if (seenHashes.has(obj.hash)) {
          continue;
        }
        seenHashes.add(obj.hash);

        const meta = this.parseTrackMetadata(key);
        tracks.push({
          id: meta.id,
          key,
          title: meta.title,
          author: meta.author,
          category: meta.category,
          hash: obj.hash,
          size: obj.size,
          downloaded: false,
        });
      }

      if (tracks.length === 0) {
        throw new Error('No music tracks found in Mojang asset index');
      }

      this.tracks = tracks;
      await this.refreshDownloadedStatus();

      // Atomically write catalog.json
      const tmpPath = path.join(this.musicDir, `catalog.${Date.now()}.tmp`);
      await fs.writeFile(tmpPath, JSON.stringify(this.tracks, null, 2), 'utf8');
      await fs.rename(tmpPath, catalogPath);

      this.lastError = undefined;
      this.triggerUpdate(true);
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      console.error('[MusicService] Failed to load catalog from Mojang CDN:', this.lastError);
      this.triggerUpdate(true);
    }
  }

  public async downloadSingleTrack(trackOrId: MusicTrackInfo | string): Promise<boolean> {
    const track = typeof trackOrId === 'string'
      ? this.tracks.find(t => t.id === trackOrId)
      : trackOrId;

    if (!track) return false;

    const filePath = path.join(this.musicDir, `${track.id}.ogg`);

    // If already downloaded and valid size on disk, return immediately
    if (track.downloaded) {
      try {
        const st = await fs.stat(filePath);
        if (st.size > 1024) return true;
      } catch {
        track.downloaded = false;
      }
    }

    const inFlight = this.inFlightTracks.get(track.id);
    if (inFlight) {
      return inFlight;
    }

    const promise = (async (): Promise<boolean> => {
      const tmpPath = path.join(this.musicDir, `${track.id}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}.tmp`);
      try {
        await fs.mkdir(this.musicDir, { recursive: true });
        const url = `https://resources.download.minecraft.net/${track.hash.slice(0, 2)}/${track.hash}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const arrayBuf = await res.arrayBuffer();
        const buf = Buffer.from(arrayBuf);
        if (buf.length <= 1024) {
          throw new Error(`File too small: ${buf.length} bytes`);
        }

        await fs.writeFile(tmpPath, buf);
        const st = await fs.stat(tmpPath);
        if (st.size <= 1024) {
          throw new Error(`Written file too small: ${st.size} bytes`);
        }

        await fs.rename(tmpPath, filePath);
        track.downloaded = true;
        return true;
      } catch (err) {
        console.error(`[MusicService] Failed downloading track ${track.id}:`, err);
        try {
          await fs.unlink(tmpPath).catch(() => {});
        } catch {}
        return false;
      } finally {
        this.inFlightTracks.delete(track.id);
      }
    })();

    this.inFlightTracks.set(track.id, promise);
    const result = await promise;
    return result;
  }

  public async startBackgroundDownload(priorityTrackId?: string): Promise<MusicCatalogState> {
    await this.ensureCatalog();

    if (priorityTrackId) {
      const priorityTrack = this.tracks.find(t => t.id === priorityTrackId);
      if (priorityTrack && !priorityTrack.downloaded) {
        await this.downloadSingleTrack(priorityTrack);
        this.triggerUpdate(true);
      }
    }

    this.runBackgroundWorkerPool();
    return this.getState();
  }

  private runBackgroundWorkerPool(): void {
    if (this.downloading) {
      return;
    }

    const undownloaded = this.tracks.filter(t => !t.downloaded);
    if (undownloaded.length === 0) {
      this.downloading = false;
      return;
    }

    this.downloading = true;
    this.triggerUpdate(false);

    // Shuffle undownloaded tracks
    const queue = [...undownloaded].sort(() => Math.random() - 0.5);
    let queueIndex = 0;
    const concurrency = 3;

    const worker = async () => {
      while (queueIndex < queue.length) {
        const track = queue[queueIndex++];
        if (!track) break;
        if (!track.downloaded) {
          await this.downloadSingleTrack(track);
          const downloadedCount = this.tracks.filter(t => t.downloaded).length;
          if (downloadedCount === this.tracks.length) {
            this.triggerUpdate(true);
          } else {
            this.triggerUpdate(false);
          }
        }
      }
    };

    const pool = Array.from({ length: Math.min(concurrency, queue.length) }, () => worker());

    void Promise.all(pool)
      .catch((err) => {
        console.error('[MusicService] Background download pool error:', err);
      })
      .finally(() => {
        this.downloading = false;
        this.triggerUpdate(true);
      });
  }

  public async getTrackBytes(trackId: string): Promise<Uint8Array | null> {
    await this.ensureCatalog();
    const track = this.tracks.find(t => t.id === trackId);
    if (!track) {
      return null;
    }

    const filePath = path.join(this.musicDir, `${track.id}.ogg`);
    if (!track.downloaded) {
      const success = await this.downloadSingleTrack(track);
      if (!success) {
        return null;
      }
    }

    try {
      const buf = await fs.readFile(filePath);
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    } catch (err) {
      console.error(`[MusicService] Failed reading audio bytes for track ${trackId}:`, err);
      return null;
    }
  }
}
