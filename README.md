# Tokenmf CLI (`tmf`)

Spin up any LLM provider in one CLI command.

## Installation

Recommended global install:

```bash
npm install -g @tokenmf/tmf
```

After installation, the `tmf` command is available:

```bash
tmf --help
```


## Usage
`tmf set` directly configures any provider without needing the Provider API — just pass `--baseUrl`, `--key`, and `--model`.


```bash
# Show help
tmf --help

# Browse available providers
tmf list

# Show all providers
tmf list --all

# Switch provider
tmf use openai -k sk-xxx -m gpt-4o

# Rollback config
tmf rollback

# Switch provider with direct config (no Provider API needed)
tmf set claude-code --baseUrl https://api.deepseek.com/v1 --key sk-xxx --model deepseek-chat

# Save as reusable template
tmf set hermes --baseUrl https://api.deepseek.com/v1 --key sk-xxx \
  --models opus=deepseek-v4-pro,sonnet=deepseek-v4-pro --save-as deepseek

# Test provider latency
tmf test openai

# Query provider details
tmf ask openai
```

---
Documentation: [tokenmf.com](https://tokenmf.com)

