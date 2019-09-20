all:
	npm install
	$(MAKE) -C guest/kernel/hello
	$(MAKE) -C guest/rootfs/hello
