/**
 * DOM 영역 → A4 PDF 다운로드 (한글 폰트 이슈를 피하기 위해 캔버스 렌더 방식 사용)
 * jspdf/html2canvas는 무거워서 클릭 시점에 동적 로드한다.
 *
 * 페이지 구성: 캔버스를 페이지 단위로 잘라 각 페이지의 여백(상 14 / 하 16 / 좌우 12mm)
 * 안쪽 콘텐츠 박스에 그린다 — 어떤 페이지에서도 내용이 종이 가장자리에 붙지 않는다.
 */
const PAGE_W = 210;   // A4 (mm)
const PAGE_H = 297;
const MARGIN_X = 12;
const MARGIN_TOP = 14;
const MARGIN_BOTTOM = 16;

export async function downloadElementAsPdf(element: HTMLElement, fileName: string): Promise<void> {
  const [{ jsPDF }, html2canvasModule] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);
  const html2canvas = html2canvasModule.default;

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#F6F9FF',
    windowWidth: Math.max(element.scrollWidth, 860),
  });

  const contentW = PAGE_W - MARGIN_X * 2;
  const contentH = PAGE_H - MARGIN_TOP - MARGIN_BOTTOM;
  const pxPerMm = canvas.width / contentW;           // 콘텐츠 폭 기준 환산 비율
  const pageHeightPx = Math.floor(contentH * pxPerMm); // 한 페이지에 들어가는 캔버스 높이(px)
  const pageCount = Math.max(1, Math.ceil(canvas.height / pageHeightPx));

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  for (let page = 0; page < pageCount; page += 1) {
    if (page > 0) pdf.addPage();

    const sourceY = page * pageHeightPx;
    const sliceHeightPx = Math.min(pageHeightPx, canvas.height - sourceY);

    // 페이지 분량만 잘라낸 임시 캔버스 — 여백 영역으로 내용이 흘러넘치지 않게 한다
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = sliceHeightPx;
    const ctx = slice.getContext('2d');
    if (!ctx) throw new Error('PDF 생성 중 캔버스 컨텍스트를 만들지 못했습니다');
    ctx.fillStyle = '#F6F9FF';
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, sourceY, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);

    const sliceHeightMm = sliceHeightPx / pxPerMm;
    pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', MARGIN_X, MARGIN_TOP, contentW, sliceHeightMm);

    // 하단 여백에 페이지 번호 (영문/숫자라 기본 폰트로 안전)
    pdf.setFontSize(9);
    pdf.setTextColor(154, 163, 184); // #9AA3B8
    pdf.text(`${page + 1} / ${pageCount}`, PAGE_W / 2, PAGE_H - MARGIN_BOTTOM / 2, { align: 'center' });
    pdf.text('INNOWAVE', MARGIN_X, PAGE_H - MARGIN_BOTTOM / 2);
  }

  pdf.save(fileName);
}
