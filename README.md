# Sparkla

## Prerequisites

Download the latest Firecracker binary from https://github.com/firecracker-microvm/firecracker/releases:

```bash
curl -L -o firecracker https://github.com/firecracker-microvm/firecracker/releases/download/v0.18.0/firecracker-v0.18.0
chmod +x firecracker
```

Firecracker is built on top of KVM and needs read/write access to /dev/kvm. Log in to the host in one terminal and set up that access:

```bash
sudo setfacl -m u:${USER}:rw /dev/kvm
```

## Development

```bash
make
npm run dev
```

To check that a VM is running:

```bash
ps aux | firecracker
```

You can check that the logs and metrics of a VM while it is running:

```bash
cat /tmp/vm-0d0b4b2fa73c5d4c10ed72ccac97b798530ba1b7ab8461fd313d320fb5d3562e/log.fifo
cat /tmp/vm-0d0b4b2fa73c5d4c10ed72ccac97b798530ba1b7ab8461fd313d320fb5d3562e/metrics.fifo
```
