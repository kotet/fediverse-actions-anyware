FROM mcr.microsoft.com/devcontainers/base:bookworm

# firefox dependencies
RUN --mount=type=cache,target=/var/cache/apt \
    apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
        libgtk-3-0 \
        libasound2 \
        libx11-xcb1 \
        fonts-noto \
        fonts-noto-cjk \
        fonts-noto-color-emoji

# install firefox dev edition
RUN curl --location "https://download.mozilla.org/?product=firefox-devedition-latest-ssl&os=linux64&lang=en-US" | tar --extract --verbose --preserve-permissions --xz --directory /opt
RUN ln -s /opt/firefox/firefox /usr/local/bin/firefox

# install nodejs (for cspell)
ARG NODE_VERSION=24.18.0
RUN --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    --mount=type=cache,target=/var/cache/apt,sharing=locked \
    apt-get update \
    && apt-get install -y --no-install-recommends \
        curl \
    && curl -fsSL --compressed "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" | tar xJ -C /usr/local
ENV PATH=/usr/local/node-v${NODE_VERSION}-linux-x64/bin:${PATH}

RUN npm install --global web-ext
