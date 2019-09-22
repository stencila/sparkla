rootfs.ext4: Dockerfile ../vsock-server.c
	cp ../vsock-server.c .
	../dockerfile-to-rootfs.sh

clean:
	rm -rf rootfs.*
