.PHONY: install install-immutable setup-n8n

install:
	yarn install

install-immutable:
	yarn install --immutable

setup-n8n:
	./scripts/setup-n8n-dev.sh
