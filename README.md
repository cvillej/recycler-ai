# Recycler AI

Hello! Welcome to the Recycler AI project.

This is a new project focused on AI-powered recycling solutions. More details will be added as the project develops.

## Getting Started

**Documentation**: Open the Obsidian vault at `docs/` for complete architecture, implementation plans, and guidance optimized for both humans and LLM coding agents.

Start with `[docs/00 - Maps of Content/Recycler AI Overview.md](docs/00 - Maps of Content/Recycler AI Overview.md)`.

The project is currently a skeleton with an OpenRouter proxy. See the vault for the full target TypeScript architecture.

## Features

- To be determined
- More features coming soon

## OpenRouter Proxy

A lightweight proxy for OpenRouter with context-compression plugin is included.

### Installation

```bash
npm run proxy:install
```

### Running the Proxy

**Using Task (recommended):**
```bash
task proxy:start     # Start the proxy (port 3000)
task proxy:dev       # Start with auto-reload (nodemon)
task proxy:stop      # Stop the proxy
task proxy:check     # Check if proxy is running
task proxy:health    # Test proxy health
```

**Using npm scripts:**
```bash
npm run proxy        # Start proxy directly
npm run proxy:dev    # Start with auto-reload
```

### Environment Variables

Create a `.env` file with:
```
OPEN_ROUTER_KEY=your-openrouter-api-key
PORT=3000           # optional, defaults to 3000
```

### Usage

The proxy automatically adds the `context-compression` plugin to all requests. Send requests to:
```
http://localhost:3000/v1/chat/completions
```

With the same request format as OpenRouter API.

## License

To be determined