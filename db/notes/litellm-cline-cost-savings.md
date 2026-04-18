Keep context aggressively small

Leave auto-compact on and treat it as a savings tool, not just a convenience tool.
Turn on LiteLLM caching.

Use provider prompt caching where supported

Short task threads

.clineignore

# simpple response caching 
- cache: true

 # proper prompt caching
 - provider-native
 - llm provider side
 - cache_control or auto-injection in the config

 Here's a clear, practical breakdown of **provider-native prompt caching** (also called context caching) and the best strategies for using it with **Cline + LiteLLM**.

### What Is Provider-Native Prompt Caching?
This is **different** from the simple "response caching" (exact-match) we discussed earlier.

- **Provider-native** means the LLM company (Anthropic, Google, OpenAI, DeepSeek, etc.) caches the **long repeated parts** of your prompt on *their* side.
- You only pay the **full price** for the new/changing part (usually your latest message + tool results).
- The cached prefix (system prompt, Focus Chain todo list, previous conversation, code files, etc.) is charged at a **much lower rate** — often 75–90% cheaper.

This is **extremely powerful** for Cline because Cline repeatedly sends very similar long contexts (Focus Chain reminders, tool loops, file contents).

### Current Support via LiteLLM (as of 2026)

| Provider          | How to Trigger in LiteLLM                          | Typical Discount on Cached Tokens | Notes for Cline Users                          |
|-------------------|----------------------------------------------------|-----------------------------------|------------------------------------------------|
| **Anthropic (Claude)** | Explicit: Add `"cache_control": {"type": "ephemeral"}` on the last content block of a message | ~90% off read (costs extra on write) | Best control. Minimum ~1024–2048 tokens to qualify. |
| **Gemini (Google)**   | Explicit with `cache_control` or **implicit** (automatic on Gemini 2.5/3 models) | 75–90% off                       | Implicit is very convenient. Supports custom TTL. |
| **OpenAI**            | Automatic (if >1024 tokens and prefix matches)    | ~50% off                         | Easiest, but smaller discount.                 |
| **DeepSeek**          | Often automatic or very easy                      | Very high (sometimes default)    | Excellent value for coding.                    |
| Others (Bedrock, Vertex) | Varies by model                                   | Varies                           | —                                              |

LiteLLM translates everything into a mostly unified format so you don’t have to write provider-specific code.

### Best Strategies for Cline + LiteLLM

Here are the most effective ways people save money with Cline right now:

1. **Put Static Content First + Dynamic Content Last** (Most Important Rule)
   - Cache the **system prompt**, **Focus Chain todo list**, **project rules**, and **large static code/docs** at the beginning.
   - Put changing parts (your latest instruction, tool output, new code diff) at the **very end**.
   - This maximizes cache hits because the prefix stays identical across many turns.

2. **Use LiteLLM’s Auto-Inject Feature** (Easiest for Most People)
   In your `config.yaml`, you can tell LiteLLM to automatically add `cache_control` to certain parts:

   ```yaml
   model_list:
     - model_name: cline-cheap
       litellm_params:
         model: gemini/gemini-3-flash          # or anthropic/claude-4-sonnet
         api_key: os.environ/GEMINI_API_KEY
         cache_control_injection_points:
           - location: message
             role: system                        # auto-caches the system prompt
   ```

   This is very helpful for Cline because the system prompt and Focus Chain are sent repeatedly.

3. **Manual Control (More Precise)**
   You can also pass it directly if needed, but with LiteLLM proxy it’s usually better to let auto-inject or the provider handle it.

4. **Combine with Simple Response Caching**
   - Enable **both**:
     - `cache: true` (your local Redis or in-memory response cache)
     - Provider-native prompt caching
   - They stack nicely: local cache for identical repeats, provider cache for long similar prefixes.

5. **Optimize for Cline Specifically**
   - Raise your **Focus Chain interval** to 8–10 (or higher). Fewer reminders = longer stable prefixes = better cache hits.
   - Keep tasks reasonably contained (don’t let one chat run for 2+ hours without starting fresh).
   - Use cheaper models like Gemini 3 Flash or DeepSeek as your default — they often have excellent caching economics.
   - Place large file contents or documentation early in the context when possible.

6. **Monitor Cache Performance**
   - In the LiteLLM proxy terminal/logs, look for cache-related info or usage breakdown (many providers return `cache_read_tokens` or similar in the usage object).
   - Cline should also show token usage/cost — compare before and after enabling caching.

### Quick Recommendation for You
Start simple:
- Set your default model to a strong cheap one that supports good caching (Gemini 3 Flash or DeepSeek V3).
- Add basic response caching (`cache: true` with Redis if possible).
- Add `cache_control_injection_points` for the system message in your `config.yaml`.
- Increase Focus Chain interval to **8 or 10**.

This combination usually gives the biggest practical savings for Cline users without much extra work.

Would you like me to:
- Give you a ready-to-copy `config.yaml` example tailored to the models you have?
- Show the exact syntax for auto-inject with Anthropic vs Gemini?
- Or explain how to check real cache hit rates in the logs?

Just tell me which models you currently have keys for (Gemini, Anthropic, DeepSeek, OpenAI, etc.), and I’ll give you the most effective setup.



@@@@@@@@@@@@@@@@@@@@@@@@@@@@
Here's a clear explanation of what I meant by **"Place large file contents or documentation early in the context when possible"**, and **how you can actually do it** in your Cline + LiteLLM setup.

### Why Order Matters for Caching
Provider-native prompt caching (especially with **Gemini**, **Claude/Anthropic**, and some others) works best when the **long, unchanging (static) parts** of the prompt come **first**, and the **changing (dynamic) parts** come **last**.

- **Static / early** = System instructions, Focus Chain todo list (when it doesn't change much), project rules, large documentation, common code files, tool definitions.
- **Dynamic / late** = Your latest typed message, latest tool output, recent code changes, new file diffs.

If the static part stays identical across many turns, the LLM provider can reuse the cached version of that prefix and only process the small new part → big cost savings.

Cline (as an agent) builds the full prompt internally on every LLM call, so you have limited direct control. But there are several practical ways to influence the order.

### Practical Ways to Put Large Content Early

1. **Use Cline's Built-in Features (Easiest – No Config Changes Needed)**
   - **Rules / Custom Instructions**: In Cline, you can add persistent rules or project-specific instructions (often via `/newrule` command or the rules panel).  
     Put your large documentation, coding standards, architecture notes, or frequently referenced file summaries here. Cline tends to place these early in the system prompt or as high-priority context.
   - **@mention large files early**: When starting a task, mention important files first in your prompt (e.g. `@README.md @architecture.md @main.go`). This encourages Cline to load them into the context early.
   - **Start a fresh task** with a detailed initial prompt that includes the big static context. Example:
     ```
     Here is the full project context:
     [paste or @ large docs/files]

     Focus Chain / Plan: ...

     Now do this: [your actual request]
     ```
     Cline will often keep that early context stable for subsequent turns.

2. **Leverage LiteLLM's Auto-Inject Prompt Caching (Recommended for You)**
   This is the most reliable technical way. You tell LiteLLM to automatically mark certain parts (especially the **system message**) as cacheable.

   Add this to your `config.yaml` under the model definition:

   ```yaml
   model_list:
     - model_name: cline-cheap
       litellm_params:
         model: gemini/gemini-3-flash          # or anthropic/claude-4-sonnet
         api_key: os.environ/GEMINI_API_KEY
         cache_control_injection_points:       # ← This is the key part
           - location: "message"
             role: "system"                    # Marks the entire system prompt (including Cline's rules + large static context) for caching
   ```

   You can add more injection points if needed, for example targeting the second-to-last message (which often contains the stable Focus Chain or previous summary).

   After updating the config, restart the LiteLLM proxy.

   This works especially well with:
   - Gemini (implicit + explicit support)
   - Claude/Anthropic (very strong prompt caching)

3. **Influence Cline's Behavior Indirectly**
   - Keep your **Focus Chain interval** higher (8–10) so the todo list doesn't update too frequently (frequent small changes can break the cache prefix).
   - Avoid frequently adding/removing tools or changing model mid-task.
   - Use shorter, more stable system-level instructions instead of injecting large dynamic text every turn.
   - For very large files: Instead of letting Cline read them repeatedly, summarize them once in a rule or early message and reference the summary.

### Quick Summary of the Ideal Prompt Structure (What You Want Under the Hood)
```
[Static – best for caching]
- System prompt + Cline rules
- Large documentation / project context
- Tool definitions
- Stable Focus Chain / plan

[Dynamic – changes often]
- Recent conversation / tool outputs
- Your latest request
- New code diffs
```

### What You Can Do Right Now (Low Effort)
- Update your `config.yaml` with the `cache_control_injection_points` for the system role (as shown above).
- In Cline, create a persistent rule that includes your most important large documentation or coding guidelines.
- Test with a medium-sized task and watch the LiteLLM proxy logs for cache read/write indicators (or check token usage breakdown in Cline).

Would you like me to:
- Give you a complete ready-to-use `config.yaml` snippet based on the models you have?
- Show how to add more advanced injection points (e.g. for tools or specific message index)?
- Or explain how to check whether caching is actually hitting in your logs?

Just tell me your main models (e.g. Gemini, Claude, DeepSeek) and I’ll tailor the exact config for you.