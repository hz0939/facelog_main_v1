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
  saveSiteData: async (siteData) => {
    try {
      // Firestore에 사이트 데이터를 저장 요청
      await ipcRenderer.invoke('save-site-data', siteData);
      console.log("Firestore에 사이트 데이터 저장 성공:", siteData);
    } catch (error) {
      console.error("Firestore에 사이트 데이터 저장 실패:", error);
    }
  },
  getAuthUser: () => ipcRenderer.invoke('get-auth-user'),

});


window.addEventListener("DOMContentLoaded", async () => {
  console.log("페이지 로드 완료 및 MutationObserver 설정");

  try {
    const userEmail = await ipcRenderer.invoke('get-user-email');
    console.log("ipcRenderer로 가져온 이메일:", userEmail);
    if (userEmail) {
      localStorage.setItem('userEmail', userEmail);
    } else {
      console.warn("사용자가 로그인되어 있지 않거나 이메일을 가져올 수 없습니다.");
    }
  } catch (error) {
    console.error("이메일 가져오기 실패:", error);
  }

  // ID와 비밀번호 필드 탐색 셀렉터 설정
  const idSelectors = ['input[name="username"]', 'input[name="id"]', 'input[name="userid"]', 'input[name="usr_id"]', 'input[type="text"]'];
  const passwordSelectors = ['input[name="password"]', 'input[name="pw"]', 'input[name="userpw"]', 'input[name="usr_pw"]', 'input[type="password"]'];

  function captureLoginForm() {
      const idField = document.querySelector(idSelectors.join(', '));
      const passwordField = document.querySelector(passwordSelectors.join(', '));

      if (idField && passwordField) {
          console.log("ID와 비밀번호 입력 필드 감지됨");

          idField.addEventListener('input', () => console.log("ID 필드 입력됨:", idField.value));
          passwordField.addEventListener('input', () => console.log("Password 필드 입력됨:", passwordField.value));

          const form = idField.closest('form') || passwordField.closest('form');
          if (form) {
              form.addEventListener('submit', (event) => {
                  event.preventDefault();
                  const id = idField.value.trim();
                  const password = passwordField.value.trim();

                  if (id && password && userEmail) {
                      console.log("Firestore에 저장 요청 전송 전:", { id, password, url: window.location.href });
                      window.api.send("save-site-data", { id, password, url: window.location.href, email: userEmail });

                      // 페이지 전환 지연
                      setTimeout(() => form.submit(), 2000);
                  } else {
                      console.log("사용자가 로그인되어 있지 않거나 필드 값이 비어 있습니다.");
                  }
              });
          }
      } else {
          console.log("입력 필드가 감지되지 않음");
      }
  }

  // MutationObserver 설정
  const observer = new MutationObserver(captureLoginForm);
  observer.observe(document.body, { childList: true, subtree: true });
  captureLoginForm();
});