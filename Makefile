.PHONY: help sync-openapi sync-openapi-local check-openapi gen-types ts-install ts-build ts-test ts-lint e2e-stg py-install py-test py-lint cli-install cli-build clean

# Production source-of-truth — what `sync-openapi` curls in CI / local dev when
# the API is reachable. Override via env to point at a different deploy.
ANALYTICS_API_OPENAPI ?= https://analytics-api-preview.convai.com/v1/analytics/openapi.json

# Local fallback — runs the FastAPI app directly to dump openapi(). Used when
# the API isn't deployed yet or you're iterating on backend + client together.
# Path is relative to this Makefile's directory.
ANALYTICS_API_REPO ?= ../convai-analytics-api

OPENAPI_SNAPSHOT := openapi/convai-analytics-api.json

help:
	@echo "convai-analytics — repo tasks"
	@echo "  make sync-openapi        Pull canonical OpenAPI spec from $(ANALYTICS_API_OPENAPI)"
	@echo "  make sync-openapi-local  Generate spec locally from $(ANALYTICS_API_REPO) (no network)"
	@echo "  make check-openapi       Re-pull spec into a tmp file and fail if it differs (CI gate)"
	@echo "  make gen-types           Regenerate _generated.{ts,py} from $(OPENAPI_SNAPSHOT)"
	@echo "  make ts-install          Install TS SDK + CLI deps"
	@echo "  make ts-build            Build TS SDK + CLI"
	@echo "  make ts-test             Run TS tests"
	@echo "  make ts-lint             Lint + typecheck TS"
	@echo "  make e2e-stg             Run live SDK E2E against analytics-api-stg"
	@echo "  make py-install          Install Python SDK in editable mode"
	@echo "  make py-test             Run Python tests"
	@echo "  make py-lint             Ruff + mypy on Python SDK"
	@echo "  make clean               Remove build artifacts and caches"

sync-openapi:
	@echo "Fetching canonical spec from $(ANALYTICS_API_OPENAPI)"
	curl -fsSL "$(ANALYTICS_API_OPENAPI)" | python3 -c "import json,sys; print(json.dumps(json.load(sys.stdin), indent=2, sort_keys=True))" > $(OPENAPI_SNAPSHOT)
	@echo "Wrote $(OPENAPI_SNAPSHOT) — commit if changed."

sync-openapi-local:
	@echo "Generating spec locally from $(ANALYTICS_API_REPO)"
	cd $(ANALYTICS_API_REPO) && uv run python -c "import json; from convai_analytics_api.main import create_app; print(json.dumps(create_app().openapi(), indent=2, sort_keys=True))" > $(CURDIR)/$(OPENAPI_SNAPSHOT)
	@echo "Wrote $(OPENAPI_SNAPSHOT) — commit if changed."

# CI gate: re-pulls the spec and fails if the committed snapshot is stale.
# Doesn't modify the working tree on success.
check-openapi:
	@tmp=$$(mktemp) && \
	  curl -fsSL "$(ANALYTICS_API_OPENAPI)" | python3 -c "import json,sys; print(json.dumps(json.load(sys.stdin), indent=2, sort_keys=True))" > $$tmp && \
	  diff -q $$tmp $(OPENAPI_SNAPSHOT) || (echo "OpenAPI snapshot is stale. Run 'make sync-openapi' and commit."; rm $$tmp; exit 1) && \
	  rm $$tmp
	@echo "OpenAPI snapshot matches the live spec."

gen-types:
	@echo "Regenerating TypeScript types"
	cd packages/typescript && npx openapi-typescript ../../$(OPENAPI_SNAPSHOT) -o src/_generated.ts
	@echo "Regenerating Python types"
	cd packages/python && uv run datamodel-codegen \
	  --input ../../$(OPENAPI_SNAPSHOT) \
	  --input-file-type openapi \
	  --output-model-type pydantic_v2.BaseModel \
	  --output convai_analytics/_generated.py \
	  --target-python-version 3.10 \
	  --use-standard-collections \
	  --use-union-operator \
	  --use-double-quotes \
	  --snake-case-field \
	  --allow-population-by-field-name \
	  --reuse-model \
	  --disable-timestamp \
	  --use-annotated \
	  --field-constraints
	@echo "Done. Re-run 'make ts-lint && make py-lint' to verify."

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

e2e-stg:
	cd packages/typescript && npm run e2e:stg

# Typecheck the example scripts and chart recipes against the live SDK
# source. Catches bitrot: a method renamed or a type tightened in the SDK
# breaks scripts that used to work, but they live outside the package so
# the package's own typecheck doesn't see them. Run this in CI alongside
# ts-lint.
ts-typecheck-recipes:
	packages/typescript/node_modules/.bin/tsc -p tsconfig.recipes.json

py-install:
	cd packages/python && uv sync --all-groups

py-test:
	cd packages/python && uv run pytest -q

py-lint:
	cd packages/python && uv run ruff check . && uv run mypy convai_analytics

clean:
	find . -type d \( -name node_modules -o -name dist -o -name .venv -o -name __pycache__ -o -name .pytest_cache -o -name .ruff_cache -o -name .mypy_cache \) -prune -exec rm -rf {} +
