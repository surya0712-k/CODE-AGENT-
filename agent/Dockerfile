FROM python:3.12-slim

WORKDIR /app

# System deps for livekit turn-detector / audio plugins
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml .
COPY projects.yaml .
RUN pip install --no-cache-dir .

COPY src ./src

# Pre-download Silero VAD + turn detector models at image build time
RUN python src/main.py download-files

ENV PYTHONUNBUFFERED=1
ENV PROJECT_REGISTRY_PATH=/app/projects.yaml

CMD ["python", "src/main.py", "start"]
