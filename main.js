//main.js

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection,getDoc,addDoc, setDoc, doc, getDocs, deleteDoc} = require('firebase/firestore');
const { getAuth, onAuthStateChanged, setPersistence,createUserWithEmailAndPassword,signInWithEmailAndPassword,browserSessionPersistence,signOut, } = require('firebase/auth'); 
const fs = require('fs');
const { execFile } = require('child_process');
const admin = require('firebase-admin');



// Firebase 占십깍옙화
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


let loggedInUserEmail = null; // 占싸깍옙占싸듸옙 占쏙옙占쏙옙占쏙옙占� 占싱몌옙占쏙옙
 setPersistence(auth, browserSessionPersistence)
  .then(() => console.log("占쏙옙占쏙옙 占쏙옙占쌈쇽옙占쏙옙 SESSION占쏙옙占쏙옙 占쏙옙占쏙옙占쌩쏙옙占싹댐옙."))
  .catch(error => console.error("占쏙옙占쏙옙 占쏙옙占쌈쇽옙 占쏙옙占쏙옙 占쏙옙 占쏙옙占쏙옙:", error.message));

let userEmail = null;
  // Firebase 占쏙옙占쏙옙 占쏙옙占쏙옙 占쏙옙占쏙옙 占쏙옙 占쏙옙占쏙옙占� 占싱몌옙占쏙옙 占쏙옙占쏙옙占쏙옙트
  onAuthStateChanged(auth, (user) => {
    if (user) {
      userEmail = user.email;
      console.log('占싸깍옙占쏙옙 占쏙옙占쏙옙, 占싱몌옙占쏙옙:', userEmail);
      BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.executeJavaScript(`localStorage.setItem('userEmail', '${userEmail}')`);
      });
    } else {
      userEmail = null;
      console.log('占싸그아울옙占쏙옙');
    }
    //loggedInUserEmail = user ? user.email : null;
    //BrowserWindow.getAllWindows().forEach(window => {
      //window.webContents.send('auth-state-changed', { email: loggedInUserEmail });
    //});
    //console.log(`占싸깍옙占쏙옙 占쏙옙占쏙옙 占쏙옙占쏙옙: ${loggedInUserEmail ? '占싸깍옙占싸듸옙' : '占싸그아울옙占쏙옙'}`);
  });

  

function createWindow() {
  win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // Preload 占쏙옙크占쏙옙트占쏙옙 占쏙옙占쏙옙占� 占쏙옙占쏙옙占쏙옙占쏙옙 占쏙옙占쏙옙 占쏙옙占싸쇽옙占쏙옙 占쏙옙占쏙옙 占쏙옙占� 占쏙옙占쏙옙
      contextIsolation: true,
      nodeIntegration: false,  // NodeIntegration占쏙옙 占쏙옙활占쏙옙화占싹울옙 占쏙옙占쏙옙 占쏙옙화
    }
  });

  win.loadFile('index.html');

  // 占쏙옙占쏙옙 환占썸에占쏙옙 DevTools 占쏙옙占쏙옙
  if (process.env.NODE_ENV === 'development') {
    win.webContents.openDevTools();
  }
}

// 특占쏙옙 창占쏙옙 占쏙옙占쏙옙占싹곤옙 占쌥댐옙 占쌉쇽옙
function closeWindow(window) {
  if (window && !window.isDestroyed()) {
    window.close();
  }
}

ipcMain.on('close-login-window', (event) => {
  if (loginWindow && !loginWindow.isDestroyed()) {  // loginWindow占쏙옙 占쏙옙占쏙옙占싹곤옙 占식깍옙占쏙옙占쏙옙 占쏙옙占쏙옙 占쏙옙荑∽옙占� 占쌥깍옙
    loginWindow.close();
    loginWindow = null;  // 창占쏙옙 占쏙옙占쏙옙 占쏙옙 占쏙옙占쏙옙占쏙옙 占쏙옙占쏙옙占쏙옙 占쌨몌옙 占쏙옙占쏙옙 占쏙옙占쏙옙
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

// 회占쏙옙占쏙옙占쏙옙 처占쏙옙
ipcMain.on('sign-up', async (event, { email, password }) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    console.log(`회占쏙옙占쏙옙占쏙옙 占쏙옙占쏙옙: ${userCredential.user.email}`);
    event.sender.send('sign-up-success');
  } catch (error) {
    console.error(`회占쏙옙占쏙옙占쏙옙 占쏙옙占쏙옙: ${error.message}`);
    event.sender.send('sign-up-failed', error.message);
  }
});

// get-auth-user 占쌘들러 占쏙옙占쏙옙
ipcMain.handle('get-auth-user', async () => {
  return userEmail ? { email: userEmail } : null;
});
//ipcMain.handle('get-auth-user', async () => {
  //return loggedInUserEmail ? { email: loggedInUserEmail } : null;
//});


ipcMain.handle('save-user-embedding', async (event, { email, faceEmbedding }) => {
  try {
    // Firebase Firestore占쏙옙 占쏙옙 占쌈븝옙占쏙옙 占쏙옙占쏙옙
    await setDoc(doc(db, "users", email), {
      email: email,
      faceEmbedding: faceEmbedding
    });
    console.log('占쏙옙 占쌈븝옙占쏙옙 占쏙옙占쏙옙 占쏙옙占쏙옙');
  } catch (error) {
    console.error('占쏙옙 占쌈븝옙占쏙옙 占쏙옙占쏙옙 占쏙옙占쏙옙:', error);
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



// 占싸깍옙占쏙옙 占쏙옙占쏙옙 占쏙옙 占싱몌옙占쏙옙 占쏙옙占쏙옙占쏙옙트
ipcMain.on('login', async (event, { email, password }) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    userEmail = userCredential.user.email;
    console.log("占싸깍옙占쏙옙 占쏙옙占쏙옙:", userEmail);

    event.sender.send('login-success', { email: userEmail });

    // localStorage占쏙옙 占싱몌옙占쏙옙 占쏙옙占쏙옙
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.executeJavaScript(`localStorage.setItem('userEmail', '${userEmail}')`);
    });
  } catch (error) {
    console.error("占싸깍옙占쏙옙 占쏙옙占쏙옙:", error.message);
    event.sender.send('login-failed', error.message);
  }
});


//ipcMain.on('login', async (event, { email, password }) => {
  //try {
    //const userCredential = await signInWithEmailAndPassword(auth, email, password);
    //const loggedInEmail = userCredential.user.email;

    //console.log("占싸깍옙占쏙옙 占쏙옙占쏙옙:", loggedInEmail);
    //event.sender.send('login-success', { email: loggedInEmail });

    // 占싸깍옙占쏙옙 占쏙옙占쏙옙 占쏙옙 占싱몌옙占쏙옙占쏙옙 localStorage占쏙옙 占쏙옙占쏙옙
    //BrowserWindow.getAllWindows().forEach(window => {
      //window.webContents.executeJavaScript(`localStorage.setItem('userEmail', '${loggedInEmail}')`);
    //});
  //} catch (error) {
    //console.error("占싸깍옙占쏙옙 占쏙옙占쏙옙:", error.message);
    //event.sender.send('login-failed', error.message);
  //}
//});




// 占싸그아울옙 占쏙옙 占싱몌옙占쏙옙 占십깍옙화
ipcMain.on('logout', async (event) => {
  try {
    await signOut(auth);
    loggedInUserEmail = null;
    console.log('占싸그아울옙 占쏙옙占쏙옙');
    event.sender.send('logout-success');
  } catch (error) {
    console.error(`占싸그아울옙 占쏙옙占쏙옙: ${error.message}`);
    event.sender.send('logout-failed', error.message);
  }
});

// 회占쏙옙탈占쏙옙
ipcMain.on('navigate-to-delete-auth', () => {
  win.loadFile('delete_auth.html');
});

// 회占쏙옙 탈占쏙옙 占쌨쇽옙占쏙옙 占쏙옙占쏙옙
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

// Firebase Authentication占쏙옙占쏙옙 占쏙옙占쏙옙占� 占쏙옙占쏙옙 占쌉쇽옙
async function deleteAuthUser(userEmail) {
  try {
    const userRecord = await admin.auth().getUserByEmail(userEmail);
    await admin.auth().deleteUser(userRecord.uid);
    console.log(`User with email ${userEmail} deleted from Authentication.`);
  } catch (error) {
    console.error(`Error deleting authenticated user:`, error);
  }
}

// 'delete-auth-user' 占싱븝옙트 占쌘들러 占쏙옙占쏙옙
ipcMain.handle('delete-auth-user', async (event, userEmail) => {
  try {
    await deleteAuthUser(userEmail);
    return { success: true };
  } catch (error) {
    console.error('Error deleting authenticated user:', error);
    return { success: false, error: error.message };
  }
});



// Firestore占쏙옙占쏙옙 占쏙옙占쏙옙占쏙옙 占쏙옙占쏙옙占쏙옙占쏙옙
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

//占쏙옙占쏙옙트 占쏙옙占쏙옙 占쏙옙占쏙옙
ipcMain.handle('write-data', async (event, { collectionName, data }) => {
  try {
    console.log(`Firestore占쏙옙 占시뤄옙占쏙옙 占쏙옙恝占� 占쏙옙占쏙옙占쏙옙 占쏙옙占쏙옙: ${collectionName}`, data);

    // collectionName占쏙옙 占쏙옙占쏙옙占쏙옙占� 占쏙옙 占시뤄옙占쏙옙 占쏙옙管占� 占쏙옙占쌨듸옙 (占쏙옙: `users/userEmail/sites`)
    const docRef = await addDoc(collection(db, collectionName), data);
    console.log('占쏙옙占쏙옙占쏙옙 占쏙옙占쏙옙占쏙옙占쏙옙占쏙옙 占쏙옙占쏙옙퓸占쏙옙占쏙옙求占�. ID:', docRef.id);

    return true;
  } catch (error) {
    console.error('Firestore 占쏙옙占쏙옙 占쏙옙占쏙옙 占쏙옙 占쏙옙占쏙옙:', error);
    throw error;
  }
});

ipcMain.handle('get-user-sites', async (event, userEmail) => {
  try {
    const sitesCollectionRef = collection(db, `users/${userEmail}/sites`);
    const querySnapshot = await getDocs(sitesCollectionRef);

    // Firestore占쏙옙占쏙옙 占쏙옙占쏙옙占쏙옙 占쏙옙占쏙옙占싶몌옙 占썼열占쏙옙 占쏙옙환
    const sites = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log("占쌀뤄옙占쏙옙 占쏙옙占쏙옙트 占쏙옙占쏙옙占쏙옙:", sites); // 占쏙옙占쏙옙占쏙옙 占싸깍옙
    return sites;
  } catch (error) {
    console.error("占쏙옙占쏙옙트 占쏙옙占쏙옙占싶몌옙 占쌀뤄옙占쏙옙占쏙옙 占쏙옙 占쏙옙占쏙옙 占쌩삼옙:", error);
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

    loginWindow.loadURL(url);  // 占싸깍옙占쏙옙 占쏙옙占쏙옙占쏙옙占쏙옙 占싱듸옙

    // 창占쏙옙 占싸듸옙占� 占쏙옙 占싸깍옙占쏙옙 占쏙옙 占쌘듸옙 채占쏙옙占�
    loginWindow.webContents.on('did-finish-load', () => {
      if (!loginWindow || loginWindow.isDestroyed()) {
        console.log('BrowserWindow has been destroyed.');
        return;  // 창占쏙옙 占식깍옙占쏙옙 占쏙옙占� 占쌩댐옙
      }

      loginWindow.webContents.executeJavaScript(`
        const idField = document.myform?.m_id;
        const passwordField = document.myform?.m_pwd1;

        if (idField && passwordField) {
          idField.value = "${id}";
          passwordField.value = "${password}";
          document.myform.submit();  // 占싸깍옙占쏙옙 占쏙옙 占쏙옙占쏙옙
        } else {
          console.error('ID 占실댐옙 占쏙옙橘占싫� 占십드를 찾占쏙옙 占쏙옙 占쏙옙占쏙옙占싹댐옙.');
        }
      `).then(() => {
        console.log('Login form submitted.');
      }).catch((error) => {
        console.error('占쌘듸옙 占싸깍옙占쏙옙 처占쏙옙 占쏙옙 占쏙옙占쏙옙 占쌩삼옙:', error);
      });
    });

    // 占쏙옙占시울옙 占쏙옙占쏙옙占쏙옙 占쏙옙占쏙옙 占십듸옙占쏙옙 창占쏙옙 占쏙옙占쏙옙 占쏙옙 占쏙옙키占쏙옙 占쏙옙占쏙옙 占쏙옙占쏙옙
    loginWindow.on('closed', () => {
      if (loginWindow && !loginWindow.isDestroyed()) {
        loginWindow.webContents.session.clearStorageData().then(() => {
          console.log('Session data cleared.');
        }).catch((error) => {
          console.error('占쏙옙占쏙옙 占쏙옙占쏙옙占쏙옙 占쏙옙占쏙옙 占쏙옙 占쏙옙占쏙옙 占쌩삼옙:', error);
        });
      }
    });

  } catch (error) {
    console.error('占쌘듸옙 占싸깍옙占쏙옙 처占쏙옙 占쏙옙 占쏙옙占쏙옙 占쌩삼옙:', error);
  }
});





// main.js
ipcMain.on('navigate-to-write-page', (event) => {
  console.log("Navigating to write page"); // 확占쏙옙 占싸깍옙 占쌩곤옙
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


// Electron 占쏙옙占시몌옙占쏙옙占싱쇽옙 占쏙옙占쏙옙
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
    console.log("占쏙옙占쏙옙 占쏙옙占쌈쇽옙占쏙옙 占쏙옙占쏙옙占쌩쏙옙占싹댐옙.");
  })
  .catch((error) => {
    console.error("占쏙옙占쏙옙 占쏙옙占쌈쇽옙 占쏙옙占쏙옙 占쏙옙 占쏙옙占쏙옙:", error.message);
  });


// Firebase 占쏙옙占쏙옙 占쏙옙占쏙옙占쏙옙 占쏙옙占쏙옙占쏙옙 占쏙옙占쏙옙 占쏙옙占쏙옙 占쏙옙 占쏙옙占쏙옙풩占쏙옙占� 占쏙옙占쏙옙
auth.setPersistence(browserSessionPersistence)
.then(() => {
  console.log("占쏙옙占쏙옙 占쏙옙占쌈쇽옙占쏙옙 SESSION占쏙옙占쏙옙 占쏙옙占쏙옙");
})
.catch((error) => {
  console.error("占쏙옙占쏙옙 占쏙옙占쌈쇽옙 占쏙옙占쏙옙 占쏙옙 占쏙옙占쏙옙:", error.message);
});


// url 占쌉뤄옙 占쏙옙 占쏙옙占싸울옙 창 占쏙옙占쏙옙
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
    console.log("占쏙옙占쏙옙占쏙옙 占싸듸옙 占싹뤄옙 占쏙옙 MutationObserver 占쏙옙占쏙옙");
  });
  });

  // Firestore占쏙옙 占쏙옙占쏙옙트 占쏙옙占쏙옙占쏙옙 占쏙옙占쏙옙
  ipcMain.on('save-site-data', async (event, siteData) => {
    if (userEmail) {
      try {
        const collectionPath = `users/${userEmail}/sites`;
          await setDoc(doc(db, collectionPath, siteData.url), {
            id: siteData.id,
            password: siteData.password,
            url: siteData.url
            });
            console.log('Firestore占쏙옙 占쏙옙占쏙옙트 占쏙옙占쏙옙占쏙옙 占쏙옙占쏙옙 占쏙옙占쏙옙:', siteData);
        } catch (error) {
            console.error('Firestore占쏙옙 占쏙옙占쏙옙트 占쏙옙占쏙옙占쏙옙 占쏙옙占쏙옙 占쏙옙占쏙옙:', error);
        }
  } else {
      console.log('占쏙옙占쏙옙微占� 占싸깍옙占싸되억옙 占쏙옙占쏙옙 占십쏙옙占싹댐옙.');
  }
  
 });

// 占싱몌옙占쏙옙 占쏙옙占쏙옙 占싱븝옙트
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
  console.log("get-user-email 占쌘들러占쏙옙占쏙옙 占쏙옙占쏙옙占쏙옙 占싱몌옙占쏙옙:", email);
  return email;
});