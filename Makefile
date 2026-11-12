# Tilefall. gmake on BSD/macOS.
PORT ?= 8726
SEED ?= 26
TIME ?= 60s
BOMBADIL := node_modules/.bin/bombadil
FAULTS := gravity-skips-col score-off-by-one close-overshoot never-over

.PHONY: help deps serve test faults clean
help: ## List targets
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | sed 's/:.*## /\t/'
deps: ## Install the pinned Bombadil
	npm install
serve: ## Serve the game on 127.0.0.1:$(PORT)
	python3 -m http.server $(PORT) --bind 127.0.0.1
test: ## Clean run under Bombadil (needs `gmake serve` in another shell)
	$(BOMBADIL) browser test "http://127.0.0.1:$(PORT)/?seed=$(SEED)" spec/tilefall.spec.ts --headless --time-limit $(TIME) --output-path runs/clean --output-path-overwrite
faults: ## Each planted fault until its first violation; every one must be caught
	@for f in $(FAULTS); do \
	  $(BOMBADIL) browser test "http://127.0.0.1:$(PORT)/?seed=$(SEED)&fault=$$f" spec/tilefall.spec.ts --headless --time-limit $(TIME) --exit-on-violation --output-path runs/$$f --output-path-overwrite >/dev/null 2>&1; \
	  v=$$(jq -r '[.violations[]?.name]|.[]' runs/$$f/trace.jsonl | sort -u | tr '\n' ' '); \
	  if [ -n "$$v" ]; then echo "$$f: caught by $$v"; else echo "$$f: SURVIVED"; exit 1; fi; done
clean: ## Remove run output
	rm -rf runs
