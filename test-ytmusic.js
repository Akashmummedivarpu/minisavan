const ytMusic = require('node-youtube-music');

async function testYtMusic() {
    try {
        console.log("Searching for song...");
        const songs = await ytMusic.searchMusics("Kesariya Arijit Singh");
        if (songs.length > 0) {
            const videoId = songs[0].youtubeId;
            console.log("Found:", songs[0].title, "-", videoId);
            
            console.log("Getting recommendations...");
            const suggestions = await ytMusic.getSuggestions(videoId);
            console.log(`Found ${suggestions.length} suggestions.`);
            suggestions.slice(0, 5).forEach(s => {
                console.log(`- ${s.title} by ${s.artists ? s.artists.map(a=>a.name).join(', ') : 'Unknown'}`);
            });
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
}
testYtMusic();
