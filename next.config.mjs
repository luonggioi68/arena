/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  webpack: (config, { isServer }) => {
    // pdfjs-dist phụ thuộc vào module 'canvas' của Node.js, 
    // chúng ta cần báo cho Webpack bỏ qua nó khi chạy trên trình duyệt.
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
        fs: false,
        path: false,
      };
    }
    return config;
  },
};

export default nextConfig;