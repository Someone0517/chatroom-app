import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword 
} from "firebase/auth";
import { auth } from "../services/firebaseConfig";

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  
  // useNavigate 是 react-router-dom 提供的 Hook，用來透過程式碼切換頁面
  const navigate = useNavigate();

  // 註冊邏輯
  const handleSignUp = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      // 註冊成功後，Firebase 會自動登入，這時我們將使用者導向聊天室首頁
      navigate("/");
    } catch (error) {
      setErrorMsg("註冊失敗：" + error.message);
    }
  };

  // 登入邏輯
  const handleSignIn = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // 登入成功，導向聊天室首頁
      navigate("/");
    } catch (error) {
      setErrorMsg("登入失敗：" + error.message);
    }
  };

  return (
    <div style={{ maxWidth: "400px", margin: "50px auto", padding: "20px", border: "1px solid #ccc", borderRadius: "8px" }}>
      <h2>會員登入與註冊</h2>
      {errorMsg && <p style={{ color: "red" }}>{errorMsg}</p>}
      
      <form style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <input 
          type="email" 
          placeholder="請輸入 Email" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
          required
        />
        <input 
          type="password" 
          placeholder="請輸入密碼" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          required
        />
        <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
          <button type="button" onClick={handleSignIn} style={{ flex: 1 }}>登入</button>
          <button type="button" onClick={handleSignUp} style={{ flex: 1 }}>註冊</button>
        </div>
      </form>
    </div>
  );
}

export default LoginPage;