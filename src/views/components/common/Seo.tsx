import { Helmet } from 'react-helmet-async';

const SITE = 'https://innowave.ai';

export interface SeoProps {
  title?: string;
  description?: string;
  path?: string;
  jsonLd?: Record<string, unknown> | null;
}

/**
 * 페이지별 SEO/GEO 메타 컴포넌트
 * - title/description/canonical/OG 오버라이드
 * - jsonLd로 페이지 단위 구조화 데이터 삽입 (GEO: FAQ, Breadcrumb 등)
 */
export function Seo({ title, description, path = '/', jsonLd = null }: SeoProps) {
  const fullTitle = title ? `${title} | INNOWAVE` : 'INNOWAVE — AI 행사 기획·견적 자동화 플랫폼';
  const url = `${SITE}${path}`;
  return (
    <Helmet>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      <link rel="canonical" href={url} />
      <meta property="og:title" content={fullTitle} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:url" content={url} />
      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
}
