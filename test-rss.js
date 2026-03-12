const https = require('https');

https.get('https://feeds.finance.yahoo.com/rss/2.0/headline?s=AAPL&region=US&lang=en-US', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log("Received " + data.length + " bytes of RSS data.");
    // Just simple check to see roughly how many items
    const items = data.split('<item>').length - 1;
    console.log("Number of RSS items:", items);
    
    // Quick regex to get publishers/titles
    const titles = [...data.matchAll(/<title>(.*?)<\/title>/g)].map(m => m[1]);
    console.log(titles.slice(0, 5)); // First few titles
  });
}).on("error", (err) => {
  console.log("Error: " + err.message);
});
