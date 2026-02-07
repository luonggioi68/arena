// components/MathRender.js
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css'; // Import CSS của KaTeX

const MathRender = ({ content, className = "" }) => {
  // Xử lý xuống dòng: Thay thế \n bằng 2 dấu cách + \n để Markdown hiểu là xuống dòng
  const processedContent = content ? content.replace(/\n/g, '  \n') : "";

  return (
    <div className={`math-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // Tùy chỉnh thẻ p để không bị vỡ layout khi nhúng vào nút bấm
          p: ({node, ...props}) => <span {...props} />,
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};

export default MathRender;