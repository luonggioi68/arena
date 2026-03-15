// File: src/utils/exportWord.js

export const exportInitiativeToWord = (initiativeData) => {
  const header = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' 
          xmlns:w='urn:schemas-microsoft-com:office:word' 
          xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>Sáng kiến kinh nghiệm</title>
      <style>
        body { font-family: 'Times New Roman', serif; font-size: 14pt; line-height: 1.5; }
        
        h1 { font-size: 18pt; text-align: center; text-transform: uppercase; margin-top: 24pt; font-weight: bold; mso-outline-level: 1; }
        h2 { font-size: 14pt; margin-top: 18pt; text-transform: uppercase; font-weight: bold; mso-outline-level: 2; }
        h3 { font-size: 14pt; font-style: italic; margin-top: 12pt; font-weight: bold; mso-outline-level: 3; }
        h4 { font-size: 14pt; font-style: normal; font-weight: bold; margin-top: 12pt; mso-outline-level: 4; }
        
        /* ĐÃ SỬA Ở ĐÂY: Đổi font-weight: normal thành font-weight: bold */
        h5 { font-size: 14pt; font-style: italic; font-weight: bold; margin-top: 6pt; margin-left: 24pt; mso-outline-level: 5; }
        
        p { text-align: justify; margin: 6pt 0; }
        table { border-collapse: collapse; width: 100%; margin: 12pt 0; }
        table, th, td { border: 1px solid black; padding: 6px; }
        .center { text-align: center; }
        
        @page {
            size: 21cm 29.7cm; 
            margin: 2cm 2cm 2cm 3cm; 
            mso-page-orientation: portrait;
        }
        .Section1 { page: Section1; }
      </style>
    </head>
    <body>
    <div class="Section1">
  `;

  let content = `
    <br/><br/><br/>
    <h1>BÁO CÁO SÁNG KIẾN</h1>
    <p class="center" style="font-size: 16pt;"><strong>Tên sáng kiến: ${initiativeData.title}</strong></p>
    
    <br clear=all style='mso-special-character:line-break;page-break-before:always'>
    
    <h2 class="center">MỤC LỤC</h2>
    <div style="border: 1px dashed #ccc; padding: 10px; background-color: #f9f9f9;">
        <p class="MsoNormal">
            <span style='mso-element:field-begin'></span>
            <span style='mso-spacerun:yes'> </span>TOC \\o "1-5" \\h \\z \\u 
            <span style='mso-element:field-separator'></span>
        </p>
        <p style="text-align: center; color: #d97706; font-weight: bold; font-style: italic; margin: 0;">
            👉 HƯỚNG DẪN TẠO MỤC LỤC TỰ ĐỘNG:<br/>
            1. Bấm "Enable Editing" (Bật chỉnh sửa) màu vàng ở góc trên cùng Word.<br/>
            2. Bôi đen toàn bộ khung đứt nét này.<br/>
            3. Nháy chuột phải chọn "Update Field" (hoặc bấm F9).
        </p>
        <p class="MsoNormal">
            <span style='mso-element:field-end'></span>
        </p>
    </div>

    <br/>
    <h2 class="center">DANH MỤC CHỮ VIẾT TẮT</h2>
    <p><em>(Giáo viên tự bổ sung danh mục chữ viết tắt tại đây)</em></p>
    
    <br clear=all style='mso-special-character:line-break;page-break-before:always'>
  `;

  if (initiativeData.introContent) {
      content += initiativeData.introContent;
  } else {
      content += `
        <h2>1. MỞ ĐẦU</h2>
        <h3>1.1. Lý do chọn đề tài</h3><p><em>(Chưa có nội dung)</em></p>
        <h3>1.2. Mục đích nghiên cứu</h3><p><em>(Chưa có nội dung)</em></p>
        <h3>1.3. Đối tượng nghiên cứu</h3><p><em>(Chưa có nội dung)</em></p>
        <h3>1.4. Phương pháp nghiên cứu</h3><p><em>(Chưa có nội dung)</em></p>
        <h3>1.5. Giới hạn phạm vi nghiên cứu</h3><p><em>(Chưa có nội dung)</em></p>
        <h2>2. NỘI DUNG</h2>
        <h3>2.1. Cơ sở lý luận của vấn đề</h3><p><em>(Chưa có nội dung)</em></p>
        <h3>2.2. Thực trạng của vấn đề</h3><p>Bối cảnh thực trạng: ${initiativeData.context}</p>
      `;
  }

  content += `<h3>2.3. Các giải pháp đã tiến hành để giải quyết vấn đề</h3>`;

  initiativeData.measures.forEach((measure, index) => {
    // Lọc sạch tên Giải pháp
    let cleanTitle = measure.title
        .replace(/^(Biện pháp|Giải pháp)\s*\d*[\.\:\-\s]+/i, '') 
        .replace(/^\d+[\.\:\-\s]+/i, '') 
        .trim();
    
    let measureContent = measure.content ? measure.content : '<p><em>(Chưa tạo nội dung chi tiết cho giải pháp này)</em></p>';

    // THUẬT TOÁN BÀN TAY SẮT: Gọt sạch số sai của AI và ép lại đúng số thứ tự
    measureContent = measureContent.replace(/<h[456][^>]*>.*?(Mục đích.*?)<\/h[456]>/gi, `<h5>2.3.${index + 1}.1. $1</h5>`);
    measureContent = measureContent.replace(/<h[456][^>]*>.*?(Cách thức.*?)<\/h[456]>/gi, `<h5>2.3.${index + 1}.2. $1</h5>`);
    measureContent = measureContent.replace(/<h[456][^>]*>.*?(Ví dụ.*?)<\/h[456]>/gi, `<h5>2.3.${index + 1}.3. $1</h5>`);

    content += `
      <h4>2.3.${index + 1}. ${cleanTitle}</h4>
      ${measureContent}
    `;
  });

  if (initiativeData.conclusionContent) {
      content += initiativeData.conclusionContent;
  } else {
      content += `
        <h3>2.4. Kết quả đạt được</h3><p><em>(Chưa có nội dung)</em></p>
        <h2>3. KẾT LUẬN VÀ KIẾN NGHỊ</h2>
        <h3>3.1. Kết luận</h3><p><em>(Chưa có nội dung)</em></p>
        <h3>3.2. Kiến nghị</h3><p><em>(Chưa có nội dung)</em></p>
      `;
  }

  content += `
    <table style="width: 100%; border-collapse: collapse; border: none; margin-top: 40pt;">
      <tr>
        <td style="width: 50%; text-align: center; border: none; vertical-align: top;">
           <strong>XÁC NHẬN CỦA BAN GIÁM HIỆU</strong><br/>
           <em>(Ký, đóng dấu)</em>
        </td>
        <td style="width: 50%; text-align: center; border: none; vertical-align: top;">
           <em>................., ngày ..... tháng ..... năm 20...</em><br/>
           <strong>NGƯỜI VIẾT SÁNG KIẾN</strong><br/>
           <em>(Ký, ghi rõ họ tên)</em><br/>
           <br/><br/><br/><br/><br/>
           <strong>${initiativeData.authorName}</strong>
        </td>
      </tr>
    </table>
  `;

  content += `
    <br clear=all style='mso-special-character:line-break;page-break-before:always'>
    <h2 class="center">TÀI LIỆU THAM KHẢO</h2>
    <p><em>1. ..........................................................................................................</em></p>
    <p><em>2. ..........................................................................................................</em></p>
    <p><em>3. ..........................................................................................................</em></p>
  `;

  const footer = `</div></body></html>`;
  const fullHTML = header + content + footer;
  const blob = new Blob(['\ufeff', fullHTML], { type: 'application/msword' });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeTitle = initiativeData.title.substring(0, 30).replace(/[^a-zA-Z0-9 ]/g, "");
  link.download = `BaoCao_SKKN_${safeTitle || 'BanNhap'}.doc`;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};