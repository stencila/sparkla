rootfs.ext4: Dockerfile
	../dockerfile-to-rootfs.sh

clean:
	rm -rf rootfs.*

docker-image:
	docker build --tag stencila/sparkla-alpine .
