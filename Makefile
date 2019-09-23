all:
	npm install
	$(MAKE) -C guest/kernel/default
	$(MAKE) -C guest/rootfs/alpine
