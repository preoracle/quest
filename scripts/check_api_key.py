#!/usr/bin/env python3
"""Quick check for Anthropic API keys — pass one or more as arguments."""

import sys


def check_key(key: str) -> tuple[bool, str]:
    try:
        import anthropic
    except ImportError:
        return False, "anthropic package not installed"

    client = anthropic.Anthropic(api_key=key)
    try:
        client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1,
            messages=[{"role": "user", "content": "hi"}],
        )
        return True, "valid"
    except anthropic.AuthenticationError:
        return False, "invalid key"
    except anthropic.PermissionDeniedError:
        return False, "permission denied"
    except anthropic.OverloadedError:
        return True, "valid (API overloaded right now)"
    except anthropic.RateLimitError:
        return True, "valid (rate limited)"
    except Exception as e:
        return False, str(e)


def main() -> None:
    keys = sys.argv[1:]
    if not keys:
        print("Usage: python scripts/check_api_key.py sk-ant-... [sk-ant-... ...]")
        print("       or pipe keys:  echo sk-ant-... | python scripts/check_api_key.py")
        if not sys.stdin.isatty():
            keys = [line.strip() for line in sys.stdin if line.strip()]
        else:
            sys.exit(1)

    for key in keys:
        display = f"{key[:12]}...{key[-4:]}" if len(key) > 16 else key
        ok, msg = check_key(key)
        status = "✓" if ok else "✗"
        print(f"{status}  {display}  —  {msg}")


if __name__ == "__main__":
    main()
