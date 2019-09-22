/*
 * vsocket-server - A server for AF_VSOCK to allow communications
 * between the host and microVMs.
 *
 * Inspired by and mostly based on `nc-vsock` by Stefan Hajnoczi
 * https://github.com/stefanha/nc-vsock/. This is a simlified
 * version of `nc-vsock` that only listens, does not
 * support tunneling to TCP socket, and does support
 * echoing (mainly for testing).
 * 
 * See also https://github.com/firecracker-microvm/firecracker/blob/master/tests/host_tools/vsock_helper.c
 */

#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include <string.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/socket.h>
#include <sys/select.h>
#include <linux/vm_sockets.h>

/**
 * Set a file descriptor to be non-blocking
 */
static void set_non_blocking(int fd, bool enable) {
	int ret;
	int flags;

	ret = fcntl(fd, F_GETFL);
	if (ret < 0) {
		perror("fcntl");
		return;
	}

	flags = ret & ~O_NONBLOCK;
	if (enable) {
		flags |= O_NONBLOCK;
	}

	fcntl(fd, F_SETFL, flags);
}

/**
 * Transfer data between file descriptors
 */
static int transfer_data(int in_fd, int out_fd) {
	char buf[4096];
	char *send_ptr = buf;
	ssize_t nbytes;
	ssize_t remaining;

	nbytes = read(in_fd, buf, sizeof(buf));
	if (nbytes <= 0) {
		return -1;
	}

	remaining = nbytes;
	while (remaining > 0) {
		nbytes = write(out_fd, send_ptr, remaining);
		if (nbytes < 0 && errno == EAGAIN) {
			nbytes = 0;
		} else if (nbytes <= 0) {
			return -1;
		}

		if (remaining > nbytes) {
			/* Wait for fd to become writeable again */
			for (;;) {
				fd_set wfds;
				FD_ZERO(&wfds);
				FD_SET(out_fd, &wfds);
				if (select(out_fd + 1, NULL, &wfds, NULL, NULL) < 0) {
					if (errno == EINTR) {
						continue;
					} else {
						perror("select");
						return -1;
					}
				}

				if (FD_ISSET(out_fd, &wfds)) {
					break;
				}
			}
		}

		send_ptr += nbytes;
		remaining -= nbytes;
	}
	return 0;
}

int main(int argc, char **argv) {
    if (argc < 2 || argc > 3) {
        fprintf(stderr, "Usage: vsock-server <port> [--echo]\n");
		return 1;
    }
	
	char* port_str = argv[1];
	char* end = NULL;
	long port = strtol(port_str, &end, 10);
	if (port_str == end || *end != '\0') {
		fprintf(stderr, "invalid port number: %s\n", port_str);
		return 1;
	}

    bool echo = false;
	if (argc == 3) {
		char* option = argv[2];
        if (strcmp(option, "--echo") == 0) {
			echo = true;
		} else {
			fprintf(stderr, "invalid option: %s\n", option);
			return 1;
		}
    }

	struct sockaddr_vm sa_listen = {
		.svm_family = AF_VSOCK,
		.svm_cid = VMADDR_CID_ANY,
		.svm_port = port
	};

	int listen_fd = socket(AF_VSOCK, SOCK_STREAM, 0);
	if (listen_fd < 0) {
		perror("socket");
		return 1;
	}

	if (bind(listen_fd, (struct sockaddr*)&sa_listen, sizeof(sa_listen)) != 0) {
		perror("bind");
		close(listen_fd);
		return 1;
	}

	if (listen(listen_fd, 1) != 0) {
		perror("listen");
		close(listen_fd);
		return 1;
	}

	struct sockaddr_vm sa_client;
	socklen_t socklen_client = sizeof(sa_client);
	
    int client_fd = accept(listen_fd, (struct sockaddr*)&sa_client, &socklen_client);
	if (client_fd < 0) {
		perror("accept");
		close(listen_fd);
		return 1;
	}

	close(listen_fd);

	fd_set rfds;
	int nfds = client_fd + 1;

	set_non_blocking(STDIN_FILENO, true);
	set_non_blocking(STDOUT_FILENO, true);
	set_non_blocking(client_fd, true);

	for (;;) {
		FD_ZERO(&rfds);
		FD_SET(STDIN_FILENO, &rfds);
		FD_SET(client_fd, &rfds);

		if (select(nfds, &rfds, NULL, NULL, NULL) < 0) {
			if (errno == EINTR) {
				continue;
			} else {
				perror("select");
				return 1;
			}
		}

		if (FD_ISSET(STDIN_FILENO, &rfds)) {
			if (transfer_data(STDIN_FILENO, client_fd) < 0) {
				return 0;
			}
		}

		if (FD_ISSET(client_fd, &rfds)) {
			if (transfer_data(client_fd, echo ? client_fd : STDOUT_FILENO) < 0) {
				return 0;
			}
		}
	}

	return 0;
}
