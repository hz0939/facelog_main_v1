//main.js
require('dotenv').config(); 
const CryptoJS = require('crypto-js'); 

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDoc, addDoc, setDoc, doc, getDocs, deleteDoc } = require('firebase/firestore');
const { getAuth, onAuthStateChanged, setPersistence, createUserWithEmailAndPassword, signInWithEmailAndPassword, browserSessionPersistence, signOut, } = require('firebase/auth');
const fs = require('fs');
const { execFile } = require('child_process');
const admin = require('firebase-admin');
const SECRET_KEY = process.env.SECRET_KEY; // .env 파일에서 SECRET_KEY 가져오기

let pythonProcess;
let win;
let mainWindow;
let lastEmbedding = null; // 전역 변수로 임베딩 값을 저장


// IPC로 임베딩 값을 저장
ipcMain.on('save-embedding', (event, embedding) => {
  
  lastEmbedding = embedding; // 임베딩 값을 전역 변수에 저장
});

// 다른 페이지에서 임베딩 값을 요청
ipcMain.handle('get-embedding', async () => {
  if (lastEmbedding) {
      return lastEmbedding; // 저장된 임베딩 값을 반환
  } else {
      throw new Error("저장된 임베딩 값이 없습니다.");
  }
});



ipcMain.handle('encrypt-data', (event, text) => {
  try {
    const encrypted = CryptoJS.AES.encrypt(text, SECRET_KEY).toString();
    return encrypted;
  } catch (error) { 
    return null;
  }
});
ipcMain.handle('decrypt-data', (event, encryptedText) => {
  try {
    if (!encryptedText || typeof encryptedText !== 'string') {  
      return null;
    }
    const bytes = CryptoJS.AES.decrypt(encryptedText, SECRET_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);

    if (!decrypted) {
      return null;
    }
    return decrypted;
  } catch (error) {
    return null;
  }
});


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
  .then(() => console.log(""))
  .catch(error => console.error(":", error.message));

let userEmail = null;
// Firebase 인증 상태 변경 시 사용자 이메일 업데이트
onAuthStateChanged(auth, (user) => {
  if (user) {
    userEmail = user.email;
    
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.executeJavaScript(`localStorage.setItem('userEmail', '${userEmail}')`);
    });
  } else {
    userEmail = null;
    
  }

});

const { spawn } = require('child_process'); // spawn 함수를 가져옵니다.

function createWindow() {
  win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // Preload 스크립트를 사용해 렌더러와 메인 프로세스 간의 통신 설정
      contextIsolation: true,
      nodeIntegration: false, 
      sandbox: false,
   // NodeIntegration을 비활성화하여 보안 강화
    }
  });

  win.loadFile('index.html');

  // 개발 환경에서 DevTools 열기
  if (process.env.NODE_ENV === 'development') {
    win.webContents.openDevTools();
  }
}

// 창이 이미 닫혔는지 확인하는 안전한 로드 함수
function safeLoadFile(filePath) {
  if (win && !win.isDestroyed()) {
    win.loadFile(filePath);
  } else {
    
  }
}


app.whenReady().then(() => {
  createWindow();

  });
  

  app.on('window-all-closed', () => {
  if (pythonProcess) pythonProcess.kill();
  if (process.platform !== 'darwin') app.quit();
  });

// 특정 창을 안전하게 닫는 함수
function closeWindow(window) {
  if (window && !window.isDestroyed()) {
    window.close();
  }
}


ipcMain.on('start-antispoofing', () => {
  if (pythonProcess) {
    pythonProcess.kill();
  
  }
  const pythonExecutablePath = 'C:\\Users\\heezin\\AppData\\Local\\Programs\\Python\\Python311\\python.exe'; 
  const pythonScriptPath = 'FFT_test_6channel_d.py'; 

  pythonProcess = spawn(pythonExecutablePath, [pythonScriptPath], {
    env: {
        ...process.env,
        PATH: 'C:\\Users\\heezin\\AppData\\Local\\Programs\\Python\\Python311\\Scripts;' + process.env.PATH, 
        PYTHONPATH: 'C:\\Users\\heezin\\AppData\\Local\\Programs\\Python\\Python311\\Lib\\site-packages', 
    },
});

  pythonProcess.stdout.on('data', (data) => {
    const result = data.toString().trim();
    
    try {
      const parsedResult = JSON.parse(result);
      BrowserWindow.getAllWindows().forEach((window) => {
        window.webContents.send('update-result', parsedResult);
      });
    } catch (error) {
    }
  });
  pythonProcess.stderr.on('data', (data) => {
  });
  pythonProcess.on('close', (code) => {  
  });
});


ipcMain.on('stop-antispoofing', () => {
  if (pythonProcess) {
    pythonProcess.kill(); // Python 프로세스 종료
    pythonProcess = null;
   
  }
});



app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});



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
    
  }
});



//main.js의 process-face-embedding
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

      // stdout 결과 파싱 후, NaN 값을 제거하고 한 번만 전송
      const embeddingArray = stdout
        .trim()
        .replace(/tensor\(|\)|\s+/g, '')
        .split(',')
        .map(Number)
        .map(value => isNaN(value) ? 0 : value); // NaN 값을 0으로 대체


      event.sender.send('face-embedding-result', JSON.stringify(embeddingArray));
    });
  });
});




// 회원가입 처리
ipcMain.on('sign-up', async (event, { email, password }) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
   
    event.sender.send('sign-up-success');
  } catch (error) {
    
    event.sender.send('sign-up-failed', error.message);
  }
});


ipcMain.on('save-embedding', (event, embedding) => {
  
  lastEmbedding = embedding; // 전역 변수에 저장
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
    
  } catch (error) {
    
  }
});


// main.js에서 중복 등록 방지
if (!ipcMain.listeners('get-user-doc').length) {
  ipcMain.handle('get-user-doc', async (event, email) => {
    try {
      
      const userDocRef = doc(db, 'users', email);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        return userDocSnap.data();
      } else {
        
        return null;
      }
    } catch (error) {
      
      return null;
    }
  });
}


// 로그인 성공 시 이메일 업데이트
ipcMain.on('login', async (event, { email, password }) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    userEmail = userCredential.user.email;
    

    event.sender.send('login-success', { email: userEmail });

    // localStorage에 이메일 저장
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.executeJavaScript(`localStorage.setItem('userEmail', '${userEmail}')`);
    });
  } catch (error) {
   
    event.sender.send('login-failed', error.message);
  }
});




ipcMain.on('logout', async (event) => {
  try {
    // Firebase 로그아웃 처리
    await signOut(auth);

    // Python 프로세스 종료
    if (pythonProcess) {
      pythonProcess.kill();
      pythonProcess = null;
      
    }

    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.executeJavaScript(`
        localStorage.removeItem('userEmail');
        localStorage.removeItem('tempEmail');
        localStorage.removeItem('tempPassword');
      `);
    });
    
    
    event.sender.send('logout-success');
  } catch (error) {
    
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
   
    return true;
  } catch (error) {
    
    throw error;
  }
});



// Firebase Authentication에서 사용자 삭제 함수
async function deleteAuthUser(userEmail) {
  try {
    const userRecord = await admin.auth().getUserByEmail(userEmail);
    await admin.auth().deleteUser(userRecord.uid);
    
  } catch (error) {
    
  }
}



// 'delete-auth-user' 이벤트 핸들러 수정
ipcMain.handle('delete-auth-user', async (event, userEmail) => {
  try {
    await deleteAuthUser(userEmail);
    return { success: true };
  } catch (error) {
   
    return { success: false, error: error.message };
  }
});




// Firestore에서 데이터 가져오기
ipcMain.handle('get-data', async (event, { collectionName }) => {
  try {
    

    const snapshot = await getDocs(collection(db, collectionName));
    return snapshot.docs.map(doc => doc.data());
  } catch (error) {
    
    throw error;
  }
});

//사이트 정보 저장
ipcMain.handle('write-data', async (event, { collectionName, data }) => {
  try {
    

    // collectionName이 사용자의 브 컬렉션 경로로 전달됨 (예: `users/userEmail/sites`)
    const docRef = await addDoc(collection(db, collectionName), data);
    
    return true;
  } catch (error) {
    
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

    
    return sites;
  } catch (error) {
    
    return [];
  }
});

ipcMain.handle('delete-site-data', async (event, userEmail, docId) => {
  try {
   
    const siteDocRef = doc(db, `users/${userEmail}/sites`, docId);
    const docSnapshot = await getDoc(siteDocRef);

    if (docSnapshot.exists()) {
      await deleteDoc(siteDocRef);
      
      return true;
    } else {
      
      return false;
    }
  } catch (error) {
    
    throw error;
  }
});




ipcMain.handle('auto-login', async (event, { url, id, password }) => {
  try {
    const loginWindow = new BrowserWindow({
      width: 800,
      height: 600,
      parent: null, 
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      }
    });
    const decodedUrl = decodeURIComponent(url);
    loginWindow.loadURL(decodedUrl);
    loginWindow.webContents.on('did-finish-load', () => {
    
      loginWindow.webContents.executeJavaScript(`
        window.electronAPI.send('disable-observer');
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
           
          } else {
          }
        `).catch(error => console.error('오류 발생:', error));
      }, 500); 
    });
    loginWindow.on('closed', () => {
      
      const mainWindow = BrowserWindow.getAllWindows().find(win => win.getTitle() === 'Main Page');
      if (mainWindow) {
        mainWindow.webContents.send('refresh-main-page');   
      }
    });
  } catch (error) {
  }
});


// main.js

ipcMain.on('navigate-to-antispoofing', () => {

  // 기존 Python 프로세스 종료
  if (pythonProcess) {
    pythonProcess.kill();
  }

  // 새로운 Python 프로세스 시작
  const pythonScriptPath = path.join(__dirname, 'FFT_test_6channel_d.py');
  pythonProcess = spawn('python', [pythonScriptPath]);

  pythonProcess.stdout.on('data', (data) => {
    const result = data.toString().trim();

    try {
      const parsedResult = JSON.parse(result);
      BrowserWindow.getAllWindows().forEach((window) => {
        window.webContents.send('update-result', parsedResult);
      });
    } catch (error) {
    }
  });

  pythonProcess.stderr.on('data', (data) => {
  });

  pythonProcess.on('close', (code) => {
  });

  // 페이지 로드
  const win = BrowserWindow.getAllWindows()[0];
  win.loadFile('antispoofing.html');
});


ipcMain.on('navigate-to-write-page', (event) => {
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

app.on('window-all-closed', () => {
  if (pythonProcess) pythonProcess.kill(); // Python 프로세스 종료
  if (process.platform !== 'darwin') app.quit();
});





app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});


auth.setPersistence(browserSessionPersistence)
  .then(() => {
  })
  .catch((error) => {
  });

auth.setPersistence(browserSessionPersistence)
.then(() => {
})
.catch((error) => {
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

        });



      // 새 창이 닫힐 때 메인 페이지 새로고침 요청
      win.on('closed', () => {
       
        const mainWindow = BrowserWindow.getAllWindows().find(win => win.getTitle() === 'Main Page');
        if (mainWindow) {
          mainWindow.webContents.send('refresh-main-page');
          
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
        } catch (error) {          
        }
      } else {
      }
    });



    ipcMain.on('set-user-email', (event, email) => {
      userEmail = email;
    });

    ipcMain.handle('get-user-email', async (event) => {
      const email = await new Promise((resolve) => {
        BrowserWindow.getAllWindows().forEach(window => {
          window.webContents.executeJavaScript(`localStorage.getItem('userEmail')`)
            .then((result) => resolve(result))
            .catch(() => resolve(null));
        });
      });
      return email;
    });
  