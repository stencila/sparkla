# Sparkla

> Compute sessions for executable documents: fast-to-start, isolated, reproducible. Pick any three.

> :warning: Well, that's the aim ;) Sparkla is currently in early development. It started as an experiment in using Amazon's Firecracker as a more secure (but just as fast-to-start) alternative to Docker containers. It is intended to supersede [`stencila/cloud`](https://github.com/stencila/cloud).

## Prerequisites

Sparkla creates sessions in either Firecracker microVMs or Docker containers. So you'll need at least one of these installed.

### Firecracker

Firecracker is only available on Linux.
Download the latest Firecracker binary from https://github.com/firecracker-microvm/firecracker/releases:

```bash
curl -L -o firecracker https://github.com/firecracker-microvm/firecracker/releases/download/v0.18.0/firecracker-v0.18.0
chmod +x firecracker
```

Firecracker is built on top of KVM and needs read/write access to `/dev/kvm`. Log in to the host in one terminal and set up that access:

```bash
sudo setfacl -m u:${USER}:rw /dev/kvm
```

### Docker

If you want to use Docker-base sessions then you'll need to have `docker` installed.

## Install

```bash
npm install -g @stencila/sparkla
```

## Usage

Sparkla uses JSON Web Tokens to secure its WebSocket server. You need to set the `JWT_SECRET` environment variable so that it can verify request tokens. e.g.

```bash
export JWT_SECRET='a-really-hard-to-guess-secret'
```

Then run, Sparkla using the command line interface e.g.

```bash
sparkla --docker
```

Options:

- `--firecracker`: run sessions as Firecracker microVMs (default)
- `--docker`: run sessions as Docker containers
- `--debug`: emit debug log messages


## Development

```bash
npm run serve:dev
```

### Firecracker

To check for running `FirecrackerSession`s:

```bash
ps aux | firecracker
```

You can also check the logs and metrics of a Firecracker VM while it is running:

```bash
cat /tmp/vm-0d0b4b2fa73c5d4c10ed72ccac97b798530ba1b7ab8461fd313d320fb5d3562e/log.fifo
cat /tmp/vm-0d0b4b2fa73c5d4c10ed72ccac97b798530ba1b7ab8461fd313d320fb5d3562e/metrics.fifo
```

### Docker

To check for running `DockerSession`s:

```bash
docker ps
```
