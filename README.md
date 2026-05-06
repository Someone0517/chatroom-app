# Software Studio 2026 Spring
## Midturn Assignment ChatRoom

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)


## How to use 

<!-- 測試用帳密(帳密同) : -->

<!-- ALFA_tester@gmail.com -->
<!-- Bimmer_tester@gmail.com -->
<!-- koala@gmail.com -->
<!-- JDMaster_tester@gmail.com -->

### 0. 介面與底層架構介紹
  * **Firebase and data**： 在firebase後台可以修改與查看Database
  * **RWD**： 當畫面過窄時會取消"同時顯示聊天室選取框跟聊天室畫面" ，UI變成類似手機版本的messenger，如果畫面夠寬就同時顯示。
  * **CSS animation**： 在聊天室切換、回覆特定訊息跟操作選單(如編輯個人資料)時可以看到 CSS animation。
  * **Other problem**： sending code 

### 1. 身份驗證與個人化 (Auth & Profile)
  * **登入/註冊**：支援 Email 註冊以及 Google 帳號登入。
  * **個人化**：
    * **個人頭貼** :預設是灰色底配首字母，按下頭貼右下角"+"可以更改，可以選擇emoji+背景色或是按下emoji旁的"+"可以上傳圖片。 更改頭貼也會改變過去發送訊息時的頭貼 (頭貼為即時抓資料再渲染)。
    * **暱稱**：預設是電子郵件的前綴，可以更改。會在聊天室訊息中的用戶頭像下方顯示，若過長會用"..."截斷。
    * **電話與地址**：可以更改，非必要項。

  * **個人化資訊顯示與更改方式**:
    * **更改己方資料** : 點左上角自己的頭貼就會彈出更改視窗，裡面可以更改頭貼、暱稱、電話號碼、地址以及切換顯示模式，記得點下儲存設定儲存
    * **查看對方資料** : 
      * **在群組聊天室** : 點擊左上角"..."可以查看群組成員(若非好友可以點擊"+"傳送陌生訊息)以及群組ID(隨機產生，可供其他人搜尋)，以及群組建立時間、可更改的名稱等基本資料(更改完成會在群組留下紀錄)。
      * **在私訊聊天室** : 點擊左上角"..."可以建立新群組、查看對方的email
    * **任意對話中** :可以直接點擊對方頭貼顯示詳細資料

### 2. 私訊及群組聊天室操作
  * **側邊欄操作** :(由左至右)
      * **放大鏡** 點下後可以透過email或是群組ID新增聊天室
      * **全部訊息**
      * **未讀訊息**
      * **陌生訊息** 新的群組或是好友都會出現在這裡，要同意後才能成為好友並且回覆訊息
  * **封鎖與陌生訊息** :

  * **新增私訊好友** : 可以透過以下三個方式(新增被封鎖用戶或是已為好友的用戶會被UI提醒)
      * **直接搜尋對方電子郵件** (使用側邊欄的放大鏡圖標)
      * **在群組內點擊對方頭像** 
      * **在群組內的"更多"選單中查看群組成員時新增對方** (會傳送預設訊息 "我是來自XXX的XXX" ) 
  * **新增聊天室以及新增聊天室內成員** :
      * **建立聊天室** : 在與對方的私訊中點及左上角"..."
      * **加入現有聊天室** : 在與對方的私訊中點及左上角"..."
      * **聊天室** : 在與對方的私訊中點及左上角"..."
  * **(Bonus)刪除與封鎖** :
      * **刪除好友** :在聊天室內的"..."或是把游標放對話室選擇的頁面出現的"..."中可以刪除聊天室，對好友就是默認解除好友狀態(非封鎖)，對群組就是退出。
      * **封鎖** : 點他人的頭像候可以在彈出選單中封鎖對方，或是提前用email封鎖對方，被封鎖後聊天室會顯示"未知"，無法傳送訊息。可以在side bar中的"陌生訊息"區域編輯封鎖名單。

### 3. 訊息操作
  * **收回與編輯** :把游標放到訊息上點擊"..." 編輯後會顯示已編輯
  * **搜尋訊息** :左上方"放大鏡"，風格參考Vscode
  * **傳送圖片** :可以點及文字欄左側圖標或是直接把圖片拖曳到"對話框"
  * **(Bonus)回覆特定訊息** :把游標放到訊息上點擊箭頭，可以點擊被回覆的訊息來跳轉或是高亮
  * **(Bonus)對訊息傳送emoji** :把游標放到訊息上點擊emoji，再按一次收回


DNE : N ; done : y ; checked : Y

| **Basic components**   | **Score** | **Check** |
| :--------------------- | :-------: | :-------: |
| Membership Mechanism   |    5%     |    Y      |
| Host your Firebase page|    5%     |    Y      |
| Database read/write    |    5%     |    Y      |
| RWD                    |    5%     |    Y      |
| Git                    |    5%     |    Y      |
| Chatroom               |    25%    |    Y      |
  |-- Create private chatrooms
  |-- Other members can see your messages
  |-- Load all history message
   L-- Invite new members


| **Advanced components**    | **Score** | **Check** |
| :------------------------- | :-------: | :-------: |
| framework (React)          |    5%     |     y     |
| Third-party accounts       |    1%     |     Y     |
| Chrome notification        |    5%     |     Y     |
| Use CSS animation          |    2%     |     Y     |
| problems when sending code |    2%     |     Y     |


| **User Profile(10%)**      |**be show**| **Check** |
| :------------------------- | :-------: | :-------: |
| Profile picture            |     v     |     Y     | 
| Username                   |     v     |     Y     |
| Email                      |     v     |     Y     |
| Phone number               |     X     |     Y     |
| Address                    |     X     |     Y     |

| **Message operation(10%)** | **score** | **Check** |
| :------------------------- | :-------: | :-------: |
| Unsend message             |           |     Y     |
| Edit message               |           |     Y     |
| Search message             |           |     Y     |
| Send image                 |           |     Y     |

|    **Bonus Components**    | **Score** | **Check** |
| :------------------------- | :-------: | :-------: |
| Reply for specify message  |    6%     |    Y      |
| Send the emoji             |    3%     |    Y      |
| Block User                 |    2%     |    Y      |