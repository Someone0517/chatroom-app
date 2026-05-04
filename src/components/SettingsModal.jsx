import React from "react";
import { signOut } from "firebase/auth";
import { auth } from "../services/firebaseConfig";
import { renderAvatar } from "../utils/chatHelpers";

const PRESET_EMOJIS = [
  "😀","😂","🥰","😍","😎","🤩","🤔","🤫","🙄","😴","🤤","😷",
  "🥳","🤓","🥺","😭","😱","😡","🤡","👽","👻","🤖","💩","💖","🔥","✨","🌟","💯"
];

export default function SettingsModal({
  showSettings, setShowSettings, showAvatarPicker, setShowAvatarPicker, showEmojiMenu, setShowEmojiMenu,
  nightMode, setNightMode, personalId, setPersonalId, displayName, setDisplayName,
  phoneNumber, setPhoneNumber, address, setAddress, // 💡 新增的 Props
  avatarImage, setAvatarImage, avatarBgColor, setAvatarBgColor, avatarEmoji, setAvatarEmoji,
  handleSaveProfile, handleImageUpload, user, logoColor, presetColors
}) {
  if (!showSettings) return null;

  return (
    <div className="modal-overlay" onClick={() => { setShowSettings(false); setShowAvatarPicker(false); setShowEmojiMenu(false); }}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        {!showAvatarPicker ? (
          <>
            <h3 style={{ marginTop: 0, color: nightMode ? '#fff' : '#000', textAlign: 'center' }}>個人設定</h3>
            <div className="profile-header-box">
              <div className="profile-avatar-wrapper">
                <div className="profile-avatar-display" style={{backgroundColor: avatarImage ? "transparent" : avatarBgColor}}>
                  {renderAvatar({image: avatarImage, emoji: avatarEmoji}, displayName || user.email)}
                </div>
                <div className="btn-edit-avatar" onClick={() => setShowAvatarPicker(true)}>+</div>
              </div>
              <span className="profile-email-text">{user.email}</span>
            </div>
            
            <div className="id-setting-group">
              <label className="menu-label" style={{paddingLeft:0}}>暱稱</label>
              <div className="id-input-wrapper"><input value={displayName} onChange={e => setDisplayName(e.target.value)} /></div>
            </div>
            {/* 💡 新增的 Phone Number 與 Address */}
            <div className="id-setting-group">
              <label className="menu-label" style={{paddingLeft:0}}>電話號碼 (Optional)</label>
              <div className="id-input-wrapper"><input value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="0912-345-678" /></div>
            </div>
            <div className="id-setting-group">
              <label className="menu-label" style={{paddingLeft:0}}>地址 (Optional)</label>
              <div className="id-input-wrapper"><input value={address} onChange={e => setAddress(e.target.value)} placeholder="新竹市東區..." /></div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0' }}>
              <span style={{ color: nightMode ? '#fff' : '#000' }}>夜晚模式</span>
              <label className="toggle-switch">
                <input type="checkbox" checked={nightMode} onChange={e => setNightMode(e.target.checked)} />
                <span className="slider"></span>
              </label>
            </div>
            <button onClick={handleSaveProfile} style={{ width: '100%', padding: '12px', background: logoColor, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '10px' }}>儲存設定</button>
            <button onClick={() => signOut(auth)} style={{ width: '100%', padding: '12px', background: 'transparent', color: '#ff453a', border: '1px solid #ff453a', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>登出帳號</button>
          </>
        ) : (
          <div className="avatar-picker-modal">
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
              <button onClick={() => { setShowAvatarPicker(false); setShowEmojiMenu(false); }} style={{ background:'none', border:'none', color: '#0a84ff', cursor:'pointer', fontSize:'16px' }}>&lt; 返回</button>
              <h4 style={{ margin: '0 auto', color: nightMode ? '#fff' : '#000', paddingRight: '40px' }}>更改大頭貼</h4>
            </div>
            <div className="profile-avatar-wrapper" style={{ margin: '0 auto 25px auto' }}>
              <div className="profile-avatar-display" style={{backgroundColor: avatarImage ? "transparent" : avatarBgColor}}>
                  {renderAvatar({image: avatarImage, emoji: avatarEmoji}, displayName || user.email)}
              </div>
            </div>
            <label className="menu-label" style={{textAlign:'center'}}>選擇背景色</label>
            <div className="color-picker-grid">
              {presetColors.map(c => (
                <div key={c} className={`color-dot ${avatarBgColor === c && !avatarImage ? 'active' : ''}`} style={{background: c}} onClick={() => { setAvatarBgColor(c); setAvatarImage(""); }} />
              ))}
            </div>
            <label className="menu-label" style={{textAlign:'center', marginTop:'15px'}}>自訂內容</label>
            <div className="emoji-upload-row">
              <div className="action-btn-circle" onClick={() => setShowEmojiMenu(!showEmojiMenu)}>😀</div>
              <label className="action-btn-circle" style={{color: '#0a84ff'}}>+<input type="file" accept="image/*" style={{display:'none'}} onChange={handleImageUpload} /></label>
            </div>
            {showEmojiMenu && (
              <div className="emoji-picker-menu">
                {PRESET_EMOJIS.map(emoji => (
                  <span key={emoji} className="emoji-item" onClick={() => { setAvatarEmoji(emoji); setAvatarImage(""); setShowEmojiMenu(false); }}>
                    {emoji}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}