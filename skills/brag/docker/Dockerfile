# brag-tools — every tool the /brag skill runs, in one image, so nothing is
# installed on the host.
#
#   HyperFrames CLI (pinned)      lint / check / snapshot / beats / tts / render
#   chrome-headless-shell         BeginFrame capture (Playwright build on arm64,
#                                 Chrome for Testing on amd64)
#   FFmpeg                        probing, frames, loudness, poster bake
#   git                           needed by `hyperframes skills update`
#   Python 3 + NumPy/SciPy/Pillow the skill's music, sound and QA scripts
#   Kokoro TTS + its model        voiceover (`hyperframes tts`), offline
#   Fonts                         so captions and contact sheets render
#
# The HyperFrames domain skills that /brag reads are fetched at build time into
# /opt/hf-home/.agents/skills; the runtime guide shows how to export them to the
# host so they can be read like any other file.
#
# Build (from the skill directory):
#   docker build -t brag-tools:0.8.91-r3 docker
# Slow, stable layers come first and the HyperFrames version comes last, so a
# version bump only rebuilds the final layers.

FROM node:22-bookworm-slim

ARG TARGETARCH
ARG PLAYWRIGHT_VERSION=1.61.1

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl unzip git ffmpeg chromium \
    libgbm1 libnss3 libatk-bridge2.0-0 libdrm2 libxcomposite1 \
    libxdamage1 libxrandr2 libcups2 libasound2 libpangocairo-1.0-0 \
    libxshmfence1 libgtk-3-0 \
    fonts-liberation fonts-noto-color-emoji fonts-noto-core \
    fonts-dejavu-core fontconfig python3 python3-venv \
    && rm -rf /var/lib/apt/lists/* && apt-get clean && fc-cache -f

# Python for the skill's scripts, in a venv (Debian's system Python is
# externally managed). Versions are pinned so generated audio is reproducible
# byte for byte across rebuilds.
RUN python3 -m venv /opt/py \
    && /opt/py/bin/pip install --no-cache-dir numpy==2.1.3 scipy==1.14.1 pillow==11.0.0
ENV PATH=/opt/py/bin:$PATH

# Voiceover: `hyperframes tts` runs Kokoro-82M through Python's kokoro-onnx and
# looks for its model in ~/.cache/hyperframes/tts. Baking both in keeps
# narration offline and avoids a 338 MB download on every `docker run --rm`.
RUN pip install --no-cache-dir numpy==2.1.3 kokoro-onnx==0.6.1 soundfile==0.14.0 \
      onnxruntime==1.30.0 espeakng-loader==0.2.4 phonemizer==3.4.0 \
    && mkdir -p /root/.cache/hyperframes/tts/models /root/.cache/hyperframes/tts/voices \
    && curl -fsSL -o /root/.cache/hyperframes/tts/models/kokoro-v1.0.onnx \
       https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx \
    && curl -fsSL -o /root/.cache/hyperframes/tts/voices/voices-v1.0.bin \
       https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    CONTAINER=true \
    HYPERFRAMES_NO_TELEMETRY=1 \
    DO_NOT_TRACK=1

RUN if [ "$TARGETARCH" = "amd64" ]; then \
      npx --yes @puppeteer/browsers install chrome-headless-shell@stable --path /root/.cache/puppeteer; \
    else \
      npx --yes playwright-core@${PLAYWRIGHT_VERSION} install chromium-headless-shell; \
    fi

ARG HYPERFRAMES_VERSION=0.8.91
RUN npm install -g hyperframes@${HYPERFRAMES_VERSION} && npm cache clean --force

# The domain skills /brag reads, matched to this CLI version.
RUN HOME=/opt/hf-home hyperframes skills update \
      hyperframes-core hyperframes-animation hyperframes-creative \
      hyperframes-keyframes hyperframes-cli hyperframes-audio \
    && test -f /opt/hf-home/.agents/skills/hyperframes-core/SKILL.md

# Offline starting points: GSAP, and a blank composition per format. Scaffolding
# becomes a copy (no network, no EACCES on mounted folders), GSAP loads locally,
# and the CLAUDE.md / AGENTS.md / package.json that `init` writes are dropped:
# they tell agents to route into other workflows and to run npx on the host.
RUN mkdir -p /opt/brag/vendor /opt/brag/templates && cd /tmp \
    && npm pack --silent gsap@3.14.2 >/dev/null && tar -xzf gsap-3.14.2.tgz \
    && cp package/dist/gsap.min.js /opt/brag/vendor/gsap.min.js && rm -rf package gsap-3.14.2.tgz \
    && for r in landscape portrait square; do \
         HYPERFRAMES_SKIP_SKILLS=1 hyperframes init "$r" --non-interactive --example blank --resolution "$r" >/dev/null 2>&1 \
         && rm -f "$r/CLAUDE.md" "$r/AGENTS.md" "$r/package.json" \
         && mkdir -p "$r/assets/vendor" && cp /opt/brag/vendor/gsap.min.js "$r/assets/vendor/" \
         && sed -i 's#https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js#assets/vendor/gsap.min.js#' "$r/index.html" \
         && grep -q 'src="assets/vendor/gsap.min.js"' "$r/index.html" \
         && chmod -R u+rwX,go+rX "$r" && mv "$r" /opt/brag/templates/ || exit 1; \
       done

# Every command gets the headless-shell path, not only render.
RUN SHELL_PATH=$(find /root/.cache/puppeteer /root/.cache/ms-playwright \
      \( -name "chrome-headless-shell" -o -name "headless_shell" \) -type f 2>/dev/null | head -1); \
    test -n "$SHELL_PATH" || { echo "headless shell missing" >&2; exit 1; }; \
    printf '#!/bin/sh\nexport PRODUCER_HEADLESS_SHELL_PATH=%s\nexec "$@"\n' "$SHELL_PATH" > /usr/local/bin/hf-env \
    && chmod +x /usr/local/bin/hf-env

LABEL org.opencontainers.image.title="brag-tools" \
      brag.hyperframes="${HYPERFRAMES_VERSION}" \
      brag.recipe="r3"

WORKDIR /work
ENTRYPOINT ["hf-env"]
CMD ["hyperframes", "--help"]
