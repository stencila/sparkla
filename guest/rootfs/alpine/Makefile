rootfs.ext4: Dockerfile ../vsock-server.c
	cp ../vsock-server.c .
	cp ../execution-server.js .
	../dockerfile-to-rootfs.sh

clean:
	rm -rf rootfs.*
