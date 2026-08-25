const play = require('play-dl');

async function testYoutubeReco() {
    try {
        const videoId = '2Vv-BfVoq4g'; // Example video ID
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        console.log("Fetching info for:", url);
        const info = await play.video_info(url);
        
        console.log("Related videos available?", info.related_videos ? info.related_videos.length : "No");
        if (info.related_videos && info.related_videos.length > 0) {
            console.log("First 3 related:");
            info.related_videos.slice(0, 3).forEach(v => {
                console.log(`- ${v.title} by ${v.channel?.name || 'Unknown'}`);
            });
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
}
testYoutubeReco();
