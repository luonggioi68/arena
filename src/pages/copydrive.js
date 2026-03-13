import { useEffect } from 'react';

export default function CopyDrivePage() {
  useEffect(() => {
    const scriptUrl = "https://script.google.com/macros/s/AKfycbxSxxQVNYar585uFy60A7HHxemW-3M84tIzjuJ7OBhsSDzHCawtLtVNxkA_FOPQAko/exec";

    // 1. Container chính
    const container = document.createElement('div');
    container.id = "drive-wrapper";
    container.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100vh;
        overflow: hidden; background: #000; z-index: 9999; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    `;

    // 2. Iframe ứng dụng
    const iframe = document.createElement('iframe');
    iframe.src = scriptUrl;
    iframe.style.cssText = `
        position: absolute; top: -38px; left: 0; width: 100%; height: calc(100% + 38px); border: none;
    `;

    // 3. Nút Mở Tab Mới (Dưới cùng bên trái)
    const openBtn = document.createElement('a');
    openBtn.innerHTML = "🔗 Mở Tab Mới (Nếu lỗi)";
    openBtn.href = scriptUrl;
    openBtn.target = "_blank";
    openBtn.style.cssText = `
        position: absolute; bottom: 20px; left: 20px; padding: 8px 15px;
        background: rgba(255, 255, 255, 0.1); color: #ccc; text-decoration: none;
        border-radius: 5px; font-size: 12px; z-index: 10001; border: 1px solid #444;
    `;

    // 4. Nút BÍ KÍP TÂN THỦ (Dưới cùng bên phải)
    const guideBtn = document.createElement('button');
    guideBtn.innerHTML = "📖 BÍ KÍP TÂN THỦ";
    guideBtn.style.cssText = `
        position: absolute; bottom: 20px; right: 20px; padding: 10px 20px;
        background: linear-gradient(45deg, #f093fb 0%, #f5576c 100%);
        color: white; border: none; border-radius: 25px; font-weight: bold;
        cursor: pointer; z-index: 10001; box-shadow: 0 4px 15px rgba(245, 87, 108, 0.4);
    `;

    // 5. Modal hướng dẫn (Ẩn mặc định)
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.85); display: none; align-items: center;
        justify-content: center; z-index: 10002; backdrop-filter: blur(5px);
    `;

    const content = document.createElement('div');
    content.style.cssText = `
        background: #1a1a1a; color: #eee; width: 90%; max-width: 500px;
        padding: 30px; border-radius: 15px; border: 1px solid #f5576c;
        line-height: 1.6; position: relative; max-height: 80vh; overflow-y: auto;
    `;

    content.innerHTML = `
        <h2 style="text-align: center; color: #f5576c; margin-top: 0;">📖 BÍ KÍP TÂN THỦ 📖</h2>
        <p><strong>🕹️ Bước 1: CHỌN NGUỒN</strong><br>Dán link hoặc ID vào ô Thư Mục HOẶC ô Tệp. Khi nhập một ô, ô kia sẽ tự động mờ đi. Không nhập cả hai cùng lúc!</p>
        <p><strong>⛺ Bước 2: CHỌN ĐÍCH (BASE)</strong><br>Ô Căn Cứ Đích quy định nơi file sẽ về Drive CỦA BẠN.<br>- Bỏ trống: Về Drive gốc.<br>- Dán link/ID: Về thư mục đó.</p>
        <p><strong>🔑 Bước 3: CẤP QUYỀN (1 LẦN)</strong><br>Bấm Nâng cao (Advanced) -> Đi tới Arena -> Cho phép (Allow). Tool chỉ mượn quyền để ghi file chính bạn.</p>
        <p><strong>⚡ Bước 4: VẬN TIÊU (COPY)</strong><br>Bấm nút "Khởi động sao chép" rực lửa. Đừng đóng trình duyệt cho đến khi hiện màu xanh lá cây.</p>
        <button id="close-guide" style="width: 100%; padding: 10px; margin-top: 10px; background: #444; color: white; border: none; border-radius: 5px; cursor: pointer;">ĐÃ HIỂU</button>
    `;

    // Sự kiện đóng/mở modal
    guideBtn.onclick = () => modal.style.display = 'flex';
    modal.onclick = (e) => { if(e.target === modal) modal.style.display = 'none'; };
    
    // 6. Nhúng vào trang
    modal.appendChild(content);
    container.appendChild(iframe);
    container.appendChild(openBtn);
    container.appendChild(guideBtn);
    container.appendChild(modal);
    document.body.appendChild(container);

    // Gán sự kiện cho nút "Đã hiểu" sau khi render
    document.getElementById('close-guide').onclick = () => modal.style.display = 'none';

    document.body.style.overflow = "hidden";
    return () => {
      const el = document.getElementById("drive-wrapper");
      if (el) el.remove();
      document.body.style.overflow = "auto";
    };
  }, []);

  return null;
}