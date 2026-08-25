const axios = require('axios');

async function testArtistReco() {
    const artist = "Arijit Singh";
    const url = `https://www.jiosaavn.com/api.php?__call=search.getResults&q=${encodeURIComponent(artist)}&n=10&_format=json&ctx=web6dot0&api_version=4`;
    
    try {
        const res = await axios.get(url);
        if (res.data && res.data.results) {
            console.log(`Found ${res.data.results.length} recommendations for artist ${artist}:`);
            res.data.results.forEach(song => {
                console.log("-", song.title.replace(/&quot;/g, '"'));
            });
        }
    } catch (e) {
        console.log("Failed:", e.message);
    }
}
testArtistReco();
