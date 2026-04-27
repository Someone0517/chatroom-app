import { signOut } from "firebase/auth";
import { auth } from "../services/firebaseConfig";

function ChatRoomPage({ user }) {
  const handleSignOut = () => {
    signOut(auth);
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>聊天室大廳</h2>
      <p>目前登入者：{user?.email}</p>
      <button onClick={handleSignOut}>登出</button>
    </div>
  );
}

export default ChatRoomPage;