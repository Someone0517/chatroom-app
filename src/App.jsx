import { useState, useEffect } from "react";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  onAuthStateChanged,
  signOut
} from "firebase/auth";
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp 
} from "firebase/firestore";
import { auth, db } from "./services/firebaseConfig";

function App() {
  // 狀態管理
  const [user, setUser] = useState(null); // 儲存當前使用者
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [messages, setMessages] = useState([]); // 儲存留言列表
  const [newMessage, setNewMessage] = useState(""); // 儲存輸入框的留言

  // 監聽使用者登入狀態
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe(); // 元件卸載時清除監聽
  }, []);

  // 監聽資料庫留言 (當有使用者登入時)
  useEffect(() => {
    if (!user) return;

    // 建立查詢：針對 "messages" 集合，依照時間排序
    const q = query(collection(db, "messages"), orderBy("createdAt", "asc"));
    
    // onSnapshot 會即時監聽資料庫變化
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [user]);

  // 註冊邏輯
  const handleSignUp = async (e) => {
    e.preventDefault();
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      alert("註冊成功！");
    } catch (error) {
      alert("註冊失敗：" + error.message);
    }
  };

  // 登入邏輯
  const handleSignIn = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      alert("登入失敗：" + error.message);
    }
  };

  // 登出邏輯
  const handleSignOut = () => {
    signOut(auth);
  };

  // 發送留言邏輯
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (newMessage.trim() === "") return;

    try {
      // 寫入資料到 Firestore 的 "messages" 集合
      await addDoc(collection(db, "messages"), {
        text: newMessage,
        userEmail: user.email,
        createdAt: serverTimestamp() // 讓 Firebase 伺服器產生統一時間戳記
      });
      setNewMessage(""); // 清空輸入框
    } catch (error) {
      alert("發送失敗：" + error.message);
    }
  };

  // UI 渲染邏輯：如果未登入，顯示登入/註冊表單；若已登入，顯示留言板
  if (!user) {
    return (
      <div style={{ padding: "20px" }}>
        <h2>會員登入與註冊</h2>
        <form>
          <input 
            type="email" 
            placeholder="Email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
          />
          <input 
            type="password" 
            placeholder="密碼" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
          />
          <br /><br />
          <button onClick={handleSignIn}>登入</button>
          <button onClick={handleSignUp} style={{ marginLeft: "10px" }}>註冊</button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px" }}>
      <h2>簡易留言板</h2>
      <p>目前登入者：{user.email} <button onClick={handleSignOut}>登出</button></p>
      
      <div style={{ height: "300px", overflowY: "auto", border: "1px solid #ccc", marginBottom: "10px", padding: "10px" }}>
        {messages.map((msg) => (
          <div key={msg.id} style={{ marginBottom: "10px" }}>
            <strong>{msg.userEmail}:</strong> {msg.text}
          </div>
        ))}
      </div>

      <form onSubmit={handleSendMessage}>
        <input 
          type="text" 
          placeholder="輸入留言..." 
          value={newMessage} 
          onChange={(e) => setNewMessage(e.target.value)} 
          style={{ width: "70%" }}
        />
        <button type="submit" style={{ width: "20%" }}>送出</button>
      </form>
    </div>
  );
}

export default App;