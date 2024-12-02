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

  // 임베딩 결과 수신
  window.electronAPI.removeAllListeners('face-embedding-result');
  window.electronAPI.onEmbeddingResult(async (newEmbedding) => {
    if (isFetchingUserDoc) {
      console.log('이미 사용자 데이터를 가져오는 중입니다.');
      return;
    }

    isFetchingUserDoc = true;

    try {
      const userData = await window.electronAPI.getUserDoc(userEmail);

      if (!userData || !userData.faceEmbedding) {
        console.error("사용자 데이터에 faceEmbedding이 없습니다.");
        return;
      }

      // Firestore에서 불러온 storedEmbedding
      const storedEmbedding = parseEmbeddingString(userData.faceEmbedding);

      // newEmbedding 데이터 처리
      const newEmbeddingArray = Array.isArray(newEmbedding)
        ? newEmbedding
        : formatEmbedding(newEmbedding);

      if (!newEmbeddingArray) {
        console.error("newEmbedding 데이터를 처리할 수 없습니다.");
        return;
      }

      console.log("newEmbedding 처리 후:", newEmbeddingArray);

      // lastEmbedding 가져오기
      const lastEmbedding = await window.electronAPI.getEmbedding();
      const lastEmbeddingArray = Array.isArray(lastEmbedding)
        ? [...lastEmbedding] // 배열일 경우 복사
        : parseEmbeddingString(lastEmbedding); // 문자열일 경우 변환

      // lastEmbedding 길이 맞춤: 필요하면 null 추가
      while (lastEmbeddingArray.length < newEmbeddingArray.length) {
        lastEmbeddingArray.unshift(null); // 앞에 null 추가
      }

      console.log("lastEmbedding 수정 후:", lastEmbeddingArray);

      // 길이 확인
      if (newEmbeddingArray.length !== lastEmbeddingArray.length) {
        console.error("newEmbedding과 lastEmbedding의 길이가 다릅니다.");
        console.log("newEmbedding 길이:", newEmbeddingArray.length);
        console.log("lastEmbedding 길이:", lastEmbeddingArray.length);
        return;
      }

      // 코사인 유사도 계산
      const similarityLast = calculateCosineSimilarity(newEmbeddingArray, lastEmbeddingArray);
      console.log("LastEmbedding과 NewEmbedding의 유사도:", similarityLast);

      // storedEmbedding과도 비교
      const similarityStored = calculateCosineSimilarity(newEmbeddingArray, storedEmbedding);
      console.log("StoredEmbedding과 NewEmbedding의 유사도:", similarityStored);

      // 결과 판별
      if (similarityLast > 0.7 && similarityStored > 0.7) {
        console.log('로그인 성공. 메인 페이지로 이동합니다.');
        window.location.href = 'mainpage.html';
      } else {
        alert('얼굴이 일치하지 않습니다.');
      }
    } catch (error) {
      console.error('사용자 데이터를 가져오는 중 오류:', error);
    } finally {
      isFetchingUserDoc = false;
    }
  });

  // Firestore에서 가져온 문자열을 배열로 변환하는 함수
  function parseEmbeddingString(embeddingString) {
    return embeddingString.split(',').map(Number); // 문자열을 숫자 배열로 변환
  }

  // 임베딩 데이터를 올바르게 변환하는 함수
  function formatEmbedding(embedding) {
    if (typeof embedding.flatten === 'function') {
      return tensorToArray(embedding);
    } else if (Array.isArray(embedding)) {
      return embedding;
    } else if (typeof embedding === 'string') {
      return parseEmbeddingString(embedding);
    } else {
      console.error("embedding 데이터 형식이 올바르지 않습니다.");
      return null;
    }
  }

  // 텐서 데이터를 1차원 배열로 변환하는 함수
  function tensorToArray(tensor) {
    return tensor.flatten().arraySync(); // 텐서를 1차원 배열로 변환
  }

  // 코사인 유사도 계산 함수
  function calculateCosineSimilarity(embedding1, embedding2) {
    const dotProduct = embedding1.reduce((sum, value, index) => sum + value * embedding2[index], 0);
    const magnitude1 = Math.sqrt(embedding1.reduce((sum, value) => sum + value * value, 0));
    const magnitude2 = Math.sqrt(embedding2.reduce((sum, value) => sum + value * value, 0));

    if (magnitude1 === 0 || magnitude2 === 0) {
      console.error('벡터의 크기가 0입니다.');
      return NaN;
    }

    return dotProduct / (magnitude1 * magnitude2);
  }
};
