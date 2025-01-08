document.addEventListener('DOMContentLoaded', () => {
  const video = document.getElementById('video');
  const captureButton = document.getElementById('captureButton');

  // 웹캠 스트림 시작
  navigator.mediaDevices.getUserMedia({ video: true })
    .then((stream) => {
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


  
  window.electronAPI.onEmbeddingResult(async (faceEmbedding) => {
    console.log('임베딩 결과:', faceEmbedding);

    // 현재 로그인된 사용자 정보 가져오기
    const user = await window.electronAPI.getAuthUser(); 

    if (user) {
      try {
        // Firestore에 사용자 임베딩 저장
        await window.electronAPI.saveUserEmbedding({
          email: user.email,
          faceEmbedding: faceEmbedding  // 필요한 형식으로 변환
        });
        console.log('얼굴 임베딩이 저장되었습니다.');
        window.location.href = 'index.html';  // 메인 페이지로 이동
      } catch (error) {
        console.error("임베딩 저장 실패:", error);
      }
    } else {
      console.error("로그인된 사용자가 없습니다.");
    }
  });
});


 