// File: src/utils/exportForm.js

// ---------------------------------------------------------
// 1. HÀM XUẤT ĐƠN ĐỀ NGHỊ CÔNG NHẬN SÁNG KIẾN
// ---------------------------------------------------------
export const exportApplicationFormToWord = (initiativeData) => {
  const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset="utf-8"><style>body { font-family: 'Times New Roman', serif; font-size: 14pt; line-height: 1.5; } h1, h2 { font-family: 'Times New Roman', serif; font-weight: bold; text-align: center; } h1 { font-size: 14pt; text-transform: uppercase; margin-top: 12pt; } h2 { font-size: 14pt; text-transform: uppercase; margin-top: 24pt; } p { text-align: justify; margin: 6pt 0; } .center { text-align: center; } @page { size: 21cm 29.7cm; margin: 2cm 2cm 2cm 3cm; mso-page-orientation: portrait; } .Section1 { page: Section1; }</style></head><body><div class="Section1">`;
  const measuresList = initiativeData.measures.map((m, i) => `<p>- Bước ${i + 1}: ${m.title.replace(/^(Biện pháp|Giải pháp)\s*\d*[\.\:\-\s]+/i, '').replace(/^\d+[\.\:\-\s]+/i, '').trim()}</p>`).join('');
  let content = `
    <p class="center"><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM<br/>Độc lập – Tự do – Hạnh Phúc</strong></p><br/>
    <p class="center"><strong>ĐƠN ĐỀ NGHỊ CÔNG NHẬN SÁNG KIẾN</strong></p>
    <p><strong>Kính gửi:</strong> Hội đồng khoa học chấm Sáng kiến Sở Giáo dục và Đào tạo tỉnh ${initiativeData.department}</p>
    <p><strong>1. Tôi tên là:</strong> ${initiativeData.authorName}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<strong>Sinh ngày:</strong> ${initiativeData.dob || '......................................'}</p>
    <p><strong>- Nơi công tác:</strong> ${initiativeData.school}</p>
    <p><strong>- Chức danh:</strong> Giáo viên &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <strong>Trình độ chuyên môn:</strong> ${initiativeData.jobTitle}</p>
    <p><strong>- Tỉ lệ (%) đóng góp vào việc tạo ra sáng kiến:</strong> 100%.</p>
    <p><strong>2. Chủ đầu tư tạo ra sáng kiến:</strong> ${initiativeData.authorName}</p>
    <p><strong>3. Mô tả sáng kiến:</strong></p>
    <p><strong>3.1. Tên sáng kiến:</strong> ${initiativeData.title}</p>
    <p><strong>3.2. Lĩnh vực áp dụng sáng kiến:</strong> ${initiativeData.subject}</p>
    <p><strong>3.3. Đánh giá hiện trạng các giải pháp trước khi áp dụng giải pháp mới:</strong></p>
    <p>${initiativeData.context}</p>
    <p><strong>3.4. Mục đích giải pháp mới:</strong></p>
    <p>Khắc phục các hạn chế của thực trạng trên, nhằm nâng cao chất lượng và hiệu quả công tác quản lý, giảng dạy tại đơn vị, đáp ứng yêu cầu chuyển đổi số và đổi mới giáo dục.</p>
    <p><strong>3.5. Nội dung cơ bản của giải pháp:</strong></p>
    <p>Sáng kiến tập trung triển khai đồng bộ các biện pháp trọng tâm nhằm giải quyết vấn đề thực trạng, bao gồm việc xây dựng quy trình, áp dụng phương pháp sư phạm tiên tiến và ứng dụng công nghệ vào thực tiễn trường học.</p>
    <p><strong>3.6. Các bước thực hiện giải pháp:</strong></p>
    ${measuresList}
    <p><strong>3.7. Về khả năng áp dụng của sáng kiến:</strong></p>
    <p>Sáng kiến có khả năng áp dụng hiệu quả tại đơn vị và hoàn toàn có thể nhân rộng ra các trường có cùng điều kiện cơ sở vật chất và đặc thù học sinh tương đương trên toàn tỉnh.</p>
    <p><strong>3.8. Các điều kiện cần thiết để áp dụng sáng kiến:</strong></p>
    <p>Sự quan tâm chỉ đạo của Ban giám hiệu; sự phối hợp của các tổ chức đoàn thể, giáo viên và sự đồng thuận của học sinh. Cơ sở vật chất nhà trường cơ bản đáp ứng yêu cầu triển khai.</p>
    <p><strong>3.9. Đánh giá lợi ích thu được hoặc dự kiến có thể thu được:</strong></p>
    <p>Góp phần nâng cao hiệu quả công tác giáo dục, tiết kiệm thời gian, chi phí quản lý và mang lại tác động xã hội tích cực, tạo môi trường học tập nề nếp, khoa học.</p>
    <p><strong>3.10. Đánh giá lợi ích thu được do áp dụng sáng kiến theo ý kiến tổ chức, cá nhân:</strong> ........................................................................</p>
    <p><strong>3.11. Ngày, nơi áp dụng thử:</strong></p>
    <p>- Ngày áp dụng thử: ..........................................................................</p>
    <p>- Nơi áp dụng thử: ${initiativeData.school}</p>
    <table style="width: 100%; border-collapse: collapse; border: none; margin-top: 30pt;">
      <tr>
        <td style="width: 50%; text-align: center; border: none; vertical-align: top;"></td>
        <td style="width: 50%; text-align: center; border: none; vertical-align: top;">
           <em>................., ngày ..... tháng ..... năm 20...</em><br/>
           <strong>NGƯỜI LÀM ĐƠN</strong><br/><em>(Ký, ghi rõ họ tên)</em><br/><br/><br/><br/><br/>
           <strong>${initiativeData.authorName}</strong>
        </td>
      </tr>
    </table>
  `;
  const footer = `</div></body></html>`;
  const blob = new Blob(['\ufeff', header + content + footer], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `Don_De_Nghi_SKKN.doc`;
  document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
};

// ---------------------------------------------------------
// 2. HÀM XUẤT MẪU 03 - BÁO CÁO HIỆU QUẢ ÁP DỤNG
// ---------------------------------------------------------
export const exportMau03ToWord = (initiativeData) => {
  const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset="utf-8"><style>body { font-family: 'Times New Roman', serif; font-size: 14pt; line-height: 1.5; } h1, h2, h3 { font-family: 'Times New Roman', serif; font-weight: bold; } p { text-align: justify; margin: 6pt 0; } .center { text-align: center; } @page { size: 21cm 29.7cm; margin: 2cm 2cm 2cm 3cm; mso-page-orientation: portrait; } .Section1 { page: Section1; }</style></head><body><div class="Section1">`;
  let content = `
    <table style="width: 100%; border: none;">
      <tr>
        <td style="width: 40%; text-align: center; border: none; font-weight: bold;">CƠ QUAN, ĐƠN VỊ CẤP TRÊN<br/>${initiativeData.school.toUpperCase()}<br/>-----------</td>
        <td style="width: 60%; text-align: center; border: none;"><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM<br/>Độc lập – Tự do – Hạnh phúc</strong><br/><em>................., ngày...... tháng...... năm.......</em></td>
      </tr>
    </table>
    <br/>
    <p class="center" style="font-weight: bold; text-transform: uppercase;">BÁO CÁO</p>
    <p class="center" style="font-weight: bold;">Hiệu quả áp dụng, khả năng nhân rộng của sáng kiến</p>
    <p><strong>I. THÔNG TIN CHUNG</strong></p>
    <p><strong>1. Họ và tên tác giả:</strong> ${initiativeData.authorName}</p>
    <p>- Chức vụ: Giáo viên</p>
    <p>- Cơ quan, địa phương, đơn vị: ${initiativeData.school}</p>
    <p><strong>2. Tên sáng kiến:</strong> ${initiativeData.title}</p>
    <p>Quyết định (Giấy chứng nhận) công nhận: số.../...ngày...tháng...năm... của.......................</p>
    <p><strong>3. Mô tả ngắn gọn nội dung và tính mới của sáng kiến:</strong></p>
    <p>${initiativeData.context}</p>
    <p>Thời gian áp dụng sáng kiến: Từ ngày...tháng... năm... đến ngày...tháng...năm...</p>
    
    <p><strong>II. ĐÁNH GIÁ HIỆU QUẢ ÁP DỤNG, KHẢ NĂNG NHÂN RỘNG</strong></p>
    <p><strong>1. Về hiệu quả kinh tế, lợi ích xã hội:</strong></p>
    <p>Sáng kiến mang lại hiệu quả thiết thực trong việc đổi mới phương pháp làm việc, tiết kiệm thời gian, chi phí quản lý và đóng góp tích cực vào việc nâng cao chất lượng giáo dục toàn diện của nhà trường.</p>
    <p><strong>2. Về khả năng nhân rộng của sáng kiến:</strong></p>
    <p>Hoàn toàn có thể áp dụng nhân rộng mô hình này cho các trường học khác trên địa bàn tỉnh ${initiativeData.department} có cùng quy mô và đặc thù tương tự.</p>
    
    <p><strong>III. CAM KẾT CỦA CÁ NHÂN</strong></p>
    <p>- Không trái với trật tự công cộng hoặc đạo đức xã hội;</p>
    <p>- Không vi phạm các quy định về quyền sở hữu trí tuệ theo quy định của pháp luật.</p>
    
    <p><strong>IV. ĐỀ NGHỊ</strong></p>
    <p>Căn cứ theo quy định hiện hành, đề nghị Hội đồng Sáng kiến tỉnh ${initiativeData.department} đánh giá, trình Chủ tịch Ủy ban nhân dân tỉnh công nhận có phạm vi ảnh hưởng, hiệu quả áp dụng cấp tỉnh cho cá nhân tôi để làm cơ sở xét, tặng danh hiệu thi đua, hình thức khen thưởng theo quy định./.</p>
    
    <table style="width: 100%; border-collapse: collapse; border: none; margin-top: 30pt;">
      <tr>
        <td style="width: 50%; text-align: center; border: none; vertical-align: top;">
           <strong>XÁC NHẬN, ĐỀ NGHỊ<br/>CỦA THỦ TRƯỞNG ĐƠN VỊ</strong><br/>
           <em>(Ký, đóng dấu)</em>
        </td>
        <td style="width: 50%; text-align: center; border: none; vertical-align: top;">
           <strong>NGƯỜI BÁO CÁO</strong><br/>
           <em>(Ký, ghi rõ họ tên)</em><br/>
           <br/><br/><br/><br/><br/>
           <strong>${initiativeData.authorName}</strong>
        </td>
      </tr>
    </table>
  `;
  const footer = `</div></body></html>`;
  const blob = new Blob(['\ufeff', header + content + footer], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `Mau03_BaoCaoHieuQua.doc`;
  document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
};

// ---------------------------------------------------------
// 3. HÀM XUẤT MẪU 04 - GIẤY XÁC NHẬN
// ---------------------------------------------------------
export const exportMau04ToWord = (initiativeData) => {
  const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset="utf-8"><style>body { font-family: 'Times New Roman', serif; font-size: 14pt; line-height: 1.5; } h1, h2, h3 { font-family: 'Times New Roman', serif; font-weight: bold; } p { text-align: justify; margin: 6pt 0; } .center { text-align: center; } @page { size: 21cm 29.7cm; margin: 2cm 2cm 2cm 3cm; mso-page-orientation: portrait; } .Section1 { page: Section1; }</style></head><body><div class="Section1">`;
  let content = `
    <table style="width: 100%; border: none;">
      <tr>
        <td style="width: 40%; text-align: center; border: none; font-weight: bold;">${initiativeData.school.toUpperCase()}<br/>-----------</td>
        <td style="width: 60%; text-align: center; border: none;"><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM<br/>Độc lập – Tự do – Hạnh phúc</strong><br/><em>................., ngày...... tháng...... năm.......</em></td>
      </tr>
    </table>
    <br/>
    <p class="center" style="font-weight: bold; text-transform: uppercase;">GIẤY XÁC NHẬN</p>
    <p class="center" style="font-weight: bold; text-transform: uppercase;">HIỆU QUẢ ÁP DỤNG, KHẢ NĂNG NHÂN RỘNG CỦA SÁNG KIẾN</p>
    
    <p>Tên cơ quan, tổ chức: <strong>${initiativeData.school}</strong></p>
    <p>Xác nhận đã hoặc đang áp dụng có hiệu quả sáng kiến: <strong>${initiativeData.title}</strong></p>
    <p>của tác giả: <strong>${initiativeData.authorName}</strong></p>
    <p>tại đơn vị như sau:</p>
    
    <p><strong>1. Về hiệu quả kinh tế:</strong></p>
    <p>......................................................................................................................................................</p>
    <p><strong>2. Về lợi ích xã hội:</strong></p>
    <p>......................................................................................................................................................</p>
    <p><strong>3. Đánh giá về khả năng nhân rộng của sáng kiến:</strong></p>
    <p>......................................................................................................................................................</p>
    <p><strong>4. Kết luận hiệu quả áp dụng:</strong></p>
    <p>Cơ quan/đơn vị xác nhận sáng kiến “<em>${initiativeData.title}</em>” của ông/bà <strong>${initiativeData.authorName}</strong> đã được triển khai áp dụng tại đơn vị từ tháng...... năm...... đến nay; qua thực tế áp dụng, sáng kiến phù hợp với điều kiện của đơn vị và mang lại hiệu quả thiết thực.</p>
    
    <table style="width: 100%; border-collapse: collapse; border: none; margin-top: 40pt;">
      <tr>
        <td style="width: 50%; text-align: center; border: none; vertical-align: top;"></td>
        <td style="width: 50%; text-align: center; border: none; vertical-align: top;">
           <strong>THỦ TRƯỞNG CƠ QUAN, ĐƠN VỊ</strong><br/>
           <em>(Ký tên, đóng dấu)</em><br/>
           <br/><br/><br/><br/><br/>
        </td>
      </tr>
    </table>
  `;
  const footer = `</div></body></html>`;
  const blob = new Blob(['\ufeff', header + content + footer], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `Mau04_GiayXacNhan.doc`;
  document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
};