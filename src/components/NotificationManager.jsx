import { useEffect, useRef } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../services/firebaseConfig";

export default function NotificationManager({ user }) {
  // 使用 useRef 紀錄初次載入狀態與每個房間最後的更新時間
  const initialLoad = useRef(true);
  const roomTimestamps = useRef({});

  useEffect(() => {
    if (!user) return;

    // 1. 向使用者要求 Chrome 桌面通知權限
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    // 2. 在背景監聽該使用者的所有聊天室
    const q = query(collection(db, "chats"), where("participants", "array-contains", user.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      // 初次載入時，只記錄當下時間，不發出通知
      if (initialLoad.current) {
        snapshot.docs.forEach(doc => {
          roomTimestamps.current[doc.id] = doc.data().updatedAt?.toMillis() || 0;
        });
        initialLoad.current = false;
        return;
      }

      // 監聽後續的資料變化
      snapshot.docChanges().forEach((change) => {
        const data = change.doc.data();
        const roomId = change.doc.id;
        const newTime = data.updatedAt?.toMillis() || 0;
        const oldTime = roomTimestamps.current[roomId] || 0;

        // 判斷條件：房間有更新，且「我的未讀數量大於 0」 (過濾掉自己發送訊息觸發的更新)
        if ((change.type === "modified" || change.type === "added") && newTime > oldTime) {
          roomTimestamps.current[roomId] = newTime;

          if (data.unreadCount?.[user.uid] > 0) {
            
            // 確保使用者已允許通知，且為了避免吵擾，只在網頁被隱藏(切換到其他分頁)時才跳出原生通知
            if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
              
              // 決定通知標題
              let title = "新訊息";
              if (data.type === "group") {
                title = `群組: ${data.groupName}`;
              } else {
                const friendEmail = data.participantEmails?.find(e => e !== user.email);
                if (friendEmail) title = `來自 ${friendEmail.split('@')[0]} 的訊息`;
              }

              // 發送 Chrome 原生通知
              const notification = new Notification(title, {
                body: data.lastMessageText || "您有一則新訊息",
                icon: "https://cdn-icons-png.flaticon.com/512/1041/1041916.png", // 預設的訊息圖示
              });

              // 點擊通知時，自動跳回該網頁分頁
              notification.onclick = () => {
                window.focus();
                notification.close();
              };
            }
          }
        }
      });
    });

    return () => unsubscribe();
  }, [user]);

  // 這個元件完全不渲染任何 HTML，只處理背景邏輯
  return null; 
}