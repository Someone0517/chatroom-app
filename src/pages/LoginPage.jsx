import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signInWithPopup,      // 新增引入
  GoogleAuthProvider     // 新增引入
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "../services/firebaseConfig";

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const navigate = useNavigate();

  // 封裝「將使用者資料同步到 Firestore」的邏輯，避免重複程式碼
  const syncUserToFirestore = async (user) => {
    const userDocRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userDocRef);
    
    // 如果資料庫還沒有這份資料，才寫入 (Google 登入可能多次使用)
    if (!userSnap.exists()) {
      await setDoc(userDocRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email.split('@')[0],
      });
    }
  };

  // 1. Google 登入邏輯
  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      await syncUserToFirestore(result.user);
      navigate("/");
    } catch (error) {
      setErrorMsg("Google 登入失敗：" + error.message);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await syncUserToFirestore(userCredential.user);
      navigate("/");
    } catch (error) {
      setErrorMsg("註冊失敗：" + error.message);
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/");
    } catch (error) {
      setErrorMsg("登入失敗：" + error.message);
    }
  };

  return (
    <div style={{
      height: "100vh", width: "100vw", display: "flex", justifyContent: "center", alignItems: "center",
      backgroundColor: "#000000", margin: 0, fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif"
    }}>
      <div style={{
        backgroundColor: "#1c1c1e", padding: "40px", borderRadius: "16px", width: "100%", maxWidth: "320px",
        boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
      }}>
        <h2 style={{ color: "#ffffff", textAlign: "center", marginBottom: "30px", fontWeight: "500" }}>ChatApp</h2>
        
        {errorMsg && <p style={{ color: "#ff453a", fontSize: "14px", textAlign: "center", marginBottom: "15px" }}>{errorMsg}</p>}
        
        <form style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <input 
            type="email" placeholder="Email" value={email} 
            onChange={(e) => setEmail(e.target.value)} required
            style={{ padding: "14px", borderRadius: "10px", border: "none", backgroundColor: "#2c2c2e", color: "#ffffff", fontSize: "16px", outline: "none" }}
          />
          <input 
            type="password" placeholder="Password" value={password} 
            onChange={(e) => setPassword(e.target.value)} required
            style={{ padding: "14px", borderRadius: "10px", border: "none", backgroundColor: "#2c2c2e", color: "#ffffff", fontSize: "16px", outline: "none" }}
          />
          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            <button type="button" onClick={handleSignIn} style={{ flex: 1, padding: "14px", borderRadius: "10px", border: "none", backgroundColor: "#0a84ff", color: "white", fontSize: "16px", fontWeight: "bold", cursor: "pointer" }}>登入</button>
            <button type="button" onClick={handleSignUp} style={{ flex: 1, padding: "14px", borderRadius: "10px", border: "1px solid #0a84ff", backgroundColor: "transparent", color: "#0a84ff", fontSize: "16px", fontWeight: "bold", cursor: "pointer" }}>註冊</button>
          </div>
        </form>

        {/* 分隔線 */}
        <div style={{ display: "flex", alignItems: "center", margin: "20px 0", gap: "10px" }}>
          <div style={{ flex: 1, height: "1px", backgroundColor: "#333" }}></div>
          <span style={{ color: "#666", fontSize: "12px" }}>OR</span>
          <div style={{ flex: 1, height: "1px", backgroundColor: "#333" }}></div>
        </div>

        {/* Google 登入按鈕 */}
        <button 
          onClick={handleGoogleLogin}
          style={{
            width: "100%", padding: "14px", borderRadius: "10px", border: "1px solid #ffffff",
            backgroundColor: "#ffffff", color: "#000000", fontSize: "16px", fontWeight: "600", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "10px"
          }}
        >
          使用 Google 帳號登入
        </button>
      </div>
    </div>
  );
}

export default LoginPage;