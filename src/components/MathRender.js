// src/components/MathRender.js
import React, { useEffect, useRef, memo } from 'react';
import renderMathInElement from 'katex/dist/contrib/auto-render';
import 'katex/dist/katex.min.css';

const MathRender = ({ content, className }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current && content) {
      // BƯỚC 1: Gán nội dung thủ công để tránh React ghi đè
      containerRef.current.innerHTML = String(content);

      // BƯỚC 2: Gọi KaTeX để biến đổi $...$ thành công thức đẹp
      renderMathInElement(containerRef.current, {
        delimiters: [
          { left: '$$', right: '$$', display: false },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false },
          { left: '\\\\[', right: '\\\\]', display: false },
          { left: '\\[', right: '\\]', display: false },
        ],
        throwOnError: false,
      });
    }
  }, [content]); // Chỉ chạy lại khi nội dung câu hỏi thay đổi

  // QUAN TRỌNG: Không dùng dangerouslySetInnerHTML ở đây
  // Để React không tự động reset nội dung khi component cha re-render
  return <span ref={containerRef} className={className} />;
};

// Sử dụng memo để tối ưu, giúp component không render lại nếu content không đổi
export default memo(MathRender);