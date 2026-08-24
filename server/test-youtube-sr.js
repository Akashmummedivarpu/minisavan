const YouTube = require('youtube-sr').default;

async function testYouTubeSR() {
    try {
        const videoId = '2Vv-BfVoq4g'; // Ed Sheeran Perfect
        const video = await YouTube.getVideo(`https://www.youtube.com/watch?v=${videoId}`);
        
        console.log("Video Title:", video.title);
        // Is related available? No, wait... youtube-sr has it?
        console.log("Related videos length:", video.related ? video.related.length : "undefined");
        
        // Wait, how about YouTube.search?
        const search = await YouTube.search("Arijit Singh Best Songs", { limit: 5 });
        console.log("Search Results:", search.map(v => v.title).join(', '));

    } catch (e) {
        console.error("Error:", e.message);
    }
}
testYouTubeSR();
