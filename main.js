//main.js

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDoc, addDoc, setDoc, doc, getDocs, deleteDoc } = require('firebase/firestore');
const { getAuth, onAuthStateChanged, setPersistence, createUserWithEmailAndPassword, signInWithEmailAndPassword, browserSessionPersistence, signOut, } = require('firebase/auth');
const fs = require('fs');
const { execFile } = require('child_process');
const admin = require('firebase-admin');

// ID와 패스워드 입력 필드의 셀렉터 리스트
const idSelectors = [
  'input[name="username"]',
  'input[name="user"]',
  'input[name="usr_id"]',
  'input[name="id"]',
  'input[name="login"]',
  'input[id="username"]',
  'input[id="userid"]',
  'input[name="userId"]',
];

const passwordSelectors = [
  'input[name="password"]',
  'input[name="pass"]',
  'input[name="pw"]',
  'input[name="usr_pw"]',
  'input[id="password"]',
  'input[id="userpw"]',
  'input[name="userPass"]',
];


const firebaseConfig = {
  apiKey: "AIzaSyCkiXse10TpCRQZ9thBSAO07U1mPh49_H8",
  authDomain: "looknlock-d163f.firebaseapp.com",
  projectId: "looknlock-d163f",
  storageBucket: "looknlock-d163f.appspot.com",
  messagingSenderId: "762439371442",
  appId: "1:762439371442:web:0c5bdd578b0aa465a317ab"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);


let loggedInUserEmail = null; // 로그인된 사용자의 이메일
setPersistence(auth, browserSessionPersistence)
  .then(() => console.log("세션 지속성을 SESSION으로 설정했습니다."))
  .catch(error => console.error("세션 지속성 설정 중 오류:", error.message));

let userEmail = null;
// Firebase 인증 상태 변경 시 사용자 이메일 업데이트
onAuthStateChanged(auth, (user) => {
  if (user) {
    userEmail = user.email;
    console.log('로그인 성공, 이메일:', userEmail);
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.executeJavaScript(`localStorage.setItem('userEmail', '${userEmail}')`);
    });
  } else {
    userEmail = null;
    console.log('로그아웃됨');
  }
  //loggedInUserEmail = user ? user.email : null;
  //BrowserWindow.getAllWindows().forEach(window => {
  //window.webContents.send('auth-state-changed', { email: loggedInUserEmail });
  //});
  //console.log(`로그인 상태 변경: ${loggedInUserEmail ? '로그인됨' : '로그아웃됨'}`);
});


function createWindow() {
  win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // Preload 스크립트를 사용해 렌더러와 메인 프로세스 간의 통신 설정
      contextIsolation: true,
      nodeIntegration: false,  // NodeIntegration을 비활성화하여 보안 강화
    }
  });

  win.loadFile('index.html');

  // 개발 환경에서 DevTools 열기
  if (process.env.NODE_ENV === 'development') {
    win.webContents.openDevTools();
  }
}



// 특정 창을 안전하게 닫는 함수
function closeWindow(window) {
  if (window && !window.isDestroyed()) {
    window.close();
  }
}

ipcMain.on('close-login-window', (event) => {
  if (loginWindow && !loginWindow.isDestroyed()) {  // loginWindow가 존재하고 파괴되지 않은 경우에만 닫기
    loginWindow.close();
    loginWindow = null;  // 창이 닫힌 후 참조를 제거해 메모리 누수 방지
  }
});



ipcMain.on('send-embedding-request', async (event, imageData) => {
  try {
    const embeddingResult = await generateFaceEmbedding(imageData);
    event.sender.send('face-embedding-result', embeddingResult);
  } catch (error) {
    console.error('임베딩 요청 오류:', error);
  }
});



ipcMain.on('process-face-embedding', (event, { imageData }) => {
  const tempImagePath = path.join(__dirname, 'temp_image_data.txt');
  const pythonScriptPath = path.join(__dirname, 'facenet_embedding.py');

  if (!imageData.startsWith('data:image/png;base64,')) {
    imageData = `data:image/png;base64,${imageData}`;
  }

  fs.writeFile(tempImagePath, imageData, (err) => {
    if (err) {
      console.error('임시 이미지 파일 저장 오류:', err);
      return;
    }

    execFile('python', [pythonScriptPath, tempImagePath], (error, stdout, stderr) => {
      fs.unlink(tempImagePath, (unlinkErr) => {
        if (unlinkErr) {
          console.error('임시 파일 삭제 오류:', unlinkErr);
        }
      });

      if (error) {
        console.error(`FaceNet 처리 오류: ${error}`);
        console.error(stderr);
        return;
      }

      // stdout 결과 파싱 후, 한 번만 전송
      const embeddingArray = stdout
        .trim()
        .replace(/tensor\(|\)|\s+/g, '')
        .split(',')
        .map(Number);
      event.sender.send('face-embedding-result', JSON.stringify(embeddingArray));
    });
  });
});


// 회원가입 처리
ipcMain.on('sign-up', async (event, { email, password }) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    console.log(`회원가입 성공: ${userCredential.user.email}`);
    event.sender.send('sign-up-success');
  } catch (error) {
    console.error(`회원가입 실패: ${error.message}`);
    event.sender.send('sign-up-failed', error.message);
  }
});

// get-auth-user 핸들러 수정
ipcMain.handle('get-auth-user', async () => {
  return userEmail ? { email: userEmail } : null;
});
//ipcMain.handle('get-auth-user', async () => {
  //return loggedInUserEmail ? { email: loggedInUserEmail } : null;
//});


ipcMain.handle('save-user-embedding', async (event, { email, faceEmbedding }) => {
  try {
    // Firebase Firestore에 얼굴 임베딩 저장
    await setDoc(doc(db, "users", email), {
      email: email,
      faceEmbedding: faceEmbedding
    });
    console.log('얼굴 임베딩 저장 성공');
  } catch (error) {
    console.error('얼굴 임베딩 저장 실패:', error);
  }
});


// main.js에서 중복 등록 방지
if (!ipcMain.listeners('get-user-doc').length) {
  ipcMain.handle('get-user-doc', async (event, email) => {
    try {
      console.log('user email found:', email); // 중복 호출 확인 로그
      const userDocRef = doc(db, 'users', email);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        return userDocSnap.data();
      } else {
        console.error('User document not found:', email);
        return null;
      }
    } catch (error) {
      console.error('Error fetching user document:', error);
      return null;
    }
  });
}


// 로그인 성공 시 이메일 업데이트
ipcMain.on('login', async (event, { email, password }) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    userEmail = userCredential.user.email;
    console.log("로그인 성공:", userEmail);

    event.sender.send('login-success', { email: userEmail });

    // localStorage에 이메일 저장
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.executeJavaScript(`localStorage.setItem('userEmail', '${userEmail}')`);
    });
  } catch (error) {
    console.error("로그인 실패:", error.message);
    event.sender.send('login-failed', error.message);
  }
});






// 로그아웃 시 이메일 초기화
ipcMain.on('logout', async (event) => {
  try {
    await signOut(auth);
    loggedInUserEmail = null;
    console.log('로그아웃 성공');
    event.sender.send('logout-success');
  } catch (error) {
    console.error(`로그아웃 실패: ${error.message}`);
    event.sender.send('logout-failed', error.message);
  }
});

// 회원탈퇴
ipcMain.on('navigate-to-delete-auth', () => {
  win.loadFile('delete_auth.html');
});



// 회원 탈퇴 메서드 정의
ipcMain.handle('delete-user-doc', async (event, userEmail) => {
  try {
    const userDocRef = doc(db, `users/${userEmail}`);
    await deleteDoc(userDocRef);
    console.log(`User document for ${userEmail} deleted successfully.`);
    return true;
  } catch (error) {
    console.error(`Error deleting user document for ${userEmail}:`, error);
    throw error;
  }
});



// Firebase Authentication에서 사용자 삭제 함수
async function deleteAuthUser(userEmail) {
  try {
    const userRecord = await admin.auth().getUserByEmail(userEmail);
    await admin.auth().deleteUser(userRecord.uid);
    console.log(`User with email ${userEmail} deleted from Authentication.`);
  } catch (error) {
    console.error(`Error deleting authenticated user:`, error);
  }
}



// 'delete-auth-user' 이벤트 핸들러 수정
ipcMain.handle('delete-auth-user', async (event, userEmail) => {
  try {
    await deleteAuthUser(userEmail);
    return { success: true };
  } catch (error) {
    console.error('Error deleting authenticated user:', error);
    return { success: false, error: error.message };
  }
});




// Firestore에서 데이터 가져오기
ipcMain.handle('get-data', async (event, { collectionName }) => {
  try {
    console.log('Fetching data from Firestore collection:', collectionName);

    const snapshot = await getDocs(collection(db, collectionName));
    return snapshot.docs.map(doc => doc.data());
  } catch (error) {
    console.error('Error fetching data from Firestore:', error);
    throw error;
  }
});

//사이트 정보 저장
ipcMain.handle('write-data', async (event, { collectionName, data }) => {
  try {
    console.log(`Firestore의 컬렉션 경로에 데이터 저장: ${collectionName}`, data);

    // collectionName이 사용자의 브 컬렉션 경로로 전달됨 (예: `users/userEmail/sites`)
    const docRef = await addDoc(collection(db, collectionName), data);
    console.log('문서가 성공적으로 저장되었습니다. ID:', docRef.id);

    return true;
  } catch (error) {
    console.error('Firestore 문서 저장 중 오류:', error);
    throw error;
  }



});

ipcMain.handle('get-user-sites', async (event, userEmail) => {
  try {
    const sitesCollectionRef = collection(db, `users/${userEmail}/sites`);
    const querySnapshot = await getDocs(sitesCollectionRef);

    // Firestore에서 가져온 데이터를 배열로 변환
    const sites = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log("불러온 사이트 데이터:", sites); // 디버깅용 로그
    return sites;
  } catch (error) {
    console.error("사이트 데이터를 불러오는 중 오류 발생:", error);
    return [];
  }
});

ipcMain.handle('delete-site-data', async (event, userEmail, docId) => {
  try {
    console.log(`Firestore에서 삭제 요청 - 사용자 이메일: ${userEmail}, 한 번 인코딩된 문서 ID: ${docId}`);
    const siteDocRef = doc(db, `users/${userEmail}/sites`, docId);
    const docSnapshot = await getDoc(siteDocRef);

    if (docSnapshot.exists()) {
      await deleteDoc(siteDocRef);
      console.log(`Firestore에서 사이트 데이터 삭제 성공: ${docId}`);
      return true;
    } else {
      console.error(`삭제할 문서가 존재하지 않습니다: ${docId}`);
      return false;
    }
  } catch (error) {
    console.error('Firestore에서 사이트 데이터 삭제 실패:', error);
    throw error;
  }
});











ipcMain.handle('delete-site-data', async (event, userEmail, docId) => {
  try {
    console.log(`Firestore에서 삭제 요청 - 사용자 이메일: ${userEmail}, 한 번 인코딩된 문서 ID: ${docId}`);
    const siteDocRef = doc(db, `users/${userEmail}/sites`, docId);
    const docSnapshot = await getDoc(siteDocRef);

    if (docSnapshot.exists()) {
      await deleteDoc(siteDocRef);
      console.log(`Firestore에서 사이트 데이터 삭제 성공: ${docId}`);
      return true;
    } else {
      console.error(`삭제할 문서가 존재하지 않습니다: ${docId}`);
      return false;
    }
  } catch (error) {
    console.error('Firestore에서 사이트 데이터 삭제 실패:', error);
    throw error;
  }
});





ipcMain.handle('auto-login', async (event, { url, id, password }) => {
  try {
    const loginWindow = new BrowserWindow({
      width: 800,
      height: 600,
      parent: null, // 부모 창 설정 제거
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      }
    });


    const decodedUrl = decodeURIComponent(url);
    console.log("디코딩된 URL:", decodedUrl);
    loginWindow.loadURL(decodedUrl);


    loginWindow.webContents.on('did-finish-load', () => {
      console.log('페이지 로드 완료, 자동 로그인 시도 중...');

      // MutationObserver 완전 비활성화
      loginWindow.webContents.executeJavaScript(`
        window.electronAPI.send('disable-observer');
        console.log("MutationObserver 완전 비활성화됨");
      `).catch(error => console.error('비활성화 스크립트 실행 중 오류 발생:', error));

      setTimeout(() => {
        loginWindow.webContents.executeJavaScript(`
          const idSelectors = ['input[name="username"]', 'input[name="id"]', 'input[name="userid"]', 'input[name="userId"]', 'input[type="text"]'];
          const passwordSelectors = ['input[name="password"]', 'input[name="pw"]', 'input[name="userPass"]', 'input[type="password"]'];
    
          const idField = document.querySelector(idSelectors.join(', '));
          const passwordField = document.querySelector(passwordSelectors.join(', '));
    
          if (idField && passwordField) {
            idField.value = "${id}";
            passwordField.value = "${password}";
            console.log('자동 로그인 폼 입력 완료');
          } else {
            console.error('ID 또는 비밀번호 필드를 찾을 수 없습니다.');
          }
        `).catch(error => console.error('자동 로그인 스크립트 실행 중 오류 발생:', error));
      }, 500); // 폼 입력 완료 후 0.5초 지연
    });


    loginWindow.on('closed', () => {
      console.log("loginWindow 닫힘");
      // 메인 페이지 새로고침 요청
      const mainWindow = BrowserWindow.getAllWindows().find(win => win.getTitle() === 'Main Page');
      if (mainWindow) {
        mainWindow.webContents.send('refresh-main-page');
        console.log("메인 페이지에 'refresh-main-page' 이벤트 전송 완료");
      }
    });
  } catch (error) {
    console.error('자동 로그인 처리 중 오류 발생:', error);
  }
});


// main.js
ipcMain.on('navigate-to-write-page', (event) => {
  console.log("Navigating to write page"); 
  const win = BrowserWindow.getAllWindows()[0];
  win.loadFile('writepage.html');
});


ipcMain.on('navigate-to-signup', () => {
  win.loadFile('signup_credentials.html');
});

ipcMain.on('navigate-to-signup-face', () => {
  win.loadFile('signup_face.html');
});

ipcMain.on('navigate-to-login', () => {
  win.loadFile('login.html');
});

ipcMain.on('navigate-to-face-auth', () => {
  win.loadFile('login_face.html');
});

ipcMain.on('navigate-to-mainpage', () => {
  win.loadFile('mainpage.html').then(() => {
    if (userEmail) {
      win.webContents.send('logged-in', userEmail);
    }
  });
});

ipcMain.on('navigate-to-index', () => {
  win.loadFile('index.html');
});




// Electron 
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  const allWindows = BrowserWindow.getAllWindows();


  const mainWindow = allWindows.find(win => win.getTitle() === 'Main Page');
  if (!mainWindow || allWindows.length === 0) {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});


auth.setPersistence(browserSessionPersistence)
  .then(() => {
    console.log("세션 지속성이 설정되었습니다.");
  })
  .catch((error) => {
    console.error("세션 지속성 설정 중 오류:", error.message);
  });

  // Firebase 인증 세션을 브라우저 탭이 닫힐 때 종료되도록 설정
auth.setPersistence(browserSessionPersistence)
.then(() => {
  console.log("세션 지속성을 SESSION으로 설정");
})
.catch((error) => {
  console.error("세션 지속성 설정 중 오류:", error.message);
});



ipcMain.on('open-url-in-new-window', (_event, url) => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

        // 템플릿 리터럴 대신 문자열 연결 방식 사용
        win.loadURL(url.startsWith('http') ? url : 'https://' + url);


        win.webContents.on('did-finish-load', () => {
          console.log("페이지 로드 완료 및 MutationObserver 설정");
        });



      // 새 창이 닫힐 때 메인 페이지 새로고침 요청
      win.on('closed', () => {
        console.log("open-url-in-new-window 창 닫힘, 메인 페이지 새로고침 요청 전송");
        const mainWindow = BrowserWindow.getAllWindows().find(win => win.getTitle() === 'Main Page');
        if (mainWindow) {
          mainWindow.webContents.send('refresh-main-page');
          console.log("메인 페이지에 'refresh-main-page' 이벤트 전송 완료");
        }
      });

    });
    ipcMain.handle('save-site-data', async (event, siteData) => {
      const { id, password, url, email, title, icon } = siteData;
      if (email) {
        try {
          const encodedUrl = encodeURIComponent(url);
          const collectionPath = `users/${email}/sites`;
          await setDoc(doc(db, collectionPath, encodedUrl), {
            id,
            password,
            url,
            title: title || 'Untitled',
            icon: icon || '/icon.png'
          });
          console.log('Firestore에 사이트 데이터 저장 성공:', siteData);
        } catch (error) {
          console.error('Firestore에 사이트 데이터 저장 실패:', error);
        }
      } else {
        console.log('사용자가 로그인되어 있지 않습니다.');
      }
    });



    ipcMain.on('set-user-email', (event, email) => {
      userEmail = email;
      console.log('User email set to:', userEmail);
    });

    ipcMain.handle('get-user-email', async (event) => {
      const email = await new Promise((resolve) => {
        BrowserWindow.getAllWindows().forEach(window => {
          window.webContents.executeJavaScript(`localStorage.getItem('userEmail')`)
            .then((result) => resolve(result))
            .catch(() => resolve(null));
        });
      });
      console.log("get-user-email 핸들러에서 가져온 이메일:", email);
      return email;
    });
  
