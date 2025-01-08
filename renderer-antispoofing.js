document.addEventListener('DOMContentLoaded', () => {
  const spoofResultElement = document.getElementById('spoof-result');
  const loadingAnimation = document.getElementById('loading-animation');

  const userEmail = localStorage.getItem('userEmail'); 
  let realCount = 0; 
  let fakeCount = 0; 
  let isFakeProcessing = false; 
  let cameraStream = null;

  if (!userEmail) {
      alert('이메일 정보가 없습니다. 로그인 페이지로 돌아갑니다.');
      window.location.href = 'login.html'; // 로그인 페이지로 이동
      return;
  }

  const initializePage = () => {
      realCount = 0; // Real 카운트 초기화
      fakeCount = 0; // Fake 카운트 초기화
      isFakeProcessing = false; // Fake 처리 중 상태 초기화

      spoofResultElement.textContent = '안티 스푸핑 탐지 중...'; // 초기 텍스트
      loadingAnimation.classList.add('spin'); // 로딩 애니메이션 활성화
      loadingAnimation.classList.remove('success'); // 체크 표시 제거
      loadingAnimation.classList.remove('fake'); // Fake 이미지 제거
  };

  // 초기화 실행
  initializePage();


  window.electronAPI.startAntispoofing();
  window.electronAPI.removeAllListeners('update-result');

  window.electronAPI.onUpdateResult((result) => {
      console.log('안티스푸핑 결과 수신:', result);

      if (!result || !result.label) {
          spoofResultElement.textContent = '결과 데이터를 가져올 수 없습니다.';
          return;
      }

      if (isFakeProcessing) {
          console.log('Fake 처리 중이므로 다른 결과 무시');
          return;
      }

      if (result.label === 'Real') {
          realCount += 1;
          fakeCount = 0;
          console.log(`Real 횟수: ${realCount}`);

          setTimeout(() => {
              if (!isFakeProcessing) { 
                  spoofResultElement.textContent = `REAL!`;
              }
          }, 1500);

          if (realCount >= 5) {
              console.log('Real 결과 5번 연속 감지, 패스 처리 시작');
              setTimeout(() => {
                  loadingAnimation.classList.remove('spin'); 
                  loadingAnimation.classList.add('success'); 
              }, 1000);
              window.electronAPI.stopAntispoofing();

              navigator.mediaDevices.getUserMedia({ video: true })
                  .then((stream) => {
                      const video = document.createElement('video');
                      video.srcObject = stream;
                      video.play();

                      video.addEventListener('loadeddata', async () => {
                          const canvas = document.createElement('canvas');
                          canvas.width = video.videoWidth;
                          canvas.height = video.videoHeight;
                          const context = canvas.getContext('2d');
                          context.drawImage(video, 0, 0, canvas.width, canvas.height);

                          const imageData = canvas.toDataURL('image/png');
                          video.pause();
                          stream.getTracks().forEach((track) => track.stop()); 

                          window.electronAPI.sendEmbeddingRequest(imageData);

                          window.electronAPI.onEmbeddingResult((embedding) => {
                              console.log('추가 캡처된 임베딩 저장:', embedding);
                              window.electronAPI.saveEmbedding(embedding); 
                              window.location.href = 'login_face.html'; 
                          });
                      });
                  })
                  .catch((error) => {
                      console.error('추가 프레임 캡처 실패:', error);
                  });
          }
      } else if (result.label === 'Fake') {
          fakeCount += 1;
          realCount = 0;
          console.log(`Fake 횟수: ${fakeCount}`);

          if (fakeCount >= 10) {
              console.log('Fake 결과 10번 연속 감지, 실패 처리 시작');
              isFakeProcessing = true; 
              setTimeout(() => {
                  spoofResultElement.textContent = 'FAKE!';
                  loadingAnimation.classList.remove('spin');
                  loadingAnimation.classList.add('fake'); 
              }, 2000);

              setTimeout(() => {
                  window.electronAPI.stopAntispoofing();
                  window.location.href = 'index.html'; // index.html로 이동
              }, 3000); // 3초 대기 후 index.html로 이동
          }
      } else {
          // 다른 결과 처리
          realCount = 0;
          fakeCount = 0;
          console.log('알 수 없는 결과 감지');
          spoofResultElement.textContent = '스푸핑 탐지 중...';
      }
  });
});
