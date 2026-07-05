import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import sitemap from 'vite-plugin-sitemap';

// SEO: 빌드 시 sitemap.xml / robots.txt 자동 생성
export default defineConfig({
  plugins: [
    react(),
    sitemap({
      hostname: 'https://innowave.ai',
      dynamicRoutes: ['/workflow', '/pricing', '/cases', '/about'],
      exclude: ['/admin', '/dashboard'],
      robots: [
        { userAgent: '*', allow: '/', disallow: ['/admin', '/dashboard'] },
        // GEO: 생성형 AI 크롤러 허용 (LLM 검색 노출)
        { userAgent: 'GPTBot', allow: '/' },
        { userAgent: 'ClaudeBot', allow: '/' },
        { userAgent: 'PerplexityBot', allow: '/' },
        { userAgent: 'Google-Extended', allow: '/' },
      ],
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
