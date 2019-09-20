kernel.bin: extract

# Extract the kernel from the Docker image
extract: build
	docker create --name sparkla-default-kernel sparkla-default-kernel bash
	docker cp sparkla-default-kernel:/linux/vmlinux kernel.bin
	docker rm -f sparkla-default-kernel

# Build the kernel in a Docker image
build: .config
	docker build --tag sparkla-default-kernel .

# Download the kernel build configuration
.config:
	curl -fsSL -o .config https://raw.githubusercontent.com/firecracker-microvm/firecracker/3fe7464dffdecdc31699b94ca8af0a406ddcb450/resources/microvm-kernel-config
