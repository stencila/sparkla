all: setup lint format

setup:
	npm install

lint:
	npm run lint

format:
	npm run format

test:
	npm test

cover:
	npm run test:cover

build:
	npm run build

images:
	$(MAKE) -C guest/kernel/default
	$(MAKE) -C guest/rootfs/alpine

docs:
	npm run docs
.PHONY: docs

clean:
	npm run clean
