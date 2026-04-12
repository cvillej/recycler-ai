litellm_settings:
  drop_params: true
  telemetry: false

model_list:
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      api_key: os.environ/OPENAI_API_KEY
      drop_params: true
      additional_drop_params: ["stream_options"]

      