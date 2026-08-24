const play = require('play-dl');

async function test() {
    try {
        let searched = await play.search('believer imagine dragons', { limit: 1 });
        const video = searched[0];
        console.log("Found:", video.title, video.url);

        let stream = await play.stream(video.url);
        console.log("Stream URL:", stream.url ? "Found URL" : "No URL", stream.url);
    } catch (e) {
        console.error("Failed:", e);
    }
}
test();
