let stream = null;
let video = null;
let userEmail = null;
let isVerifying = false;
let isListenerRegistered = false;
let isUserDocRequestInProgress = false;
let isAlertShown = false;
let dataDisplay = null;

async function fetchUserDoc(email) {
  if (isUserDocRequestInProgress) {
    console.log('get-user-doc 요청이 이미 진행 중입니다.');
    return;
  }

  try {
    isUserDocRequestInProgress = true;
    const userDoc = await window.electronAPI.getUserDoc(email);
    isUserDocRequestInProgress = false;
    return userDoc;
  } catch (error) {
    isUserDocRequestInProgress = false;
    console.error('fetchUserDoc 중 오류 발생:', error);
  }
}

async function startWebcam() {
  if (!video) {
    video = document.createElement('video');
    video.id = 'webcam-video';
    video.style.width = '200px';
    video.style.height = '150px';
    video.style.position = 'fixed';
    video.style.left = '10px';
    video.style.bottom = '10px';
    video.style.zIndex = '1000';
    video.style.objectFit = 'cover';
    document.body.appendChild(video);
  }

  if (!stream) {
    stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    video.style.transform = 'scaleX(-1)'; 
    await video.play();
  }

  video.style.display = 'block';
}

function stopWebcam() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  if (video) {
    video.style.display = 'none';
  }
}

function cosSimilarity(embedding1, embedding2) {
  // NaN 값을 0으로 대체
  const cleanedEmbedding1 = embedding1.map(value => isNaN(value) ? 0 : value);
  const cleanedEmbedding2 = embedding2.map(value => isNaN(value) ? 0 : value);

  const dotProduct = cleanedEmbedding1.reduce((sum, val, index) => sum + val * cleanedEmbedding2[index], 0);
  const norm1 = Math.sqrt(cleanedEmbedding1.reduce((sum, val) => sum + val * val, 0));
  const norm2 = Math.sqrt(cleanedEmbedding2.reduce((sum, val) => sum + val * val, 0));

  // 유사도 계산 시 0으로 나누는 오류 방지
  if (norm1 === 0 || norm2 === 0) {
    console.error("임베딩 벡터의 길이가 0입니다.");
    return 0;
  }

  return dotProduct / (norm1 * norm2);
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = "toast show";

  // 3초 후에 자동으로 사라지도록 설정
  setTimeout(() => {
    toast.className = "toast";
  }, 3000);
}


function showSystemNotification(message) {
  const notification = new Notification("얼굴 인증 알림", {
    body: message,
    icon: "img/looknlock-logo.png", // 아이콘을 추가할 수 있습니다.
    silent: true, // 소리 없이 표시
  });

  // 알림 클릭 시의 동작 (선택 사항)
  notification.onclick = () => {
    console.log("알림이 클릭되었습니다.");
  };
}


// 얼굴 인증 시작 전에 알림 표시
function startFaceVerificationNotification() {
  showSystemNotification("얼굴 인증이 곧 시작됩니다. 준비해 주세요!");
}


//site id와 비밀번호가 복호화 됨
async function loadUserSites(userEmail) {
  const sites = await window.electronAPI.getUserSites(userEmail);

  if (sites.length > 0) {
    dataDisplay.innerHTML = sites.map(site => {
      return `
        <div class="site-entry">
          <button class="site-icon" data-url="${site.url}" data-id="${site.id}" data-password="${site.password}">
            <img src="${site.icon || 'default-icon.png'}" alt="${site.name}">
            <p>${site.name}</p>
          </button>
        </div>
      `;
    }).join('');


    // 사이트 아이콘 클릭 시 복호화 및 자동 로그인
    document.querySelectorAll('.site-icon').forEach(async (icon) => {
      const encryptedID = icon.getAttribute('data-id');
      const encryptedPassword = icon.getAttribute('data-password');

      try {
        // 암호화된 ID와 비밀번호 복호화
        const decryptedID = await window.cryptoAPI.decryptData(encryptedID);
        const decryptedPassword = await window.cryptoAPI.decryptData(encryptedPassword);

        icon.addEventListener('click', () => {
          const url = decodeURIComponent(icon.getAttribute('data-url'));
          console.log(`자동 로그인 시도: URL=${url}, ID=${decryptedID}, Password=${decryptedPassword}`);
          window.electronAPI.autoLogin(url, decryptedID, decryptedPassword);
        });
      } catch (error) {
        console.error('복호화 오류:', error);
        alert('복호화 중 오류가 발생했습니다. 다시 시도해 주세요.');
      }
    });
  } else {
    dataDisplay.innerHTML = "<p>등록된 사이트 정보가 없습니다.</p>";
  }
}



  // more-options 버튼 클릭 시 context-menu 표시
  document.querySelectorAll('.more-options').forEach(button => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const siteEntry = button.closest('.site-entry');
      const contextMenu = siteEntry.querySelector('.context-menu');
      contextMenu.style.display = 'block';

      // 다른 곳 클릭 시 메뉴 닫기
      document.addEventListener('click', (e) => {
        if (!contextMenu.contains(e.target)) {
          contextMenu.style.display = 'none';
        }
      }, { once: true });
    });
  });

    // 삭제 버튼 클릭 시 Firestore에서 데이터 삭제
    document.querySelectorAll('.delete-button').forEach(button => {
      button.addEventListener('click', async (event) => {
        event.stopPropagation();
        const siteEntry = button.closest('.site-entry');
        const siteUrl = siteEntry.querySelector('.site-icon').getAttribute('data-url');
  
        // URL을 한 번만 인코딩하여 Firestore의 문서 ID 형식과 일치시킴
        const docId = encodeURIComponent(siteUrl);
        console.log("Firestore에서 삭제 요청할 한 번 인코딩된 문서 ID:", docId);
  
        if (!docId) {
          alert("삭제할 문서 ID가 없습니다.");
          return;
        }
  
        try {
          await window.electronAPI.deleteSiteData(userEmail, docId);
          alert('사이트 정보가 Firestore에서 삭제되었습니다.');
          location.reload(); // 삭제 후 페이지 새로고침
        } catch (error) {
          console.error('Firestore에서 사이트 데이터 삭제 실패:', error);
          alert('사이트 삭제에 실패했습니다.');
        }
      });
    });

    // URL 입력 및 사이트 이동 버튼 클릭 시
    document.getElementById('go-button').addEventListener('click', () => {
      const urlInput = document.getElementById('url-input').value.trim();
      const url = urlInput.startsWith('http') ? urlInput : `https://${urlInput}`;
      if (url) {
        console.log("URL 입력:", url);
        window.electronAPI.openUrlInNewWindow(url);
      } else {
        console.error("URL 입력 값이 비어 있습니다.");
      }
    });





function startPeriodicVerification() {
  async function verify() {
    if (!isVerifying) {
      await performFaceVerification();
    }
    setTimeout(verify, 30000);
  }
  verify();
}


  // 회원 탈퇴 버튼 클릭 시
  if (deleteAccountButton) {
    deleteAccountButton.addEventListener('click', () => {
      window.electronAPI.navigateToDeleteAuth();
    });
  }

  const logo = document.getElementById('logo');

  if (logo) {
    logo.addEventListener('click', async () => {
      const user = await window.electronAPI.getAuthUser();
      if (user) {
        window.location.href = 'mainpage.html';
      } else {
        window.electronAPI.navigateToMainPage();
      }
    });
  }
  


  async function performFaceVerification() {
    if (isVerifying) {
      console.log('이미 얼굴 인증이 진행 중입니다.');
      return;
    }
    startFaceVerificationNotification();{
    console.log('performFaceVerification() 호출 시작');
    isVerifying = true;
    }
  
    try {
      userEmail = localStorage.getItem('userEmail');
      if (!userEmail) {
        alert('사용자 이메일 정보가 없습니다.');
        window.location.href = 'login_face.html';
        isVerifying = false;
        return;
      }
  
      // 얼굴 인증 시작 시 웹캠 켜기
      await startWebcam();
  
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = canvas.toDataURL('image/png');
  
      // 얼굴 임베딩 생성 요청 전송
      window.electronAPI.sendEmbeddingRequest(imageData);
  
      if (!isListenerRegistered) {
        window.electronAPI.onEmbeddingResult(async (newEmbedding) => {
          console.log('onEmbeddingResult 내부의 임베딩 결과:', newEmbedding);
  
          const userDoc = await fetchUserDoc(userEmail);
  
          if (!userDoc || !userDoc.faceEmbedding) {
            console.error("사용자 데이터에 faceEmbedding이 없습니다.");
            alert('얼굴 임베딩 데이터를 찾을 수 없습니다.');
            stopWebcam();
            isVerifying = false;
            return;
          }
  
          console.log('DB에서 가져온 사용자 얼굴 임베딩 데이터:', userDoc.faceEmbedding);
  
          const storedEmbedding = userDoc.faceEmbedding.split(',').map(Number);
          const newEmbeddingArray = newEmbedding.split(',').map(Number);
  
          const similarity = cosSimilarity(newEmbeddingArray, storedEmbedding);
          console.log('코사인 유사도:', similarity);
  
          if (similarity > 0.75) {
            showToast('얼굴 인증 성공');
          } else {
            alert('얼굴 인증 실패. 자동 로그아웃을 수행합니다.');
            window.electronAPI.logOut();
            window.location.href = 'index.html';
          }
  
          // 얼굴 인증이 끝난 후 웹캠 종료
          stopWebcam();
          isVerifying = false;
        });
  
        isListenerRegistered = true;
      }
    } catch (error) {
      console.error('performFaceVerification() 중 오류 발생:', error);
      isVerifying = false;
      stopWebcam();
    }
  }
  if (logOutButton) {
    logOutButton.addEventListener('click', () => {
      window.electronAPI.logOut();
      localStorage.removeItem('userEmail');
      window.electronAPI.navigateToIndex();
    });
  }

  if (addButton) {
    addButton.addEventListener('click', () => {
      console.log("Navigating to write page");
      window.electronAPI.navigateToWritePage();
    });
  } else {
    console.error("addButton 요소를 찾을 수 없습니다.");
  }
  
  document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOMContentLoaded 이벤트 트리거");
  
    // cryptoAPI 준비 상태 확인
    if (window.cryptoAPI && typeof window.cryptoAPI.decryptData === 'function') {
      console.log("cryptoAPI 준비 완료");
  
      // 테스트 복호화 호출 (임의의 encryptedText 대신 실제 암호화된 텍스트를 넣어도 됨)
      const decryptedData = await window.cryptoAPI.decryptData("encryptedText");
      console.log("복호화된 데이터:", decryptedData);
    } else {
      console.error("cryptoAPI가 준비되지 않았습니다.");
      return;
    }
  
    dataDisplay = document.getElementById('data-display');
  
    if (!dataDisplay) {
      console.error("dataDisplay 요소를 찾을 수 없습니다.");
      return;
    }
  
    await startWebcam();
    await loadUserSites(localStorage.getItem('userEmail'));
    startPeriodicVerification();
  });
  


// 'refresh-main-page' 이벤트 수신 시 Firestore에서 최신 사이트 정보 불러오기
window.electronAPI.on('refresh-main-page-to-renderer', async () => {
  console.log("메인 페이지에서 'refresh-main-page-to-renderer' 이벤트 수신됨, Firestore에서 최신 데이터 불러오기");
  const userEmail = localStorage.getItem('userEmail');
  if (userEmail) {
    await loadUserSites(userEmail);
    console.log("메인 페이지가 새로고침되었습니다.");
  }
});

