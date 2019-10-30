all: setup lint format test build docs

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

rootfs-dockers:
	make -C guest/rootfs/ubuntu docker
	make -C guest/rootfs/ubuntu-midi docker

rootfs-push:
	@echo "$$DOCKER_PASSWORD" | docker login -u "$$DOCKER_USERNAME" --password-stdin
	make -C guest/rootfs/ubuntu push
	make -C guest/rootfs/ubuntu-midi push

rootfs-pull:
	make -C guest/rootfs/ubuntu pull
	make -C guest/rootfs/ubuntu-midi pull

docs:
	npm run docs
.PHONY: docs

clean:
	npm run clean
