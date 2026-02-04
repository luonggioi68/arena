// src/store/useAuthStore.js
import { create } from 'zustand';

// Tạo một cái kho chứa thông tin người dùng
const useAuthStore = create((set) => ({
  user: null, // Mặc định chưa ai đăng nhập
  loading: true, // Đang tải (kiểm tra xem đã đăng nhập chưa)
  
  // Hàm cập nhật user
  setUser: (user) => set({ user: user, loading: false }),
  
  // Hàm đăng xuất
  logout: () => set({ user: null })
}));

export default useAuthStore;