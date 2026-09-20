const axios = require('axios');
const CryptoJS = require('crypto-js');
const ytSearch = require('yt-search');
const playdl = require('play-dl');
const logger = require('../utils/logger');

// Initialize SoundCloud Client ID for play-dl
playdl.getFreeClientID().then(client_id => {
    if (client_id) {
        playdl.setToken({ soundcloud: { client_id } });
        logger.info({ client_id }, "SoundCloud Client ID initialized");
    }
}).catch(e => logger.error({ err: e }, "Failed to init SoundCloud"));

const HTTP_TIMEOUT_MS = 8000;
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const SEARCH_CACHE_MAX = 200;
const searchCache = new Map(); // normalizedQuery -> { at, results }

// Words that mark derivative versions. Penalized in ranking unless the
// query explicitly asks for them (karaoke spam used to dominate results).
const VERSION_WORDS = [
    'karaoke', 'instrumental', 'cover', 'tribute', 'unplugged',
    '8d', 'slowed', 'reverb', 'lofi', 'remix', 'mashup', 'dj mix',
    'nightcore', 'sped up', 'slowed'
];

function decodeEntities(s) {
    if (!s) return '';
    return String(s)
        .replace(/&quot;/g, '"')
        .replace(/&#0?39;/g, "'")
        .replace(/&rsquo;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&ndash;/g, '-')
        .replace(/&mdash;/g, '-')
        .replace(/&nbsp;/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}

// Split "Artist - Title" / "Title by Artist" style queries into parts.
function parseQuery(raw) {
    const full = decodeEntities(raw).trim().replace(/\s+/g, ' ');
    let titlePart = full;
    let artistPart = '';
    const dash = full.split(/\s+-\s+/);
    if (dash.length === 2 && dash[0] && dash[1]) {
        artistPart = dash[0].trim();
        titlePart = dash[1].trim();
    } else {
        const byMatch = full.match(/^(.*?)\s+by\s+(.+)$/i);
        if (byMatch && byMatch[1] && byMatch[2]) {
            titlePart = byMatch[1].trim();
            artistPart = byMatch[2].trim();
        }
    }
    const tokens = full.toLowerCase().split(/[^a-z0-9\u00C0-\u024F\u1E00-\u1EFF]+/).filter(Boolean);
    return { full, titlePart, artistPart, tokens };
}

const norm = (s) => decodeEntities(s).toLowerCase().replace(/[^a-z0-9\u00C0-\u024F\u1E00-\u1EFF]+/g, '');

// Base title: parenthetical/bracket suffixes removed BEFORE normalizing
// (norm strips punctuation, so strip the segments first). Lets catalog
// variants ("X (From ...)", "X (Lofi Flip)") match the same song.
const baseTitle = (s) => norm(decodeEntities(s || '').replace(/[\(\[].*?[\)\]]/g, ''));

// Dedup key: base title + first artist token, so catalog variants
// ("X", "X (From ...)", "X (Lofi Flip)") collapse to the best-ranked entry.
const dedupKey = (title, artist) => {
    const t = baseTitle(title);
    const a = norm((artist || '').split(',')[0]).slice(0, 24);
    return `${t}|${a}`;
};

function scoreCandidate(item, q) {
    const titleN = norm(item.title);
    const artistN = norm(item.artist || item.subtitle || '');
    const fullN = norm(q.full);
    let score = 0;

    // --- text match (dominant signal) ---
    if (titleN && titleN === fullN) score += 12;
    else if (titleN && fullN && titleN.startsWith(fullN)) score += 8;
    else if (titleN && fullN && titleN.includes(fullN)) score += 6;
    if (q.tokens.length > 0 && titleN) {
        const hits = q.tokens.filter(t => t.length > 1 && titleN.includes(t)).length;
        score += (hits / q.tokens.length) * 5;
    }
    if (q.artistPart) {
        const ap = norm(q.artistPart);
        if (ap && artistN.includes(ap)) score += 6;
    } else if (q.tokens.length > 1 && artistN) {
        const hits = q.tokens.filter(t => t.length > 2 && artistN.includes(t)).length;
        if (hits > 0) score += 3;
    }

    // --- popularity proxy (log-scaled so mega-hits don't drown everything) ---
    const plays = Number(item.popularity) || 0;
    if (plays > 0) score += Math.min(3, Math.log10(1 + plays));

    // --- source reliability weight ---
    score += { saavn: 3, gaana: 2, soundcloud: 1.5, youtube: 1 }[item.source] || 0;

    // --- derivative-version penalty (unless explicitly requested) ---
    const queryLow = q.full.toLowerCase();
    const blob = `${item.title} ${item.subtitle || ''}`.toLowerCase();
    let penalty = 0;
    for (const w of VERSION_WORDS) {
        if (blob.includes(w) && !queryLow.includes(w)) penalty += 4;
    }
    score -= Math.min(8, penalty);

    return score;
}

// YouTube video titles pack cast lists, tags and quality markers after pipes
// ("Song - Movie | Actor, Actress | 4K"). Keep the head segment so lists stay
// readable; only when it leaves something substantive behind.
function cleanVideoTitle(raw) {
    const title = decodeEntities(raw);
    const head = title.split(' | ')[0].trim();
    return head.length >= 4 ? head : title;
}

function decryptMediaUrl(encryptedUrl) {
    if (!encryptedUrl) return null;
    try {
        const key = CryptoJS.enc.Utf8.parse('38346591');
        const decrypted = CryptoJS.DES.decrypt(
            { ciphertext: CryptoJS.enc.Base64.parse(encryptedUrl) },
            key,
            { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 }
        );
        let decryptedStr = decrypted.toString(CryptoJS.enc.Utf8);
        return decryptedStr.replace(/_96\.mp4|_160\.mp4/g, '_320.mp4').replace(/_96\.m4a|_160\.m4a/g, '_320.m4a');
    } catch (e) {
        logger.error({ err: e }, "Decryption error");
        return null;
    }
}

// ---------- per-source fetchers (each never throws; returns [] on failure) ----------

async function fetchSaavn(query) {
    try {
        const url = `https://www.jiosaavn.com/api.php?__call=search.getResults&q=${encodeURIComponent(query)}&_format=json&ctx=web6dot0&api_version=4`;
        const response = await axios.get(url, { timeout: HTTP_TIMEOUT_MS });
        const results = response.data?.results || [];
        return results.map(song => ({
            id: song.id,
            title: decodeEntities(song.title),
            subtitle: decodeEntities(song.subtitle),
            image: song.image ? song.image.replace('150x150', '500x500') : null,
            artist: song.more_info?.artistMap?.primary_artists?.map(a => a.name).join(', ') || decodeEntities(song.subtitle),
            popularity: parseInt(song.play_count || song.more_info?.play_count || '0', 10) || 0,
            source: 'saavn'
        }));
    } catch (e) {
        logger.warn({ err: e.message }, 'Saavn search failed');
        return [];
    }
}

async function fetchGaana(query) {
    try {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Origin': 'https://gaana.com',
            'Referer': 'https://gaana.com/'
        };
        const url = `https://gaana.com/apiv2?country=IN&page=0&secType=track&type=search&keyword=${encodeURIComponent(query)}`;
        const res = await axios.post(url, null, { headers, timeout: HTTP_TIMEOUT_MS });
        const gr = res.data?.gr || [];
        const tracks = gr.find(g => g.ty === 'Track')?.gd || [];
        return (tracks || []).slice(0, 15).map(track => ({
            id: 'gn_' + track.id,
            title: decodeEntities(track.ti),
            subtitle: decodeEntities(track.sti),
            image: track.aw ? track.aw.replace('size_m', 'size_l') : 'https://via.placeholder.com/150',
            artist: decodeEntities(track.sti),
            popularity: parseInt(track.play_count || '0', 10) || 0,
            source: 'gaana'
        }));
    } catch (e) {
        logger.warn({ err: e.message }, 'Gaana search failed');
        return [];
    }
}

async function fetchSoundCloud(query) {
    try {
        const scResults = await Promise.race([
            playdl.search(query, { source: { soundcloud: 'tracks' }, limit: 10 }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('sc timeout')), HTTP_TIMEOUT_MS))
        ]);
        if (!scResults || scResults.length === 0) return [];
        return scResults.map(track => ({
            id: 'sc_' + track.id,
            title: decodeEntities(track.name),
            subtitle: decodeEntities(track.user?.name || 'SoundCloud Audio'),
            image: track.thumbnail || 'https://via.placeholder.com/150',
            artist: decodeEntities(track.user?.name || 'SoundCloud'),
            popularity: Number(track.streams || track.likes || 0) || 0,
            source: 'soundcloud',
            scId: track.url
        }));
    } catch (e) {
        logger.warn({ err: e.message }, 'SoundCloud search failed');
        return [];
    }
}

async function fetchYouTube(query) {
    try {
        const ytResults = await Promise.race([
            ytSearch(query),
            new Promise((_, reject) => setTimeout(() => reject(new Error('yt timeout')), HTTP_TIMEOUT_MS))
        ]);
        const videos = (ytResults?.videos || []).slice(0, 10);
        return videos.map(video => ({
            id: 'yt_' + video.videoId,
            title: cleanVideoTitle(video.title),
            subtitle: decodeEntities(video.author?.name),
            image: video.image,
            artist: decodeEntities(video.author?.name),
            popularity: Number(video.views) || 0,
            source: 'youtube',
            youtubeId: video.videoId
        }));
    } catch (e) {
        logger.warn({ err: e.message }, 'YouTube search failed');
        return [];
    }
}

class MusicProvider {
    // Federated search: query all sources in parallel, then rank + dedup.
    // Fixes the old waterfall (one flaky provider decided everything) and
    // the karaoke-cover spam (version penalty in scoring).
    static async search(rawQuery, opts = {}) {
        const q = parseQuery(rawQuery || '');
        if (!q.full) return [];
        const limit = opts.limit || 20;
        const excluded = new Set((opts.excludeSources || []).map(s => String(s).toLowerCase()));

        const cacheKey = q.full.toLowerCase() + (excluded.size ? `|no:${[...excluded].sort().join(',')}` : '');
        const cached = searchCache.get(cacheKey);
        if (cached && Date.now() - cached.at < SEARCH_CACHE_TTL_MS) {
            return cached.results.slice(0, limit);
        }

        const jobs = [];
        if (!excluded.has('saavn')) jobs.push(fetchSaavn(q.full));
        else jobs.push(Promise.resolve([]));
        if (!excluded.has('gaana')) jobs.push(fetchGaana(q.full));
        else jobs.push(Promise.resolve([]));
        if (!excluded.has('soundcloud')) jobs.push(fetchSoundCloud(q.full));
        else jobs.push(Promise.resolve([]));
        if (!excluded.has('youtube')) jobs.push(fetchYouTube(q.full));
        else jobs.push(Promise.resolve([]));
        const [saavn, gaana, sc, yt] = await Promise.all(jobs);

        const scored = [...saavn, ...gaana, ...sc, ...yt].map(item => ({
            ...item,
            _score: scoreCandidate(item, q)
        }));

        // Dedup by normalized title+artist, keeping the best-ranked source
        const best = new Map();
        for (const item of scored) {
            const key = dedupKey(item.title, item.artist || item.subtitle);
            if (!key || key === '|') continue;
            const prev = best.get(key);
            if (!prev || item._score > prev._score) best.set(key, item);
        }

        const ranked = [...best.values()]
            .sort((a, b) => b._score - a._score)
            .slice(0, limit)
            .map(({ _score, popularity, ...rest }) => rest);

        searchCache.set(cacheKey, { at: Date.now(), results: ranked });
        if (searchCache.size > SEARCH_CACHE_MAX) {
            const oldest = searchCache.keys().next().value;
            searchCache.delete(oldest);
        }
        return ranked;
    }

    static async getSongDetails(id) {
        const url = `https://www.jiosaavn.com/api.php?__call=song.getDetails&pids=${id}&_format=json&ctx=web6dot0&api_version=4`;
        const response = await axios.get(url, { timeout: HTTP_TIMEOUT_MS });
        const data = response.data;

        let songData = data[id] || (data.songs && data.songs[0]);
        if (!songData) return null;

        const encryptedUrl = songData.more_info?.encrypted_media_url;
        const streamUrl = decryptMediaUrl(encryptedUrl);

        return {
            id: songData.id,
            title: decodeEntities(songData.title),
            subtitle: decodeEntities(songData.subtitle),
            image: songData.image ? songData.image.replace('150x150', '500x500') : null,
            artist: songData.more_info?.artistMap?.primary_artists?.map(a => a.name).join(', ') || '',
            streamUrl,
            source: 'saavn'
        };
    }

    static async getYoutubeStream(youtubeId) {
        try {
            const stream = await playdl.stream(youtubeId);
            return stream.url;
        } catch (error) {
            logger.error({ err: error, youtubeId }, "YouTube stream extraction failed");
            return null;
        }
    }

    static async getSoundCloudStream(scUrl) {
        try {
            const stream = await playdl.stream(scUrl);
            return stream.url;
        } catch (error) {
            logger.error({ err: error, scUrl }, "SoundCloud stream extraction failed");
            return null;
        }
    }

    // Hybrid recommendations in the spirit of production systems:
    // candidate generation from several signals (seed artist, the user's
    // taste profile from likes+history, co-watch data via YouTube related),
    // then ranking by affinity + popularity with diversity caps and
    // exclusions, plus a human-readable reason per item.
    // tasteFetcher: async () => ({ liked: Song[], history: Song[] }) — injected
    // so this module stays decoupled from the User model.
    static async getRecommendations(artist, title, opts = {}) {
        const seedArtist = decodeEntities(artist || '').trim();
        const seedTitle = decodeEntities(title || '').trim();
        const limit = opts.limit || 15;

        // --- taste profile ---
        const affinity = new Map(); // artistKey -> weight
        const seenIds = new Set();
        const heardTitles = new Set();
        let likedTitles = [];
        try {
            if (opts.tasteFetcher) {
                const taste = await opts.tasteFetcher();
                for (const s of taste.liked || []) {
                    const key = norm((s.artist || '').split(',')[0]);
                    if (key) affinity.set(key, (affinity.get(key) || 0) + 3);
                    if (s.songId) seenIds.add(s.songId);
                    if (s.title) { likedTitles.push(s.title); heardTitles.add(norm(s.title)); heardTitles.add(baseTitle(s.title)); }
                }
                const hist = (taste.history || []).slice(-30);
                hist.forEach((s, i) => {
                    const key = norm((s.artist || '').split(',')[0]);
                    // recency-weighted: recent plays count more
                    if (key) affinity.set(key, (affinity.get(key) || 0) + 0.5 + (i / hist.length));
                    if (s.songId) seenIds.add(s.songId);
                    if (s.title) { heardTitles.add(norm(s.title)); heardTitles.add(baseTitle(s.title)); }
                });
            }
        } catch (e) {
            logger.warn({ err: e.message }, 'Taste profile failed, continuing without personalization');
        }
        if (seedArtist) {
            const key = norm(seedArtist.split(',')[0]);
            if (key) affinity.set(key, (affinity.get(key) || 0) + 2);
        }

        const topArtists = [...affinity.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name]) => name);

        // --- candidate generation (parallel, best-effort) ---
        const candidateJobs = [];
        const artistQueries = [...new Set([seedArtist, ...topArtists.map(a => a)])]
            .filter(Boolean)
            .slice(0, 4);
        for (const aq of artistQueries) {
            candidateJobs.push(
                fetchSaavn(aq).then(items => ({ items, reasonKind: 'artist', reasonArtist: aq }))
            );
        }
        // Co-watch signal: YouTube related videos for "artist title"
        const seedQuery = `${seedArtist} ${seedTitle}`.trim();
        if (seedQuery) {
            candidateJobs.push((async () => {
                try {
                    const ytResults = await Promise.race([
                        ytSearch(seedQuery),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('yt timeout')), HTTP_TIMEOUT_MS))
                    ]);
                    const topVideo = ytResults?.videos?.[0];
                    if (!topVideo) return { items: [], reasonKind: 'cowatch' };
                    const info = await Promise.race([
                        playdl.video_info(topVideo.url),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('info timeout')), HTTP_TIMEOUT_MS))
                    ]);
                    const related = (info?.related_videos || []).slice(0, 10).map(video => ({
                        id: 'yt_' + video.id,
                        title: cleanVideoTitle(video.title),
                        subtitle: decodeEntities(video.channel?.name || 'YouTube Audio'),
                        image: video.thumbnails?.[0]?.url || 'https://via.placeholder.com/150',
                        artist: decodeEntities(video.channel?.name || 'YouTube'),
                        popularity: Number(video.views) || 0,
                        source: 'youtube',
                        youtubeId: video.id
                    }));
                    return { items: related, reasonKind: 'cowatch' };
                } catch (e) {
                    return { items: [], reasonKind: 'cowatch' };
                }
            })());
        }
        const settled = await Promise.all(candidateJobs);

        // --- ranking ---
        const seedTitleN = norm(seedTitle);
        const perArtist = new Map();
        const seenKeys = new Set();
        const ranked = [];
        const pool = [];
        for (const group of settled) {
            for (const item of group.items) {
                pool.push({ item, reasonKind: group.reasonKind, reasonArtist: group.reasonArtist });
            }
        }
        // Score pool
        const scoredPool = pool.map(({ item, reasonKind, reasonArtist }) => {
            const aKey = norm((item.artist || '').split(',')[0]);
            let score = (affinity.get(aKey) || 0) * 2;
            const plays = Number(item.popularity) || 0;
            if (plays > 0) score += Math.min(3, Math.log10(1 + plays));
            score += { saavn: 2, gaana: 1, soundcloud: 0.75, youtube: 1.5 }[item.source] || 0;
            return { item, reasonKind, reasonArtist, aKey, score };
        }).sort((a, b) => b.score - a.score);

        for (const cand of scoredPool) {
            if (ranked.length >= limit) break;
            const { item, reasonKind, reasonArtist, aKey } = cand;
            if (!item.title) continue;
            // exclusions: the seed itself, already-heard tracks (by id, title, or
            // base title — different catalog entries of a heard song shouldn't
            // repeat either)
            if (seedTitleN && norm(item.title) === seedTitleN) continue;
            const sid = item.songId || item.id;
            if (sid && seenIds.has(sid)) continue;
            if (heardTitles.has(norm(item.title)) || heardTitles.has(baseTitle(item.title))) continue;
            // dedup: same normalized title+artist from another candidate source
            const dkey = dedupKey(item.title, item.artist || item.subtitle);
            if (dkey && dkey !== '|' && seenKeys.has(dkey)) continue;
            // diversity: max 3 per artist
            const count = perArtist.get(aKey || '?') || 0;
            if (count >= 3) continue;
            perArtist.set(aKey || '?', count + 1);
            if (dkey && dkey !== '|') seenKeys.add(dkey);

            let reason;
            if (reasonKind === 'cowatch') {
                reason = 'Listeners also played';
            } else if (reasonArtist && aKey && affinity.has(aKey)) {
                const display = item.artist?.split(',')[0] || reasonArtist;
                reason = likedTitles.length > 0 ? `Because you listen to ${display}` : `More from ${display}`;
            } else {
                reason = item.artist ? `More from ${item.artist.split(',')[0]}` : 'Trending now';
            }
            const { popularity, ...rest } = item;
            ranked.push({ ...rest, reason });
        }

        // Fallback: trending search when everything else came up empty
        if (ranked.length === 0) {
            try {
                const trending = await fetchSaavn('trending hindi 2024');
                return trending.slice(0, limit).map(({ popularity, ...rest }) => ({ ...rest, reason: 'Trending now' }));
            } catch (e) {
                return [];
            }
        }
        return ranked;
    }
}

module.exports = MusicProvider;
