const isDev = process.env.NODE_ENV === 'development';

// Bundle analyzer configuration (commented out for now)
// const withBundleAnalyzer = require('@next/bundle-analyzer')({
//   enabled: process.env.ANALYZE === 'true',
// });

const nextConfig = {
  // Static export mode (required for current architecture)
  // NOTE: Static export limits some Next.js features (SSR, Server Components, Server Actions)
  // but is necessary for the current client-side architecture
  output: isDev ? undefined : 'export',

  // Image configuration for static export
  // Note: unoptimized required for static export, but we can still optimize in dev mode
  images: {
    unoptimized: true,  // Required for static export
    // formats: ['image/avif', 'image/webp'],  // Not available with unoptimized
    // deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    // imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Skip type checking to reduce memory usage
  typescript: {
    ignoreBuildErrors: true,
  },

  // Development optimizations
  ...(isDev && {
    onDemandEntries: {
      maxInactiveAge: 25 * 1000,
      pagesBufferLength: 2,
    },
  }),

  // ✅ Enhanced experimental features for Next.js 16
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion', 'recharts'],

    // ✅ Server Actions for type-safe mutations
    serverActions: {
      bodySizeLimit: '2mb',
      allowedOrigins: ['localhost:3500']
    },

    // ✅ Partial Prerendering (latest Next.js feature)
    // ppr: true,  // Enable when ready for production
  },

  // Configure webpack for memory efficiency and WASM support
  webpack: (config, { isServer }) => {
    // Enable WebAssembly support
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Handle WASM files
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    });

    // Ignore problematic pages with advanced features
    config.ignoreWarnings = [
      { module: /duckdb-wasm/ },
      { module: /papaparse/ },
    ];

    // Externalize native modules and services that use them
    config.externals = config.externals || [];
    if (isServer) {
      config.externals.push(
        // Native modules
        'duckdb',
        'better-sqlite3',
        'sqlite3',
        'parquetjs',
        'xlsx',
        'natural',
        'lz4js',
        'papaparse',
        // Services that import native modules
        /^@\/services\/master-data-service/,
        /^@\/services\/id-based-data-service/,
        /^@\/services\/database/,
        /^@\/services\/cloudflare-optimized-storage/,
        /^@\/lib\/data\//,
        /^@\/lib\/database\//,
      );
    }

    // Aggressive memory optimization
    config.optimization = {
      ...config.optimization,
      minimize: false,
      splitChunks: false,
      runtimeChunk: false,
    };

    // Reduce parallelism to save memory
    config.parallelism = 1;

    return config;
  },
  
  // Environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3500',
  },
  
  // Performance optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
};

export default nextConfig;
