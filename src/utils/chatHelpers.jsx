import React from "react";

export const formatTime = (ts) => {
  if (!ts) return "";
  const d = ts.toDate(), n = new Date(), diff = (n - d) / 60000;
  if (diff < 60 && diff >= 0) return diff < 1 ? "剛剛" : `${Math.floor(diff)}分鐘前`;
  if (d.toDateString() === n.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

export const renderAvatar = (config, fallbackName) => {
  if (config?.image) return <img src={config.image} alt="avatar" style={{width:'100%', height:'100%', objectFit:'cover'}} />;
  if (config?.emoji) return <span style={{fontSize:'18px'}}>{config.emoji}</span>;
  return fallbackName?.charAt(0).toUpperCase() || "👤";
};

export const getFriendDynamicName = (room, roomMembersInfo, user) => {
  if (!room) return "";
  if (room.type === "group") return room.groupName || "群組";
  
  const friendUid = room.participants.find(uid => uid !== user.uid);
  const friendInfo = roomMembersInfo.find(m => m.uid === friendUid);
  
  // 如果對方封鎖了你，強制顯示未知
  if (friendInfo?.blockedUsers?.includes(user.uid)) return "未知";
  
  if (friendInfo && friendInfo.displayName) return friendInfo.displayName;
  const friendEmail = room.participantEmails.find(e => e !== user.email);
  return friendEmail ? friendEmail.split('@')[0] : "未知";
};

// 共用的前端圖片壓縮引擎
export const compressImage = (file, maxSize = 800) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        if (width > height) {
          if (width > maxSize) { height *= maxSize / width; width = maxSize; }
        } else {
          if (height > maxSize) { width *= maxSize / height; height = maxSize; }
        }
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.7)); 
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
};