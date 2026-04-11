const express = require("express");
const fetch = require("node-fetch");

const app = express();
app.use(express.json());

// Log environment variable status
console.log("Environment check:");
console.log(`- OPEN_ROUTER_KEY present: ${process.env.OPEN_ROUTER_KEY ? 'Yes' : 'No'}`);
console.log(`- PORT: ${process.env.PORT || '3000 (default)'}`);

app.post("/v1/chat/completions", async (req, res) => {
  console.log(`\nReceived request at ${new Date().toISOString()}`);
  console.log(`Request body model: ${req.body.model || 'unknown'}`);
  
  if (!process.env.OPEN_ROUTER_KEY) {
    console.error("ERROR: OPEN_ROUTER_KEY environment variable not set!");
    return res.status(500).json({ error: "Server configuration error: OPEN_ROUTER_KEY not set" });
  }

  const body = {
    ...req.body,
    plugins: [{ id: "context-compression" }]  // 👈 THIS is the magic
  };

  console.log("Adding context-compression plugin to request");

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPEN_ROUTER_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": req.headers.referer || "http://localhost:3000",
        "X-Title": "Recycler AI Proxy"
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    console.log(`OpenRouter response status: ${response.status}`);
    res.json(data);
  } catch (error) {
    console.error("Proxy error:", error);
    res.status(500).json({ error: "Internal server error", message: error.message });
  }
});

// Simple health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    openRouterKeyConfigured: !!process.env.OPEN_ROUTER_KEY 
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`OpenRouter proxy running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`========================================\n`);
});