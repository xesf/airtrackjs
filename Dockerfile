FROM alpine:latest

RUN apk add --no-cache git \
  libc-dev \
  libusb-dev \
  gcc \
  g++ \
  make \
  cmake \
  bash \
  nodejs \
  npm \
  python

ADD https://api.github.com/repos/radiowitness/librtlsdr/git/refs/heads/master version.json
RUN git clone -b master https://github.com/radiowitness/librtlsdr.git /usr/local/share/librtlsdr
RUN mkdir /usr/local/share/librtlsdr/build

WORKDIR /usr/local/share/librtlsdr/build
RUN cmake ../ -DINSTALL_UDEV_RULES=ON -DDETACH_KERNEL_DRIVER=ON
RUN make
RUN make install

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 8080
CMD [ "npm", "start" ]