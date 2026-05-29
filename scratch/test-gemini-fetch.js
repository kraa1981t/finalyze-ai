const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function runTest() {
  const url = "https://finalyze-ai-sigma.vercel.app/api/ai-analysis";
  console.log("Calling live Vercel API:", url);
  
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: "Return valid JSON containing a test results list: { \"results\": [] }",
        userApiKey: ""
      })
    });
    
    console.log("Status Code:", resp.status);
    const data = await resp.json().catch(async () => {
      const text = await resp.text();
      return { rawText: text };
    });
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Fetch Error:", error);
  }
}

runTest();
