import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs'; // Import thư viện quản lý file

// Khởi tạo Firebase Admin
if (!admin.apps.length) {
  try {
    // 1. Xác định đường dẫn file tại thư mục gốc (nơi chứa package.json)
    const filePath = path.join(process.cwd(), 'service-account.json');
    
    // 2. Kiểm tra và đọc file bằng fs thay vì require
    if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const serviceAccount = JSON.parse(fileContent);

        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        console.log("🔥 Firebase Admin đã khởi động thành công!");
    } else {
        console.error("❌ LỖI: Không tìm thấy file service-account.json tại:", filePath);
        console.error("👉 Hãy chắc chắn bạn đã đổi tên file tải về thành 'service-account.json' và để nó cạnh file package.json");
    }
  } catch (error) {
    console.error('❌ Lỗi khởi tạo Firebase Admin:', error.message);
  }
}

export default async function handler(req, res) {
  // Chỉ chấp nhận method POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { phone, newPassword } = req.body;

  if (!phone || !newPassword) {
    return res.status(400).json({ message: 'Thiếu số điện thoại hoặc mật khẩu mới' });
  }

  try {
    // Tái tạo lại email ảo
    const fakeEmail = `${phone}@eduarena.vn`;

    // Tìm user
    const userRecord = await admin.auth().getUserByEmail(fakeEmail);

    // Cập nhật mật khẩu
    await admin.auth().updateUser(userRecord.uid, {
      password: newPassword,
    });

    console.log(`✅ Đã đổi mật khẩu cho SĐT: ${phone}`);
    return res.status(200).json({ message: 'Success' });

  } catch (error) {
    console.error("❌ Lỗi Reset Password:", error);
    
    if (error.code === 'auth/user-not-found') {
        return res.status(404).json({ message: 'Không tìm thấy tài khoản với số điện thoại này.' });
    }
    
    return res.status(500).json({ message: 'Lỗi hệ thống: ' + error.message });
  }
}