import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker-friendly production server (see Dockerfile runner stage).
  output: "standalone",
};

export default nextConfig;
