window.onload = () => {
  const video = document.getElementById('video');
  const captureButton = document.getElementById('captureButton');

  // 웹캠 시작
  navigator.mediaDevices.getUserMedia({ video: true })
    .then((stream) => {
      video.srcObject = stream;
      video.style.transform = 'scaleX(-1)';  
    })
    .catch((error) => {
      console.error('웹캠 실행 오류:', error);
      alert('웹캠에 접근할 수 없습니다. 권한을 확인하세요.');
    });

  // 캡처 버튼 클릭 이벤트
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

  // 임베딩 결과 처리
  window.electronAPI.onEmbeddingResult(async (newEmbedding) => {
    if (!newEmbedding) return;

    // 로컬 스토리지에서 사용자 이메일 가져오기
    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) {
      console.error("이메일 정보가 없습니다.");
      alert("이메일 정보가 없습니다. 다시 로그인해주세요.");
      return;
    }

    try {
      const userData = await window.electronAPI.getUserDoc(userEmail);

      // Firestore에서 불러온 임베딩 데이터를 문자열에서 배열로 변환
      const storedEmbedding = parseEmbeddingString(userData.faceEmbedding);

      // newEmbedding을 배열로 변환
      const newEmbeddingArray = convertEmbeddingToArray(newEmbedding);

      // 벡터 길이 확인
      if (storedEmbedding.length !== newEmbeddingArray.length) {
        console.error("임베딩 벡터의 길이가 다릅니다.");
        return;
      }

      // 코사인 유사도 계산
      const similarity = calculateCosineSimilarity(newEmbeddingArray, storedEmbedding);
      console.log("계산된 유사도:", similarity);

      if (!isNaN(similarity) && similarity > 0.75) {
        await window.electronAPI.deleteUserDoc(userEmail);
        await window.electronAPI.deleteAuthUser();
        alert('계정이 삭제되었습니다.');
        window.electronAPI.navigateToIndex();
      } else {
        alert('얼굴이 일치하지 않습니다.');
      }
    } catch (error) {
      console.error("오류 발생:", error);
    }
  });
};

// Firestore에서 가져온 문자열을 배열로 변환하는 함수
function parseEmbeddingString(embeddingString) {
  return embeddingString.split(',').map(Number);
}

// 임베딩을 배열로 변환하는 함수
function convertEmbeddingToArray(embedding) {
  if (typeof embedding.flatten === 'function') {
    return tensorToArray(embedding);
  } else if (Array.isArray(embedding)) {
    return embedding;
  } else if (typeof embedding === 'string') {
    return parseEmbeddingString(embedding);
  } else {
    console.error("임베딩이 유효한 형식이 아닙니다.");
    return [];
  }
}

// 텐서 데이터를 1차원 배열로 변환하는 함수
function tensorToArray(tensor) {
  return tensor.flatten().arraySync();
}

// NaN 값을 0으로 대체하여 제거하는 함수
function removeNaNValues(arr) {
  return arr.map(value => isNaN(value) ? 0 : value);
}

// 코사인 유사도 계산 함수
function calculateCosineSimilarity(embedding1, embedding2) {
  embedding1 = removeNaNValues(embedding1);
  embedding2 = removeNaNValues(embedding2);

  const dotProduct = embedding1.reduce((sum, value, index) => sum + value * embedding2[index], 0);
  const magnitude1 = Math.sqrt(embedding1.reduce((sum, value) => sum + value * value, 0));
  const magnitude2 = Math.sqrt(embedding2.reduce((sum, value) => sum + value * value, 0));

  if (magnitude1 === 0 || magnitude2 === 0) {
    console.error('벡터의 크기가 0입니다.');
    return NaN;
  }

  return dotProduct / (magnitude1 * magnitude2);
}