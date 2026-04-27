from __future__ import annotations

from typing import Any

from litellm.integrations.custom_logger import CustomLogger


class _GrokCleaner(CustomLogger):
    """Drop request fields that xAI's chat endpoint rejects."""

    unsupported_params = {
        "parallel_tool_calls",
        "reasoning_effort",
        "response_format",
        "store",
        "stream_options",
    }

    async def async_pre_call_hook(
        self,
        user_api_key_dict: dict[str, Any],
        cache: Any,
        data: dict[str, Any],
        call_type: str,
    ) -> dict[str, Any]:
        for param in self.unsupported_params:
            data.pop(param, None)

        return data


GrokCleaner = _GrokCleaner()
