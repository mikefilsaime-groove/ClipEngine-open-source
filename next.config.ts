import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow large video file uploads (10GB)
  serverExternalPackages: ["fluent-ffmpeg", "ffmpeg-static", "whisper-node"],
  // Exclude Python artifacts from output tracing. The venv lives at
  // ~/.clipengine-venv (outside the project tree), but this keeps any
  // stray __pycache__ directories from tripping up Turbopack.
  outputFileTracingExcludes: {
    "*": ["python/__pycache__/**"],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10gb",
    },
    proxyClientMaxBodySize: "10gb",
  },
};

export default nextConfig;
