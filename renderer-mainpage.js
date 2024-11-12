
let stream = null;
let video = null;
let userEmail = null;
let isVerifying = false;
let isListenerRegistered = false;
let isUserDocRequestInProgress = false;
let isAlertShown = false;

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
  try {
    if (!video) {
      // video 요소를 한 번만 생성하여 위치와 크기를 고정
      video = document.createElement('video');
      video.id = 'webcam-video';
      video.style.width = '200px';
      video.style.height = '150px';
      video.style.position = 'fixed';
      video.style.left = '10px';
      video.style.bottom = '10px';
      video.style.zIndex = '1000';
      video.style.objectFit = 'cover';
      video.style.display = 'none';
      document.body.appendChild(video);
    }

    // 새로운 스트림을 요청하고 video 요소에 할당
    stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    video.style.transform = 'scaleX(-1)';  
    await video.play();
    video.style.display = 'block'; // 비디오 요소 보이기
    console.log("웹캠이 정상적으로 시작되었습니다.");
  } catch (error) {
    console.error('웹캠을 시작하는 중 오류 발생:', error);
  }
}


function stopWebcam() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop()); // 스트림 중지로 캠 불빛 끄기
    stream = null;
  }
  if (video) {
    video.style.display = 'none'; // 비디오 요소 숨기기
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
  
  
    function startPeriodicVerification() {
      async function verify() {
        await performFaceVerification();
        setTimeout(verify, 1000000); // 30초 간격으로 호출
      }
      verify();
    }

 
// 메인 함수
async function main() {
  console.log("main() 함수 실행");
  await startWebcam();
  startPeriodicVerification();

  console.log('mainpage.html 로드 완료. 주기적인 얼굴 인증 기능 시작 준비 중...');
  const dataDisplay = document.getElementById('data-display');
  const logOutButton = document.getElementById('logOutButton');
  const addButton = document.getElementById('addButton');
  const logo = document.getElementById('logo');
  const deleteAccountButton = document.getElementById('deleteAccountButton');
  const goButton = document.getElementById('go-button');

  console.log("로그인된 사용자 이메일:", userEmail);

  if (!userEmail) {
    alert('로그인된 사용자 정보가 없습니다.');
    window.location.href = 'login_face.html';
    return;
  }
}
document.addEventListener('DOMContentLoaded', async () => {
  await startWebcam();
  startPeriodicVerification();
});
