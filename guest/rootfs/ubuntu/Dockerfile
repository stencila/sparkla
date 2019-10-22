FROM ubuntu:18.10

# Install system dependencies
RUN apt-get update -y
RUN apt-get install -y \
      curl \
      systemd-sysv

# Install Node.js
RUN curl -sL https://deb.nodesource.com/setup_12.x | bash -
RUN apt-get install -y \
      nodejs

# Install Executa
RUN npm config --global set user root
RUN npm install --global @stencila/executa@0.3.1

# Run Executa at startup when in a Firecracker VM
RUN mkdir -p /etc/init \
 && printf 'start on runlevel [2345] \n \
            respawn                  \n \
            exec /usr/bin/executa    \n'\
    >> /etc/init/executa.conf

# Run Execta by default when in a Docker container
CMD node /usr/bin/executa serve --stdio
