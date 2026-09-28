import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@stellar/stellar-sdk"],
  transpilePackages: ["three", "@react-three/fiber", "@react-three/drei"],
};

export default nextConfig;
