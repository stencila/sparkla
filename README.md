# Sparkla

Firecracker is built on top of KVM and needs read/write access to /dev/kvm. Log in to the host in one terminal and set up that access:

```bash
sudo setfacl -m u:${USER}:rw /dev/kvm
```

## Prerequisites

Download the latest Firecracker binary from https://github.com/firecracker-microvm/firecracker/releases:

```bash
curl -L -o firecracker https://github.com/firecracker-microvm/firecracker/releases/download/v0.18.0/firecracker-v0.18.0
chmod +x firecracker
```

And the kernel and rootfs images:

```bash
curl -fsSL -o src/guest/hello-vmlinux.bin https://s3.amazonaws.com/spec.ccfc.min/img/hello/kernel/hello-vmlinux.bin
curl -fsSL -o src/guest/hello-rootfs.ext4 https://s3.amazonaws.com/spec.ccfc.min/img/hello/fsfiles/hello-rootfs.ext4
```

## Development

```bash
npm install
npm run dev
npm run interact
```
