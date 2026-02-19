
async function test() {
    try {
        const res = await fetch('http://localhost:3000/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: "Apple Inc. designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and accessories worldwide.",
                targetLang: "de"
            })
        });

        console.log("Status:", res.status);
        const json = await res.json();
        console.log("Result:", JSON.stringify(json, null, 2));

    } catch (e) {
        console.error("Error:", e);
    }
}

test();
