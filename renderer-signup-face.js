document.addEventListener('DOMContentLoaded', () => {
  const video = document.getElementById('video');
  const captureButton = document.getElementById('captureButton');

  // 웹캠 스트림 시작
  navigator.mediaDevices.getUserMedia({ video: true })
    .then((stream) => {
      console.log("웹캠 스트림 시작");
      video.srcObject = stream;
      video.style.transform = 'scaleX(-1)';
      video.play();
    })
    .catch((error) => {
      console.error('웹캠을 실행할 수 없습니다:', error);
    });

  captureButton.addEventListener('click', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = canvas.toDataURL('image/png');

    // 얼굴 임베딩 요청
    window.electronAPI.sendEmbeddingRequest(imageData);
  });

  console.log('onEmbeddingResult 메서드 호출 준비 완료');

  window.electronAPI.onEmbeddingResult(async (faceEmbedding) => {
    console.log('임베딩 결과:', faceEmbedding);

    // 로컬 스토리지에서 임시 저장된 데이터 복호화
    const encryptedEmail = localStorage.getItem('tempEmail');
    const encryptedPassword = localStorage.getItem('tempPassword');

    const email = await window.cryptoAPI.decryptData(encryptedEmail);
    const password = await window.cryptoAPI.decryptData(encryptedPassword);

    if (email && password) {
      try {
        // Firebase Authentication에 사용자 생성
        await window.electronAPI.sendSignUpRequest({ email, password });

        // Firestore에 얼굴 임베딩 저장
        await window.electronAPI.saveUserEmbedding({
          email: email,
          faceEmbedding: faceEmbedding,
        });

        console.log('회원가입 완료 및 얼굴 임베딩 저장');

        // **회원가입 성공 시 임시 데이터 삭제**
        localStorage.removeItem('tempEmail');
        localStorage.removeItem('tempPassword');
        console.log('임시 데이터 삭제 완료');

        // 메인 페이지로 이동
        window.location.href = 'index.html';
      } catch (error) {
        console.error("회원가입 또는 임베딩 저장 실패:", error);
      }
    } else {
      console.error('임시 저장된 이메일 또는 비밀번호가 없습니다.');
    }
  });
});



