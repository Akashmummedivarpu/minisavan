const ytdl = require('@distube/ytdl-core');
const ytSearch = require('yt-search');

async function test() {
    try {
        const searchResults = await ytSearch('believer imagine dragons');
        const firstVideo = searchResults.videos[0];
        console.log("Search Result:", firstVideo.title, firstVideo.videoId);

        const info = await ytdl.getInfo(firstVideo.videoId);
        const format = ytdl.chooseFormat(info.formats, { filter: 'audioonly' });
        console.log("Audio Format URL:", format.url ? "Found URL" : "No URL");
    } catch (e) {
        console.error("Failed:", e);
    }
}
test();
