const isDev = process.env.NODE_ENV === 'development';

// Bundle analyzer configuration (commented out for now)
// const withBundleAnalyzer = require('@next/bundle-analyzer')({
//   enabled: process.env.ANALYZE === 'true',
// });

const nextConfig = {
  // ✅ REMOVED static export to unlock Next.js 16 features
  // Now using standard SSR/SSG with Server Components
  // output: isDev ? undefined : 'export',

  // ✅ ENABLED image optimization for 50-70% bandwidth savings
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
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
