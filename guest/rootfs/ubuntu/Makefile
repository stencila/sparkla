all: rootfs.ext4

docker: Dockerfile
	docker build --tag stencila/sparkla-ubuntu .

rootfs.ext4: docker
	../docker-to-rootfs.sh

push:
	docker push stencila/sparkla-ubuntu

pull:
	docker pull stencila/sparkla-ubuntu

clean:
	rm -rf rootfs.*
