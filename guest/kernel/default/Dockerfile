FROM ubuntu:20.04

RUN apt-get update               \
 && apt-get -y -q install        \
      bc                         \
      bison                      \
      build-essential            \
      curl                       \
      flex                       \
      libelf-dev                 \
      libssl-dev                 \
 && apt-get clean

RUN curl -L https://github.com/torvalds/linux/tarball/v4.20 | tar xz  \
 && mv torvalds-linux-* linux

COPY .config linux

RUN cd linux \
 && yes "" | make oldconfig \
 && make -j4 vmlinux
