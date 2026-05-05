.PHONY: help sync-openapi ts-install ts-build ts-test ts-lint py-install py-test py-lint cli-install cli-build clean

ANALYTICS_API_OPENAPI ?= https://api-preview.convai.com/v1/analytics/openapi.json

help:
	@echo "convai-analytics — repo tasks"
	@echo "  make sync-openapi     Pull the canonical OpenAPI spec from the API repo's /openapi.json"
	@echo "  make ts-install       Install TS SDK + CLI deps"
	@echo "  make ts-build         Build TS SDK + CLI"
	@echo "  make ts-test          Run TS tests"
	@echo "  make ts-lint          Lint + typecheck TS"
	@echo "  make py-install       Install Python SDK in editable mode"
	@echo "  make py-test          Run Python tests"
	@echo "  make py-lint          Ruff + mypy on Python SDK"
	@echo "  make clean            Remove build artifacts and caches"

sync-openapi:
	@echo "Fetching canonical spec from $(ANALYTICS_API_OPENAPI)"
	curl -fsSL "$(ANALYTICS_API_OPENAPI)" -o openapi/convai-analytics-api.json
	@echo "Wrote openapi/convai-analytics-api.json — commit if changed."

ts-install:
	cd packages/typescript && npm install
	cd cli && npm install

ts-build:
	cd packages/typescript && npm run build
	cd cli && npm run build

ts-test:
	cd packages/typescript && npm test

ts-lint:
	cd packages/typescript && npm run lint && npm run typecheck

py-install:
	cd packages/python && uv sync --all-groups

py-test:
	cd packages/python && uv run pytest -q

py-lint:
	cd packages/python && uv run ruff check . && uv run mypy convai_analytics

clean:
	find . -type d \( -name node_modules -o -name dist -o -name .venv -o -name __pycache__ -o -name .pytest_cache -o -name .ruff_cache -o -name .mypy_cache \) -prune -exec rm -rf {} +
