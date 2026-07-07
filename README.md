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

### File I/O Permissions

`tmf` requires the following filesystem permissions:

- **Read** `~/.codex/`, `~/.claude/`, `~/.openclaw/` and other AI app config directories for automatic app detection
- **Write** `~/.tmf/` directory for saving detection reports and runtime configuration
- **Read/Write** target application config files (creates `.bak` backups during `use` / `rollback`)

Run as a normal user to avoid `sudo` causing config file permission issues.

## Usage

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

# Test provider latency
tmf test openai

# Query provider details
tmf ask openai
```
