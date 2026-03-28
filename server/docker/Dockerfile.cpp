FROM gcc:12.2.0

RUN apt-get update && apt-get install -y --no-install-recommends \
    make \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

CMD ["sleep", "infinity"]
