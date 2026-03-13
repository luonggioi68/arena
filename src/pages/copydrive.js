import { useEffect } from 'react';

export default function CopyDrivePage() {
  useEffect(() => {
    const scriptUrl = "https://script.google.com/macros/s/AKfycbxImhTa9NRDwGvZff8EqL5YXseDzr0wnR2hYOotnOWTJUhx2o8ermHvyqBB3l_sxSr2/exec";

    // 1. Tạo Container chính
    const container = document.createElement('div');
    container.id = "drive-wrapper";
    container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100vh;
        overflow: hidden;
        background: #000;
        z-index: 9999;
    `;

    // 2. Tạo Iframe
    const iframe = document.createElement('iframe');
    iframe.src = scriptUrl;
    iframe.style.cssText = `
        position: absolute;
        top: -38px; 
        left: 0;
        width: 100%;
        height: calc(100% + 38px); 
        border: none;
    `;

    // 3. Tạo Nút "Mở trong tab mới" (Để fix lỗi Google 403)
    const openBtn = document.createElement('a');
    openBtn.innerHTML = "🔗 Nếu trang không hiển thị, bấm vào đây";
    openBtn.href = scriptUrl;
    openBtn.target = "_blank"; // Mở tab mới
    openBtn.style.cssText = `
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 10px 20px;
        background: rgba(255, 69, 0, 0.8); /* Màu cam đỏ giống tone Arena */
        color: white;
        text-decoration: none;
        border-radius: 25px;
        font-family: sans-serif;
        font-size: 14px;
        font-weight: bold;
        z-index: 10000;
        box-shadow: 0 4px 15px rgba(0,0,0,0.5);
        transition: 0.3s;
        border: 1px solid rgba(255,255,255,0.2);
    `;
    
    // Hiệu ứng hover cho nút
    openBtn.onmouseover = () => openBtn.style.background = "rgba(255, 69, 0, 1)";
    openBtn.onmouseout = () => openBtn.style.background = "rgba(255, 69, 0, 0.8)";

    // 4. Nhúng các phần tử
    container.appendChild(iframe);
    container.appendChild(openBtn);
    document.body.appendChild(container);

    // Chống cuộn trang web chính
    document.body.style.overflow = "hidden";

    return () => {
      const el = document.getElementById("drive-wrapper");
      if (el) el.remove();
      document.body.style.overflow = "auto";
    };
  }, []);

  return null;
}