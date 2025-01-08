//코드끼리합친거
let stream = null;
let video = null;
let userEmail = null;
let isVerifying = false;
let isListenerRegistered = false;
let isUserDocRequestInProgress = false;
let isAlertShown = false;
let dataDisplay = null;

// 사용자 문서 가져오기
async function fetchUserDoc(email) {
  if (isUserDocRequestInProgress) {
    return;
  }
  try {
    isUserDocRequestInProgress = true;
    const userDoc = await window.electronAPI.getUserDoc(email);
    isUserDocRequestInProgress = false;
    return userDoc;
  } catch (error) {
    isUserDocRequestInProgress = false;
  }
}

// 웹캠 시작
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

// 웹캠 정지
function stopWebcam() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  if (video) {
    video.style.display = 'none';
  }
}

// 코사인 유사도 계산
function cosSimilarity(embedding1, embedding2) {
  const cleanedEmbedding1 = embedding1.map(value => isNaN(value) ? 0 : value);
  const cleanedEmbedding2 = embedding2.map(value => isNaN(value) ? 0 : value);

  const dotProduct = cleanedEmbedding1.reduce((sum, val, index) => sum + val * cleanedEmbedding2[index], 0);
  const norm1 = Math.sqrt(cleanedEmbedding1.reduce((sum, val) => sum + val * val, 0));
  const norm2 = Math.sqrt(cleanedEmbedding2.reduce((sum, val) => sum + val * val, 0));

  if (norm1 === 0 || norm2 === 0) {
    return 0;
  }

  return dotProduct / (norm1 * norm2);
}

// Toast 메시지 표시
function showToast(message, position = 'bottom') {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.position = 'fixed';
  toast.style.left = '50%';
  toast.style.transform = 'translateX(-50%)';
  toast.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  toast.style.color = '#fff';
  toast.style.padding = '10px 20px';
  toast.style.borderRadius = '5px';
  toast.style.fontSize = '14px';
  toast.style.zIndex = '9999';
  toast.style.transition = 'opacity 0.2s ease'; 
  toast.style.opacity = '1';

  if (position === 'bottom') {
    toast.style.bottom = '20px';
  } else if (position === 'middle') {
    toast.style.bottom = '50%';
  } else if (position === 'top') {
    toast.style.top = '20px';
  }

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      toast.remove();
    }, 200);
  }, 1500);
}

// 얼굴 인증 시작 전에 알림
function startFaceVerificationNotification() {
  const notification = new Notification("얼굴 인증 알림", {
    body: "얼굴 인증이 곧 시작됩니다. 준비해 주세요!",
    icon: "img/looknlock-logo.png",
    silent: true,
  });

  notification.onclick = () => {
  };
}


//site id와 비밀번호
async function loadUserSites(userEmail) {

  if (!userEmail) {
    console.error("유효하지 않은 userEmail:", userEmail);
    return;
  }

  try {
    const sites = await window.electronAPI.getUserSites(userEmail);


    if (!sites || sites.length === 0) {
      dataDisplay.innerHTML = "<p>등록된 사이트 정보가 없습니다.</p>";
      return;
    }

    dataDisplay.innerHTML = sites.map(site => {
      const fullTitle = site.title || 'Untitled';
      const maxLength = 7; // 제목 길이 제한
      const shortTitle = fullTitle.length > maxLength ? `${fullTitle.slice(0, maxLength)}...` : fullTitle;



      return `
        <div class="site-entry">
          <button class="site-icon" 
            data-url="${site.url}" 
            data-id="${site.id}" 
            data-password="${site.password}" 
            data-is-encrypted="${site.isEncrypted}" 
            data-doc-id="${site.id}">
            <img class="site-icon-img" src="${site.icon || 'default-icon.png'}" alt="${fullTitle} icon">
            <p class="site-title">${shortTitle}</p>
          </button>
          <button class="more-options">...</button>
          <div class="context-menu">
            <button class="edit-button">바로가기 수정</button>
            <button class="delete-button">삭제</button>
          </div>
        </div>
      `;
    }).join('');



    // 사이트 아이콘 클릭 시 복호화 및 자동 로그인
    document.querySelectorAll('.site-icon').forEach(icon => {
      const encryptedID = icon.getAttribute('data-id');
      const encryptedPassword = icon.getAttribute('data-password');
      const isEncrypted = icon.getAttribute('data-is-encrypted') === 'true';

      icon.addEventListener('click', async () => {
        const url = decodeURIComponent(icon.getAttribute('data-url'));
        let id = encryptedID;
        let password = encryptedPassword;

        try {
          // 암호화된 경우 복호화 수행
          if (isEncrypted) {
            id = await window.cryptoAPI.decryptData(encryptedID);
            password = await window.cryptoAPI.decryptData(encryptedPassword);
          }


          await window.electronAPI.autoLogin(url, id, password);
        } catch (error) {
          console.error("자동 로그인 중 오류 발생:", error);
        }
      });
    });
  } catch (error) {
    console.error("사이트 데이터를 가져오는 중 오류 발생:", error);
    dataDisplay.innerHTML = "<p>사이트 데이터를 로드하는 데 실패했습니다.</p>";
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

        if (!docId) {
          alert("삭제할 문서 ID가 없습니다.");
          return;
        }
  
        try {
          await window.electronAPI.deleteSiteData(userEmail, docId);
          alert('사이트 정보가 Firestore에서 삭제되었습니다.');
          location.reload(); // 삭제 후 페이지 새로고침
        } catch (error) {
          alert('사이트 삭제에 실패했습니다.');
        }
      });
    });

    // URL 입력 및 사이트 이동 버튼 클릭 시
    document.getElementById('go-button').addEventListener('click', () => {
      const urlInput = document.getElementById('url-input').value.trim();
      const url = urlInput.startsWith('http') ? urlInput : `https://${urlInput}`;
      if (url) {
        window.electronAPI.openUrlInNewWindow(url);
      } else {
      }
    });





function startPeriodicVerification() {
  async function verify() {
    if (!isVerifying) {
      await performFaceVerification();
    }
    setTimeout(verify, 600000); //얼굴인증 주기
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
  
          const userDoc = await fetchUserDoc(userEmail);
  
          if (!userDoc || !userDoc.faceEmbedding) {
            alert('얼굴 임베딩 데이터를 찾을 수 없습니다.');
            stopWebcam();
            isVerifying = false;
            return;
          }
  
          const storedEmbedding = userDoc.faceEmbedding.split(',').map(Number);
          const newEmbeddingArray = newEmbedding.split(',').map(Number);
  
          const similarity = cosSimilarity(newEmbeddingArray, storedEmbedding);
          console.log('코사인 유사도:', similarity);
  
          if (similarity > 0.6) {
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
      window.electronAPI.navigateToWritePage();
    });
  } else {
  }
  
  document.addEventListener('DOMContentLoaded', async () => {
    
  
    // cryptoAPI 준비 상태 확인
    if (window.cryptoAPI && typeof window.cryptoAPI.decryptData === 'function') {
  
      // 테스트 복호화 호출 (임의의 encryptedText 대신 실제 암호화된 텍스트를 넣어도 됨)
      const decryptedData = await window.cryptoAPI.decryptData("encryptedText");
    } else {
      return;
    }
  
    dataDisplay = document.getElementById('data-display');
  
    if (!dataDisplay) {
      return;
    }
  
    await startWebcam();
    await loadUserSites(localStorage.getItem('userEmail'));
    // 주기적 얼굴 인증 비활성화
   startPeriodicVerification();
  });
  


// 'refresh-main-page' 이벤트 수신 시 Firestore에서 최신 사이트 정보 불러오기
window.electronAPI.on('refresh-main-page-to-renderer', async () => {
  const userEmail = localStorage.getItem('userEmail');
  if (userEmail) {
    await loadUserSites(userEmail);
  }
});