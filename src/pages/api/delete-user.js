import { adminAuth, adminFirestore } from '@/lib/firebaseAdmin';

export default async function handler(req, res) {
    // Chỉ chấp nhận method POST
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Chỉ chấp nhận phương thức POST' });
    }

    const { uid, collectionName } = req.body;

    if (!uid) {
        return res.status(400).json({ message: 'Thiếu UID của người dùng' });
    }

    try {
        // 1. Xóa tài khoản vĩnh viễn khỏi Firebase Authentication
        await adminAuth.deleteUser(uid);
        console.log(`Đã xóa user ${uid} khỏi Authentication`);

        // 2. Xóa hồ sơ khỏi Firestore (bảng users hoặc student_profiles)
        if (collectionName) {
            await adminFirestore.collection(collectionName).doc(uid).delete();
            console.log(`Đã xóa hồ sơ ${uid} khỏi bảng ${collectionName}`);
        }

        return res.status(200).json({ message: 'Đã xóa tận gốc tài khoản thành công!' });
        
    } catch (error) {
        console.error('Lỗi khi xóa tài khoản:', error);
        
        // Nếu không tìm thấy trong Auth (có thể do đã xóa trước đó rồi), thì vẫn cố xóa nốt trong Firestore cho sạch
        if (error.code === 'auth/user-not-found') {
            if (collectionName) {
                await adminFirestore.collection(collectionName).doc(uid).delete();
            }
            return res.status(200).json({ message: 'Tài khoản không có trong Auth, nhưng đã dọn dẹp sạch Firestore.' });
        }

        return res.status(500).json({ message: 'Lỗi server: ' + error.message });
    }
}