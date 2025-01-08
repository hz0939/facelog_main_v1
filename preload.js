//preload.js 

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cryptoAPI', {
  encryptData: (text) => ipcRenderer.invoke('encrypt-data', text),
  decryptData: (text) => ipcRenderer.invoke('decrypt-data', text),
});

const idSelectors = ['input[name="username"]', 'input[name="id"]', 'input[name="userid"]', 'input[name="usr_id"]', 'input[name="userId"]', 'input[type="text"]', 'input#id'];
const passwordSelectors = ['input[name="password"]', 'input[name="pw"]', 'input[name="userpw"]', 'input[name="usr_pw"]', 'input[name="userPass"]', 'input[type="password"]', 'input#pw'];


contextBridge.exposeInMainWorld('electronAPI', {

  saveEmbedding: (embedding) => ipcRenderer.send('save-embedding', embedding),
  getEmbedding: () => ipcRenderer.invoke('get-embedding'), // 메인 프로세스에서 임베딩 값 가져오기

  startAntispoofing: () => ipcRenderer.send('start-antispoofing'),
  stopAntispoofing: () => ipcRenderer.send('stop-antispoofing'),
  navigateToAntispoofing: () => ipcRenderer.send('navigate-to-antispoofing'),

  onUpdateResult: (callback) => {
    ipcRenderer.removeAllListeners('update-result');
    ipcRenderer.on('update-result', (event, result) => callback(result));
  },
  logOut: () => ipcRenderer.send('logout'),
  
  // Python이 준비되었음을 확인하거나 요청을 보낼 수 있는 메서드
  sendStartRequest: () => ipcRenderer.send('start-antispoofing'),
  sendStopRequest: () => ipcRenderer.send('stop-antispoofing'),

  onUpdateResult: (callback) => {
    ipcRenderer.on('update-result', (event, result) => {
     
      callback(result);
    });
  },

  startAntispoofing: () => {
    ipcRenderer.send('start-antispoofing');
  },
  stopAntispoofing: () => {
    ipcRenderer.send('stop-antispoofing');
  },
  onAntispoofingResult: (callback) => {
    ipcRenderer.on('antispoofing-result', (event, result) => {
      callback(result);
    });
  },



 // onEmbeddingResult 수정
onEmbeddingResult: (callback) => {
  // 기존 리스너 제거
  ipcRenderer.off('face-embedding-result', callback);

  // 새로운 리스너 등록
  ipcRenderer.on('face-embedding-result', (event, data) => {
      callback(data);
  });

},

removeAllListeners: (channel) => {
  ipcRenderer.removeAllListeners(channel);
},



  startWebcam: async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // streamId만 반환
      return { streamId: stream.id };
    } catch (error) {
      throw error;
    }
  },

  // 사용자 인증 정보 가져오기
  getAuthUser: () => ipcRenderer.invoke('get-auth-user'),
  onAuthStateChanged: (callback) => ipcRenderer.on('auth-state-changed', (event, data) => callback(data)),
  login: (credentials) => ipcRenderer.send('login', credentials),


 
  

  // Firestore에서 사용자 문서 가져오기
  getUserDoc: (userEmail) => {
    // 중복 리스너 제거
    ipcRenderer.removeAllListeners('get-user-doc');
    return ipcRenderer.invoke('get-user-doc', userEmail);
  },
  

  // 사용자 임베딩 데이터 Firestore에 저장
  saveUserEmbedding: (data) => ipcRenderer.invoke('save-user-embedding', data),
  sendEmbeddingRequest: (imageData) => ipcRenderer.send('process-face-embedding', { imageData }),
  offEmbeddingResult: () => ipcRenderer.removeAllListeners('face-embedding-result'),
  sendSignUpRequest: (data) => ipcRenderer.send('sign-up', data),
  onSignUpSuccess: (callback) => ipcRenderer.on('sign-up-success', callback),
  onSignUpFailed: (callback) => ipcRenderer.on('sign-up-failed', (event, message) => callback(message)),

  sendLoginRequest: (data) => ipcRenderer.send('login', data),
  onLoginSuccess: (callback) => ipcRenderer.on('login-success', (event, user) => callback(user)),
  sendLoginRequest: (data) => ipcRenderer.send('login', data),

  onLoginFailed: (callback) => ipcRenderer.on('login-failed', (event, message) => callback(message)),

  navigateToFaceRegister: () => ipcRenderer.send('navigate-to-face-register'),
  navigateToLoginFace: () => ipcRenderer.send('navigate-to-face-auth'),
  navigateToMainPage: () => ipcRenderer.send('navigate-to-mainpage'),
  navigateToIndex: () => ipcRenderer.send('navigate-to-index'),

  send: (channel) => ipcRenderer.send(channel),

  writeDataToDB: (collectionName, data) => {
 
    return ipcRenderer.invoke('write-data', { collectionName, data });
  },

  getDataFromDB: (collectionName) => {
 
    return ipcRenderer.invoke('get-data', { collectionName });
  },
  autoLogin: (url, id, password) => {
 
    ipcRenderer.invoke('auto-login', { url, id, password });
  },

  getUserSites: (userEmail) => {
   
    return ipcRenderer.invoke('get-user-sites', userEmail);
  },
  



  // 회원 탈퇴 페이지 이동
  navigateToDeleteAuth: () => ipcRenderer.send('navigate-to-delete-auth'),
  
  // 회원 탈퇴 관련 함수
  deleteUserDoc: (userEmail) => ipcRenderer.invoke('delete-user-doc', userEmail),
  deleteAuthUser: () => ipcRenderer.invoke('delete-auth-user'),

  // 다른 페이지로 이동 (데이터 쓰는 페이지)
  navigateToWritePage: () => ipcRenderer.send('navigate-to-write-page'),

  // url 입력 후 새로운 창 열기
  openUrlInNewWindow: (url) => ipcRenderer.send('open-url-in-new-window', url),
  saveSiteData: (data) => ipcRenderer.send('save-site-data', data),



  // 이메일 정보를 로컬 스토리지에서 가져오는 메서드
  
  // 사이트 데이터를 저장하는 메서드
  saveSiteData: (siteData) => {
 
    ipcRenderer.invoke('save-site-data', siteData);
  },
  getAuthUser: () => ipcRenderer.invoke('get-auth-user'),
  getUserEmail: () => ipcRenderer.invoke('get-user-email'),

  // 사이트 데이터 삭제 메서드
  deleteSiteData: (userEmail, docId) => ipcRenderer.invoke('delete-site-data', userEmail, docId),
});



window.addEventListener("DOMContentLoaded", async () => {
 

  // 현재 페이지 경로 확인
  const currentPath = window.location.pathname;

  // 특정 페이지에서는 get-user-email 호출 방지
  const excludedPaths = ["/index.html", "/signup_credentials.html", "/signup_face.html"];
  if (!excludedPaths.includes(currentPath)) {
    try {
      // 로그인 상태 확인
      const userEmail = await ipcRenderer.invoke('get-user-email');

      if (userEmail) {
        localStorage.setItem('userEmail', userEmail);
      } else {
      }
    } catch (error) {

    }
  } else {
    
  }

  // ID와 비밀번호 필드 탐색 셀렉터 설정
  const idSelectors = ['input[name="username"]', 'input[name="id"]', 'input[name="userid"]', 'input[name="usr_id"]', 'input[name="userId"]','input[type="text"]'];
  const passwordSelectors = ['input[name="password"]', 'input[name="pw"]', 'input[name="userpw"]', 'input[name="usr_pw"]', 'input[name="userPass"]','input[type="password"]'];
  let saveTimeout;

  function attemptSaveData(idValue, passwordValue) {
    const cachedEmail = localStorage.getItem('userEmail');
    const title = document.title || 'Untitled';
    const icon = document.querySelector("link[rel~='icon']")?.href || '/icon.png';
    const encodedUrl = encodeURIComponent(location.href);

    if (cachedEmail && idValue && passwordValue) {
      const siteData = {
        id: idValue,
        password: passwordValue,
        url: encodedUrl,
        email: cachedEmail,
        title,
        icon,
        isEncrypted: false, // 암호화하지 않음
      };
      
      ipcRenderer.invoke('save-site-data', siteData);
    } else {
      
    }
  }

  let isAutoLoginInProgress = false;
  function monitorInputFields() {
    if (isAutoLoginInProgress) return; // 자동 로그인 중일 때 감시 중단

    const idField = document.querySelector(idSelectors.join(', '));
    const passwordField = document.querySelector(passwordSelectors.join(', '));

    if (idField && passwordField) {
     
      passwordField.addEventListener('input', () => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
          attemptSaveData(idField.value.trim(), passwordField.value.trim());
        }, 1000);
      });
    } else {
   
    }
  }

  const observer = new MutationObserver(monitorInputFields);
  observer.observe(document.body, { childList: true, subtree: true });
  monitorInputFields();
});

ipcRenderer.on('disable-observer', () => {
  isAutoLoginInProgress = true;
  observer.disconnect();
 
});

ipcRenderer.on('enable-observer', () => {
  isAutoLoginInProgress = false;
  try {
    observer.observe(document.body, { childList: true, subtree: true });
   
  } catch (error) {
   
  }
});

ipcRenderer.on('refresh-main-page', () => {
 
  window.location.reload(); // 메인 페이지를 직접 새로고침
});