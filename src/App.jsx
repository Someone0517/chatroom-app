import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./services/firebaseConfig";

import LoginPage from "./pages/LoginPage";
import ChatRoomPage from "./pages/ChatRoomPage";
import NotificationManager from './components/NotificationManager'; // 💡 引入隱形通知元件

function App() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // 新增 loading 狀態

  // 監聽 Firebase 登入狀態
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoading(false); // 狀態確認完畢，解除 loading
    });
    return () => unsubscribe();
  }, []);

  // 在 Firebase 確認完登入狀態前，先顯示載入中，避免畫面閃爍
  if (isLoading) {
    return <div>載入中...</div>;
  }

  return (
    <BrowserRouter>
      {/* 💡 UI 改善：將隱形通知元件掛載於此，只要有登入 (user 存在) 就會在背景默默運作 */}
      {user && <NotificationManager user={user} />}
      
      <Routes>
        {/* 路由守衛邏輯：
          如果未登入 (!user)，造訪首頁會被強制導向 (Navigate) 到 /login
          如果已登入，則顯示 ChatRoomPage，並把 user 資料當作 props 傳進去 
        */}
        <Route 
          path="/" 
          element={user ? <ChatRoomPage user={user} /> : <Navigate to="/login" replace />} 
        />
        
        {/* 如果已登入的使用者試圖造訪 /login，強制導向回首頁 
        */}
        <Route 
          path="/login" 
          element={user ? <Navigate to="/" replace /> : <LoginPage />} 
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;