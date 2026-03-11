import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@meridian/shared'],
  webpack: (config, { isServer }) => {
    // @coral-xyz/anchor and @solana/web3.js use Node.js built-ins
    // that are not available in the browser. We need to handle these
    // for the client-side bundle.
    if (!isServer) {
      config.resolve = {
        ...config.resolve,
        fallback: {
          ...(config.resolve?.fallback ?? {}),
          fs: false,
          os: false,
          path: false,
          crypto: false,
        },
      };
    }

    return config;
  },
};

export default nextConfig;
