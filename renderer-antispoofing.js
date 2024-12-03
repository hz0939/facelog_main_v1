document.addEventListener('DOMContentLoaded', () => {
  const spoofResultElement = document.getElementById('spoof-result');
  const loadingAnimation = document.getElementById('loading-animation');
  const nextButton = document.getElementById('nextButton');
  const userEmail = localStorage.getItem('userEmail'); // localStorage에서 이메일 가져오기
  let realCount = 0; // Real 카운트 변수
  let lastEmbedding = null; // 마지막 임베딩 값을 저장할 변수

  // 이메일 확인
  if (!userEmail) {
    alert('이메일 정보가 없습니다. 로그인 페이지로 돌아갑니다.');
    window.location.href = 'login.html'; // 로그인 페이지로 이동
    return;
  }

  console.log(`현재 사용자 이메일: ${userEmail}`);

  // 초기화 함수
  const initializePage = () => {
    console.log('페이지 초기화 중...');
    realCount = 0; // 카운트 초기화
    nextButton.disabled = true; // 버튼 비활성화
    spoofResultElement.textContent = '로딩 중...'; // 초기 텍스트
    loadingAnimation.classList.add('spin'); // 로딩 애니메이션 활성화
    loadingAnimation.classList.remove('success'); // 체크 표시 제거
  };

  // 초기화 실행
  initializePage();

  // Python 프로세스 시작
  window.electronAPI.startAntispoofing();

  // 기존 리스너 제거 후 새 리스너 등록
  window.electronAPI.removeAllListeners('update-result');

  // 안티스푸핑 결과 수신
  window.electronAPI.onUpdateResult((result) => {
    console.log('안티스푸핑 결과 수신:', result);

    // 결과가 없거나 부적절한 경우 처리
    if (!result || !result.label) {
      spoofResultElement.textContent = '결과 데이터를 가져올 수 없습니다.';
      nextButton.disabled = true; // 버튼 비활성화
      return;
    }

    // 결과 표시
    if (result.label === 'Real') {
      realCount += 1;
      console.log(`Real 횟수: ${realCount}`);
      spoofResultElement.textContent = `실제 얼굴 확인됨! (${realCount}/5)`;

    // 전체 임베딩 데이터 저장
    if (result.embedding) {
      lastEmbedding = result.embedding; // 전체 임베딩 저장
      window.electronAPI.saveEmbedding(lastEmbedding); // Electron 메인 프로세스에 저장
      console.log('임베딩 값이 성공적으로 저장되었습니다.');
    } else {
      console.error('임베딩 값이 없습니다. 저장하지 못했습니다.');
    }
    
// Real이 5번 이상 감지되면
if (realCount >= 5) {
  console.log('Real 결과 5번 도달, 추가 프레임 캡처 시작');
  loadingAnimation.classList.remove('spin'); // 로딩 애니메이션 제거
  loadingAnimation.classList.add('success'); // 체크 표시 추가

  // Python 프로세스 종료 요청
  window.electronAPI.stopAntispoofing();

  // 추가 프레임 캡처 및 순수 임베딩 생성 요청
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
        stream.getTracks().forEach(track => track.stop()); // 스트림 종료

        // Python 스크립트로 임베딩 요청
        window.electronAPI.sendEmbeddingRequest(imageData);

        window.electronAPI.onEmbeddingResult((embedding) => {
          console.log('추가 캡처된 임베딩 저장:', embedding);
          window.electronAPI.saveEmbedding(embedding); // 전역 변수에 저장
          nextButton.disabled = false; // 버튼 활성화
        });
      });
    })
    .catch((error) => {
      console.error('추가 프레임 캡처 실패:', error);
    });

      }
    } else {
      realCount = 0; // Real이 아닌 경우 카운트 초기화
      spoofResultElement.textContent = '스푸핑 탐지됨!';
      nextButton.disabled = true; // 버튼 비활성화
    }
  });

  // 버튼 클릭 시 login_face.html로 이동
  nextButton.addEventListener('click', () => {
    console.log('다음 페이지로 이동 요청');
    window.electronAPI.navigateToLoginFace(); // login_face.html로 이동 요청
  });
});
