//main.js

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection,getDoc,addDoc, setDoc, doc, getDocs, deleteDoc} = require('firebase/firestore');
const { getAuth, onAuthStateChanged, setPersistence,createUserWithEmailAndPassword,signInWithEmailAndPassword,browserSessionPersistence,signOut, } = require('firebase/auth'); 
const fs = require('fs');
const { execFile } = require('child_process');
const admin = require('firebase-admin');



// Firebase 초기화
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


  
// FaceNet 임베딩 처리
ipcMain.on('process-face-embedding', (event, { imageData }) => {
  const tempImagePath = path.join(__dirname, 'temp_image_data.txt');
  const pythonScriptPath = path.join(__dirname, 'facenet_embedding.py'); // Python 스크립트 경로 설정

  // 'data:image/png;base64,' 접두어가 없는 경우 추가
  if (!imageData.startsWith('data:image/png;base64,')) {
    imageData = `data:image/png;base64,${imageData}`;
  }

  // Base64 데이터를 임시 파일에 저장
  fs.writeFile(tempImagePath, imageData, (err) => {
    if (err) {
      console.error('이미지 데이터 파일 저장 오류:', err);
      return;
    }

    // Python 스크립트를 실행하고 임시 파일 경로를 전달
    execFile('python3', [pythonScriptPath, tempImagePath], (error, stdout, stderr) => {
      // 실행 후 임시 파일 삭제
      fs.unlink(tempImagePath, (unlinkErr) => {
        if (unlinkErr) {
          console.error('임시 파일 삭제 오류:', unlinkErr);
        }
      });

      if (error) {
        console.error(`FaceNet 처리 중 오류 발생: ${error}`);
        console.error(stderr); // 오류 메시지 출력
        return;
      }

      console.log(`FaceNet 임베딩 결과: ${stdout}`);
      event.sender.send('face-embedding-result', stdout);

      // 회원 탈퇴용
      // 임베딩 결과를 배열로 변환
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

// 로그인 관련
ipcMain.handle('get-user-doc', async (event, email) => {
  try {
    const userDocRef = doc(db, 'users', email);  // 단일 문서 참조 생성
    const userDocSnap = await getDoc(userDocRef);  // getDoc으로 단일 문서 가져오기

    if (userDocSnap.exists()) {
      console.log('user email found:', email);
      return userDocSnap.data();
    } else {
      console.error('해당 이메일에 대한 사용자 데이터가 없습니다:', email);
      return null;
    }
  } catch (error) {
    console.error('사용자 데이터를 가져오는 중 오류 발생:', error);
    return null;
  }
});


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


//ipcMain.on('login', async (event, { email, password }) => {
  //try {
    //const userCredential = await signInWithEmailAndPassword(auth, email, password);
    //const loggedInEmail = userCredential.user.email;

    //console.log("로그인 성공:", loggedInEmail);
    //event.sender.send('login-success', { email: loggedInEmail });

    // 로그인 성공 시 이메일을 localStorage에 저장
    //BrowserWindow.getAllWindows().forEach(window => {
      //window.webContents.executeJavaScript(`localStorage.setItem('userEmail', '${loggedInEmail}')`);
    //});
  //} catch (error) {
    //console.error("로그인 실패:", error.message);
    //event.sender.send('login-failed', error.message);
  //}
//});




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





ipcMain.handle('auto-login', async (event, { url, id, password }) => {
  try {
    const loginWindow = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    loginWindow.loadURL(url);  // 로그인 페이지로 이동

    // 창이 로드된 후 로그인 폼 자동 채우기
    loginWindow.webContents.on('did-finish-load', () => {
      if (!loginWindow || loginWindow.isDestroyed()) {
        console.log('BrowserWindow has been destroyed.');
        return;  // 창이 파괴된 경우 중단
      }

      loginWindow.webContents.executeJavaScript(`
        const idField = document.myform?.m_id;
        const passwordField = document.myform?.m_pwd1;

        if (idField && passwordField) {
          idField.value = "${id}";
          passwordField.value = "${password}";
          document.myform.submit();  // 로그인 폼 제출
        } else {
          console.error('ID 또는 비밀번호 필드를 찾을 수 없습니다.');
        }
      `).then(() => {
        console.log('Login form submitted.');
      }).catch((error) => {
        console.error('자동 로그인 처리 중 오류 발생:', error);
      });
    });

    // 로컬에 정보가 남지 않도록 창이 닫힐 때 쿠키와 세션 삭제
    loginWindow.on('closed', () => {
      if (loginWindow && !loginWindow.isDestroyed()) {
        loginWindow.webContents.session.clearStorageData().then(() => {
          console.log('Session data cleared.');
        }).catch((error) => {
          console.error('세션 데이터 삭제 중 오류 발생:', error);
        });
      }
    });

  } catch (error) {
    console.error('자동 로그인 처리 중 오류 발생:', error);
  }
});





// main.js
ipcMain.on('navigate-to-write-page', (event) => {
  console.log("Navigating to write page"); // 확인 로그 추가
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


// Electron 애플리케이션 실행
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
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
    console.log("세션 지속성을 설정했습니다.");
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


// url 입력 후 새로운 창 열기
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

  win.loadURL(url.startsWith('http') ? url : `https://${url}`);

  win.webContents.on('did-finish-load', () => {
    console.log("페이지 로드 완료 및 MutationObserver 설정");
  });
  });

// Firestore에 사이트 데이터 저장
ipcMain.handle('save-site-data', async (event, siteData) => {
  const { id, password, url, email } = siteData;
  if (email) {
    try {
      const encodedUrl = encodeURIComponent(url);  // URL 인코딩
      const collectionPath = `users/${email}/sites`;
      await setDoc(doc(db, collectionPath, encodedUrl), {  // 인코딩된 URL 사용
        id,
        password,
        url,
      });
      console.log('Firestore에 사이트 데이터 저장 성공:', siteData);
    } catch (error) {
      console.error('Firestore에 사이트 데이터 저장 실패:', error);
    }
  } else {
    console.log('사용자가 로그인되어 있지 않습니다.');
  }
});

// 이메일 설정 이벤트
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