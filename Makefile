# ── Housing Prices FI ──
# Shortcuts for common Docker operations.

COMPOSE_DEV  = docker compose -p hsp-dev -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.dev
COMPOSE_PROD = docker compose -p hsp-prod -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod

# ── Dev ──
.PHONY: dev-up dev-down dev-db dev-fetch dev-logs dev-psql

dev-up:                ## Start all dev services
	$(COMPOSE_DEV) up -d

dev-down:              ## Stop all dev services
	$(COMPOSE_DEV) down

dev-db:                ## Start only Postgres (dev)
	$(COMPOSE_DEV) up -d postgres

dev-fetch:             ## Run fetcher once (dev)
	$(COMPOSE_DEV) run --rm fetcher

dev-logs:              ## Tail dev logs
	$(COMPOSE_DEV) logs -f

dev-psql:              ## Open psql shell (dev)
	$(COMPOSE_DEV) exec postgres psql -U hsp -d housing_prices

dev-reset:             ## Destroy dev DB volume and recreate
	$(COMPOSE_DEV) down -v
	$(COMPOSE_DEV) up -d postgres

# ── Prod ──
.PHONY: prod-up prod-down prod-db prod-fetch prod-logs

prod-up:               ## Start all prod services
	$(COMPOSE_PROD) up -d

prod-down:             ## Stop all prod services
	$(COMPOSE_PROD) down

prod-db:               ## Start only Postgres (prod)
	$(COMPOSE_PROD) up -d postgres

prod-fetch:            ## Run fetcher once (prod)
	$(COMPOSE_PROD) run --rm fetcher

prod-logs:             ## Tail prod logs
	$(COMPOSE_PROD) logs -f

# ── Test ──
.PHONY: test

test:                  ## Run unit tests (no Docker needed)
	bun test

# ── Help ──
.PHONY: help
help:                  ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
