import sys
sys.path.insert(0, '.')
from fastapi import FastAPI
from fastapi.responses import PlainTextResponse
import os
from grok_4_20_doc_concat import DocAggregator, load_docs_dir

app = FastAPI(title="Recycler AI Docs Cache Server")

@app.get("/prompt-docs", response_class=PlainTextResponse)
async def docs():
    docs_dir = load_docs_dir()
    env = os.getenv('RECYCLE_AI_ENV', 'local')
    aggregator = DocAggregator(docs_dir)
    cache_string = aggregator.get_docs_cache_string(env)
    return cache_string

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)