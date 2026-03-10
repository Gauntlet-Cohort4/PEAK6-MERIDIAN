.PHONY: install build build-program build-frontend test test-contract test-automation test-frontend test-integration lint format clean deploy-devnet demo

install:
	npm install

build: build-program build-frontend
	npm run build

build-program:
	anchor build

build-frontend:
	npm run build --workspace=app

test: test-contract test-automation test-frontend test-integration

test-contract:
	anchor test

test-automation:
	npm run test --workspace=automation --if-present

test-frontend:
	npm run test --workspace=app --if-present

test-integration:
	npm run test --workspace=shared

lint:
	npm run lint

format:
	npm run format

clean:
	rm -rf node_modules shared/node_modules automation/node_modules app/node_modules
	rm -rf dist shared/dist automation/dist app/.next
	rm -rf target .anchor

deploy-devnet:
	anchor deploy --provider.cluster devnet

demo:
	@echo "Demo mode - coming in Phase 4"
