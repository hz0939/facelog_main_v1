console.log("preload.js 로드됨");
const { contextBridge, ipcRenderer } = require('electron');

const idSelectors = ['input[name="username"]', 'input[name="id"]', 'input[name="userid"]', 'input[name="usr_id"]', 'input[type="text"]'];
const passwordSelectors = ['input[name="password"]', 'input[name="pw"]', 'input[name="userpw"]', 'input[name="usr_pw"]', 'input[type="password"]'];

contextBridge.exposeInMainWorld('electronAPI', {

  startWebcam: () => {
    console.log("preload에서 startWebcam 호출됨");
    return navigator.mediaDevices.getUserMedia({ video: true });
  },
  // 사용자 인증 정보 가져오기
  getAuthUser: () => ipcRenderer.invoke('get-auth-user'),
  onAuthStateChanged: (callback) => ipcRenderer.on('auth-state-changed', (event, data) => callback(data)),
  login: (credentials) => ipcRenderer.send('login', credentials),
  logOut: () => ipcRenderer.send('logout'),

  // Firestore에서 사용자 문서 가져오기
  getUserDoc: (email) => ipcRenderer.invoke('get-user-doc', email),

  // 사용자 임베딩 데이터 Firestore에 저장
  saveUserEmbedding: (data) => ipcRenderer.invoke('save-user-embedding', data),
  sendEmbeddingRequest: (imageData) => ipcRenderer.send('process-face-embedding', { imageData }),
  onEmbeddingResult: (callback) => ipcRenderer.on('face-embedding-result', (event, data) => callback(data)),

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
    console.log('writeDataToDB called:', collectionName, data);  // 전달되는 값 확인
    return ipcRenderer.invoke('write-data', { collectionName, data });
  },

  getDataFromDB: (collectionName) => {
    console.log('Requesting data from collection:', collectionName);  // 전달된 컬렉션 이름 로그 확인
    return ipcRenderer.invoke('get-data', { collectionName });
  },
  autoLogin: (url, id, password) => {
    console.log('자동 로그인 요청:', url, id, password);
    ipcRenderer.invoke('auto-login', { url, id, password });
  },

  getUserSites: (userEmail) => {
    console.log("getUserSites 호출됨:", userEmail);
    return ipcRenderer.invoke('get-user-sites', userEmail);
  },
  

  // 로그아웃 기능
  logOut: () => ipcRenderer.send('logout'),

  // 다른 페이지로 이동 (데이터 쓰는 페이지)
  navigateToWritePage: () => ipcRenderer.send('navigate-to-write-page'),

  // url 입력 후 새로운 창 열기
  openUrlInNewWindow: (url) => ipcRenderer.send('open-url-in-new-window', url),
  saveSiteData: (data) => ipcRenderer.send('save-site-data', data),

  // Firestore에 사이트 데이터 저장 요청을 보내는 함수
  saveSiteData: async (data) => {
    return new Promise((resolve, reject) => {
      const userEmail = localStorage.getItem('userEmail'); // 로컬 스토리지에서 이메일 가져오기
      console.log("로컬 스토리지에서 가져온 이메일:", userEmail);

      if (userEmail) {
        ipcRenderer.once('save-site-data-response', (event, success) => {
          if (success) {
            console.log("Firestore에 데이터 저장 성공");
            resolve();
          } else {
            console.log("Firestore에 데이터 저장 실패");
            reject();
          }
        });
        ipcRenderer.send('save-site-data', { ...data, userEmail });
      } else {
        console.log("사용자가 로그인되어 있지 않거나 로컬 스토리지에서 이메일을 찾을 수 없습니다.");
        reject();
      }
    });
  }
});

window.addEventListener('DOMContentLoaded', () => {
  let saveTimeout;

  function saveData() {
    const idField = idSelectors.map(sel => document.querySelector(sel)).find(el => el);
    const passwordField = passwordSelectors.map(sel => document.querySelector(sel)).find(el => el);

    if (idField && passwordField) {
      const id = idField.value.trim();
      const password = passwordField.value.trim();
      const url = window.location.href;

      const userEmail = localStorage.getItem('userEmail'); // 로컬 스토리지에서 이메일 가져오기
      if (userEmail && id && password) {
        console.log("최종 데이터 저장 요청:", { id, password, url, userEmail });
        window.electronAPI.saveSiteData({ id, password, url })
          .then(() => console.log("Firestore에 데이터 저장 성공"))
          .catch(error => console.log("Firestore 저장 실패:", error));
      } else {
        console.log('사용자가 로그인되어 있지 않거나 필드 값이 비어 있습니다.');
      }
    } else {
      console.log("ID와 비밀번호 입력 필드를 찾을 수 없습니다.");
    }
  }

  function scheduleSave() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveData, 1500); // 입력이 멈춘 후 1.5초 뒤에 저장
  }

  function monitorInputChanges() {
    const idField = idSelectors.map(sel => document.querySelector(sel)).find(el => el);
    const passwordField = passwordSelectors.map(sel => document.querySelector(sel)).find(el => el);

    if (idField && passwordField) {
      console.log("ID와 비밀번호 입력 필드 감지됨");
      
      idField.addEventListener('input', scheduleSave);
      passwordField.addEventListener('input', scheduleSave);
    } else {
      console.log("입력 필드를 찾을 수 없음");
    }
  }

  // MutationObserver 설정
  const observer = new MutationObserver(monitorInputChanges);
  observer.observe(document.body, { childList: true, subtree: true });
  
  // MutationObserver로 감지되지 않는 경우를 대비해, 주기적으로 필드를 검색
  setInterval(monitorInputChanges, 2000); // 2초마다 필드 탐색 및 변경 감지 시도
});