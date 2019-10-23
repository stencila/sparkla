all: rootfs.ext4

docker: Dockerfile
	docker build --tag stencila/sparkla-alpine .

rootfs.ext4: docker
	../docker-to-rootfs.sh

push:
	docker push stencila/sparkla-alpine

clean:
	rm -rf rootfs.*
