default: build

.PHONY: clean
clean:
	rm *.vsix || true

.PHONY: lint
lint:
	cd ui && npm install -f && npm run lint

.PHONY: build-ui
build-ui: clean
	cd ui && npm install -f && npm run build

.PHONY: build
build: clean build-ui

.PHONY: install-deps
install-deps:
	npm install -g tfx-cli

.PHONY: package
package: build install-deps
	tfx extension create --manifest-globs vss-extension.json

.PHONY: package-dev
package-dev: build install-deps
	tfx extension create --manifest-globs vss-extension.dev.json
