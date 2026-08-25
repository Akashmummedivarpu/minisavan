const axios = require('axios');
const CryptoJS = require('crypto-js');
const ytSearch = require('yt-search');
const playdl = require('play-dl');

// Initialize SoundCloud Client ID for play-dl
playdl.getFreeClientID().then(client_id => {
    if (client_id) {
        playdl.setToken({ soundcloud: { client_id } });
        console.log("SoundCloud Client ID initialized:", client_id);
    }
}).catch(e => console.error("Failed to init SoundCloud:", e));

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
        console.error("Decryption error:", e);
        return null;
    }
}

class MusicProvider {
    static async search(query) {
        try {
            const url = `https://www.jiosaavn.com/api.php?__call=search.getResults&q=${encodeURIComponent(query)}&_format=json&ctx=web6dot0&api_version=4`;
            const response = await axios.get(url);
            let songs = [];
            if (response.data && response.data.results) {
                songs = response.data.results.map(song => ({
                    id: song.id,
                    title: song.title.replace(/&quot;/g, '"').replace(/&amp;/g, '&'),
                    subtitle: song.subtitle.replace(/&quot;/g, '"').replace(/&amp;/g, '&'),
                    image: song.image ? song.image.replace('150x150', '500x500') : null,
                    artist: song.more_info?.artistMap?.primary_artists?.map(a => a.name).join(', ') || song.subtitle,
                    source: 'saavn'
                }));
            }
            if (songs.length === 0) {
                throw new Error("No results from JioSaavn");
            }
            return songs;
        } catch (error) {
            console.log("JioSaavn search failed, falling back to Gaana...");
            try {
                // 2. Fallback to Gaana API
                const headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json, text/plain, */*',
                    'Origin': 'https://gaana.com',
                    'Referer': 'https://gaana.com/'
                };
                const url = `https://gaana.com/apiv2?country=IN&page=0&secType=track&type=search&keyword=${encodeURIComponent(query)}`;
                const res = await axios.post(url, null, { headers });
                
                const gr = res.data?.gr || [];
                const tracks = gr.find(g => g.ty === 'Track')?.gd || [];
                
                if (tracks && tracks.length > 0) {
                    return tracks.slice(0, 10).map(track => ({
                        id: 'gn_' + track.id,
                        title: track.ti.replace(/&quot;/g, '"').replace(/&amp;/g, '&'),
                        subtitle: track.sti.replace(/&quot;/g, '"').replace(/&amp;/g, '&'),
                        image: track.aw ? track.aw.replace('size_m', 'size_l') : 'https://via.placeholder.com/150',
                        artist: track.sti,
                        source: 'gaana'
                    }));
                }
                throw new Error("No results from Gaana");
            } catch (gaanaError) {
                console.log("Gaana search failed, falling back to SoundCloud...");
                try {
                    const scResults = await playdl.search(query, { source: { soundcloud: 'tracks' }, limit: 10 });
                    if (scResults && scResults.length > 0) {
                        return scResults.map(track => ({
                            id: 'sc_' + track.id,
                            title: track.name,
                            subtitle: track.user?.name || 'SoundCloud Audio',
                            image: track.thumbnail || 'https://via.placeholder.com/150',
                            artist: track.user?.name || 'SoundCloud',
                            source: 'soundcloud',
                            scId: track.url
                        }));
                    }
                    throw new Error("No results from SoundCloud");
                } catch (scError) {
                    console.log("SoundCloud search failed, falling back to YouTube...");
                    const ytResults = await ytSearch(query);
                    return ytResults.videos.slice(0, 10).map(video => ({
                        id: 'yt_' + video.videoId,
                        title: video.title,
                        subtitle: video.author.name,
                        image: video.image,
                        artist: video.author.name,
                        source: 'youtube',
                        youtubeId: video.videoId
                    }));
                }
            }
        }
    }

    static async getSongDetails(id) {
        const url = `https://www.jiosaavn.com/api.php?__call=song.getDetails&pids=${id}&_format=json&ctx=web6dot0&api_version=4`;
        const response = await axios.get(url);
        const data = response.data;

        let songData = data[id] || (data.songs && data.songs[0]);
        if (!songData) return null;

        const encryptedUrl = songData.more_info?.encrypted_media_url;
        const streamUrl = decryptMediaUrl(encryptedUrl);
        
        return {
            id: songData.id,
            title: songData.title.replace(/&quot;/g, '"').replace(/&amp;/g, '&'),
            subtitle: songData.subtitle.replace(/&quot;/g, '"').replace(/&amp;/g, '&'),
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
            console.error("YouTube stream extraction failed", error);
            return null;
        }
    }

    static async getSoundCloudStream(scUrl) {
        try {
            const stream = await playdl.stream(scUrl);
            return stream.url;
        } catch (error) {
            console.error("SoundCloud stream extraction failed", error);
            return null;
        }
    }

    static async getRecommendations(artist, title) {
        const query = `${artist || ''} ${title || ''}`.trim();
        if (!query) return [];

        try {
            // 1. Try JioSaavn
            const saavnUrl = `https://www.jiosaavn.com/api.php?__call=search.getResults&q=${encodeURIComponent(artist || query)}&_format=json&ctx=web6dot0&api_version=4`;
            const saavnRes = await axios.get(saavnUrl);
            if (saavnRes.data && saavnRes.data.results && saavnRes.data.results.length > 0) {
                let songs = saavnRes.data.results.map(song => ({
                    id: song.id,
                    title: song.title.replace(/&quot;/g, '"').replace(/&amp;/g, '&'),
                    subtitle: song.subtitle.replace(/&quot;/g, '"').replace(/&amp;/g, '&'),
                    image: song.image ? song.image.replace('150x150', '500x500') : null,
                    artist: song.more_info?.artistMap?.primary_artists?.map(a => a.name).join(', ') || song.subtitle,
                    source: 'saavn'
                }));
                // Filter out the current song
                songs = songs.filter(s => s.title !== title);
                if (songs.length > 0) return songs;
            }
            throw new Error("No recommendations from JioSaavn");
        } catch (jioError) {
            console.log("JioSaavn recommendations failed, falling back to Gaana...");
            
            try {
                // 2. Fallback to Gaana
                const headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json, text/plain, */*',
                    'Origin': 'https://gaana.com',
                    'Referer': 'https://gaana.com/'
                };
                const gaanaUrl = `https://gaana.com/apiv2?country=IN&page=0&secType=track&type=search&keyword=${encodeURIComponent(artist || query)}`;
                const gaanaRes = await axios.post(gaanaUrl, null, { headers });
                
                const gr = gaanaRes.data?.gr || [];
                const tracks = gr.find(g => g.ty === 'Track')?.gd || [];
                
                if (tracks && tracks.length > 0) {
                    let songs = tracks.slice(0, 15).map(track => ({
                        id: 'gn_' + track.id,
                        title: track.ti.replace(/&quot;/g, '"').replace(/&amp;/g, '&'),
                        subtitle: track.sti.replace(/&quot;/g, '"').replace(/&amp;/g, '&'),
                        image: track.aw ? track.aw.replace('size_m', 'size_l') : 'https://via.placeholder.com/150',
                        artist: track.sti,
                        source: 'gaana'
                    }));
                    songs = songs.filter(s => s.title !== title);
                    if (songs.length > 0) return songs;
                }
                throw new Error("No recommendations from Gaana");
            } catch (gaanaError) {
                console.log("Gaana recommendations failed, falling back to YouTube...");
                
                try {
                    // 3. Fallback to YouTube
                    const ytResults = await ytSearch(query);
                    if (ytResults && ytResults.videos.length > 0) {
                        const topVideo = ytResults.videos[0];
                        const info = await playdl.video_info(topVideo.url);
                        if (info && info.related_videos && info.related_videos.length > 0) {
                            return info.related_videos.slice(0, 15).map(video => ({
                                id: 'yt_' + video.id,
                                title: video.title,
                                subtitle: video.channel?.name || 'YouTube Audio',
                                image: video.thumbnails?.[0]?.url || 'https://via.placeholder.com/150',
                                artist: video.channel?.name || 'YouTube',
                                source: 'youtube',
                                youtubeId: video.id
                            }));
                        }
                    }
                    
                    // 4. Ultimate Fallback: YouTube Mix search
                    const mixResults = await ytSearch(`${query} mix`);
                    return mixResults.videos.slice(0, 15).map(video => ({
                        id: 'yt_' + video.videoId,
                        title: video.title,
                        subtitle: video.author.name,
                        image: video.image,
                        artist: video.author.name,
                        source: 'youtube',
                        youtubeId: video.videoId
                    }));
                } catch (ytError) {
                    console.error("All recommendation fallbacks failed:", ytError);
                    return [];
                }
            }
        }
    }
}

module.exports = MusicProvider;
