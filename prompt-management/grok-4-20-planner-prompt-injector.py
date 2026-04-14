import litellm
import httpx
import asyncio
from litellm.integrations.custom_logger import CustomLogger
from typing import Literal

class DocsInjector(CustomLogger):
    def __init__(self):
        self.docs_url = "http://localhost:8000/prompt-docs"   # ← Change this to your HTTP server URL

    async def async_pre_call_hook(
        self,
        user_api_key_dict,
        cache,
        data: dict,
        call_type: Literal["completion", "embeddings"]
    ):
        # Only run for Grok-4.20 (your planner model)
        if data.get("model") != "grok-4.20":
            return data

        try:
            # Call your HTTP server to get the latest docs
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(self.docs_url)
                resp.raise_for_status()
                docs_content = resp.text.strip()

            if not docs_content:
                return data

            # Inject docs right after the system prompt (best for caching)
            messages = data.get("messages", [])

            # Insert docs as a user message early in the conversation
            docs_message = {
                "role": "user",
                "content": f"Here is the current documentation and codebase summary (always use this for planning):\n\n{docs_content}"
            }

            # Insert after system prompt, before the actual user request
            if messages and messages[0]["role"] == "system":
                data["messages"] = [messages[0], docs_message] + messages[1:]
            else:
                data["messages"] = [docs_message] + messages

            print(f"✅ DocsInjector: Injected fresh docs into request for {data['model']}")

        except Exception as e:
            print(f"⚠️  DocsInjector failed: {e}")

        return data


# Instantiate the callback
docs_injector = DocsInjector()
