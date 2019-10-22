FROM ubuntu:18.10

RUN apt-get update -y \
 && apt-get install -y \
      systemd-sysv

RUN mkdir -p /etc/init \
 && printf 'start on runlevel [2345] \n \
            respawn                  \n \
            exec /bin/nc-vsock -l 80 \n'\
    >> /etc/init/nc-sock.conf
