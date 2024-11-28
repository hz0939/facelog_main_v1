window.onload = () => {
  const video = document.getElementById('video');
  const captureButton = document.getElementById('captureButton');
  
  const userEmail = localStorage.getItem('userEmail'); // localStorage에서 이메일 가져오기

  if (!userEmail) {
    alert('이메일 정보가 없습니다. 로그인 페이지로 돌아갑니다.');
    window.location.href = 'login.html'; // 로그인 페이지로 이동
    return;
  }

  console.log(`로그인 사용자 이메일: ${userEmail}`);
  // 이메일 값을 활용한 추가 처리
  
  // 웹캠 스트림 시작
  navigator.mediaDevices.getUserMedia({ video: true })
    .then((stream) => {
      video.srcObject = stream;
      video.style.transform = 'scaleX(-1)';  
    })
    .catch((error) => {
      console.error('웹캠 실행 오류:', error);
    });

  captureButton.addEventListener('click', () => {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = canvas.toDataURL('image/png');

    // 얼굴 임베딩 요청
    window.electronAPI.sendEmbeddingRequest(imageData);
  });

  let isFetchingUserDoc = false;
  window.electronAPI.removeAllListeners('face-embedding-result');
  window.electronAPI.onEmbeddingResult(async (newEmbedding) => {

    if (isFetchingUserDoc) {
      console.log('이미 사용자 데이터를 가져오는 중입니다.');
      return;
    }
  
    isFetchingUserDoc = true; // 플래그 설정
  



    try {
      const userData = await window.electronAPI.getUserDoc(userEmail);
  
      if (!userData || !userData.faceEmbedding) {
        console.error("사용자 데이터에 faceEmbedding이 없습니다.");
        return;
      }
  
      // Firestore에서 불러온 임베딩 데이터를 문자열에서 배열로 변환
      const storedEmbedding = parseEmbeddingString(userData.faceEmbedding);
  
      // newEmbedding의 데이터 형태 확인
      console.log("newEmbedding의 타입:", typeof newEmbedding);
      console.log("newEmbedding의 값:", newEmbedding);
  
      let newEmbeddingArray;
      if (typeof newEmbedding.flatten === 'function') {
        // 텐서일 경우 배열로 변환
        newEmbeddingArray = tensorToArray(newEmbedding);
      } else if (Array.isArray(newEmbedding)) {
        // 이미 배열일 경우 그대로 사용
        newEmbeddingArray = newEmbedding;
      } else if (typeof newEmbedding === 'string') {
        // newEmbedding이 문자열로 반환된 경우 처리
        newEmbeddingArray = parseEmbeddingString(newEmbedding);
      } else {
        console.error("newEmbedding은 텐서도 배열도 아닙니다.");
        return;
      }
  
      // 벡터 길이 확인
      if (storedEmbedding.length !== newEmbeddingArray.length) {
        console.error("임베딩 벡터의 길이가 다릅니다.");
        console.log("storedEmbedding 길이:", storedEmbedding.length);
        console.log("newEmbedding 길이:", newEmbeddingArray.length);
        return;
      }
  
      // 코사인 유사도 계산
      const similarity = calculateCosineSimilarity(newEmbeddingArray, storedEmbedding);
  
      if (similarity > 0.75) {
        console.log('로그인 성공. 메인 페이지로 이동합니다.');
        window.location.href = 'mainpage.html';
      } else {
        alert('not matching face');
      }
    } catch (error) {
      console.error('사용자 데이터를 가져오는 중 오류:', error);
    }
  });
  
  // Firestore에서 가져온 문자열을 배열로 변환하는 함수
  function parseEmbeddingString(embeddingString) {
    return embeddingString.split(',').map(Number); // 문자열을 숫자 배열로 변환
  }
  
  // 텐서 데이터를 1차원 배열로 변환하는 함수
  function tensorToArray(tensor) {
    return tensor.flatten().arraySync(); // 텐서를 1차원 배열로 변환
  }
  
  // NaN 값을 제거하는 함수
  function removeNaNValues(arr) {
    return arr.map(value => isNaN(value) ? 0 : value); // NaN 값을 0으로 대체
  }
  
  // 코사인 유사도 계산 함수
  function calculateCosineSimilarity(embedding1, embedding2) {
    // embedding1, embedding2가 배열이 아니면 배열로 변환
    embedding1 = removeNaNValues(Array.isArray(embedding1) ? embedding1 : Array.from(embedding1));
    embedding2 = removeNaNValues(Array.isArray(embedding2) ? embedding2 : Array.from(embedding2));
  
    // 코사인 유사도 계산
    const dotProduct = embedding1.reduce((sum, value, index) => sum + value * embedding2[index], 0);
    const magnitude1 = Math.sqrt(embedding1.reduce((sum, value) => sum + value * value, 0));
    const magnitude2 = Math.sqrt(embedding2.reduce((sum, value) => sum + value * value, 0));
  
    if (magnitude1 === 0 || magnitude2 === 0) {
      console.error('벡터의 크기가 0입니다.');
      return NaN;
    }
  
    const cosineSimilarity = dotProduct / (magnitude1 * magnitude2);
    console.log('Cosine Similarity:', cosineSimilarity);
    return cosineSimilarity;
  }
  
  
};  