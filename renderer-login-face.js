window.onload = () => {
  const video = document.getElementById('video');
  const captureButton = document.getElementById('captureButton');

  const userEmail = localStorage.getItem('userEmail'); // localStorage에서 이메일 가져오기

  if (!userEmail) {
    alert('이메일 정보가 없습니다. 로그인 페이지로 돌아갑니다.');
    window.location.href = 'login.html'; // 로그인 페이지로 이동
    return;
  }


  navigator.mediaDevices.getUserMedia({ video: true })
    .then((stream) => {
      video.srcObject = stream;
      video.style.transform = 'scaleX(-1)';
    })
    .catch((error) => {
      console.error('웹캠 실행 오류:', error);
    });

  captureButton.addEventListener('click', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = canvas.toDataURL('image/png');

    try {
      window.electronAPI.sendEmbeddingRequest(imageData);
      window.electronAPI.removeAllListeners('face-embedding-result');
      window.electronAPI.onEmbeddingResult(async (newEmbedding) => {

        const newEmbeddingArray = convertToArray(newEmbedding, 'newEmbedding');
        if (!newEmbeddingArray) return;
    
        const userData = await window.electronAPI.getUserDoc(userEmail);
        if (!userData || !userData.faceEmbedding) {
          console.error('사용자 데이터에 faceEmbedding이 없습니다.');
          alert('사용자 데이터를 가져오는 데 실패했습니다.');
          return;
        }
    
        const storedEmbedding = parseEmbeddingString(userData.faceEmbedding);
        if (!Array.isArray(storedEmbedding)) {
          console.error('storedEmbedding이 배열이 아닙니다:', storedEmbedding);
          return;
        }
    
        const similarityToStored = calculateCosineSimilarity(newEmbeddingArray, storedEmbedding);
        console.log('storedEmbedding과 유사도:', similarityToStored);
    
        if (similarityToStored > 0.6) {
          showToast('1단계 인증 성공: 등록된 사용자 정보와 일치합니다', 'middle'); 

          const lastEmbedding = await window.electronAPI.getEmbedding();

          const lastEmbeddingArray = convertToArray(lastEmbedding, 'lastEmbedding');
          if (!lastEmbeddingArray) return;
    
          const similarityToLast = calculateCosineSimilarity(newEmbeddingArray, lastEmbeddingArray);
          console.log('lastEmbedding과 유사도:', similarityToLast);
    
          if (similarityToLast > 0.65) {
            showToast('2단계 스푸핑 방어 검증 성공: 동일한 실사용자입니다.', 'bottom'); 
             
            setTimeout(() => {
            window.location.href = 'mainpage.html';
            }, 2000);
           
          } else {
            alert('antispofing과 사용자가 일치하지 않습니다.');
          }
        } else {
          alert('저장된 사용자와 일치하지 않습니다.');
        }
      });
    } catch (error) {
      console.error('오류 발생:', error);
    }
    
});

  // 배열 변환 함수
  function convertToArray(data, name) {
    let array = null;
    if (typeof data === 'string') {
      try {
        array = JSON.parse(data);
      } catch (error) {
        console.error(`${name}을 JSON으로 파싱할 수 없습니다:`, error);
      }
    } else if (Array.isArray(data)) {
      array = data;
    } else {
      console.error(`${name}을 배열로 변환할 수 없습니다:`, data);
    }
    if (!Array.isArray(array)) {
      console.error(`${name}은 배열로 변환되지 않았습니다.`);
    }
    return array;
  }

  // Firestore에서 가져온 문자열을 배열로 변환하는 함수
  function parseEmbeddingString(embeddingString) {
    try {
      return embeddingString.split(',').map(Number); // 문자열을 숫자 배열로 변환
    } catch (error) {
      console.error('Embedding 파싱 오류:', error);
      return [];
    }
  }

  // NaN 값을 제거하는 함수
  function removeNaNValues(arr) {
    if (!Array.isArray(arr)) {
      console.error('removeNaNValues 호출 시 배열이 아닙니다:', arr);
      return [];
    }
    return arr.map(value => isNaN(value) ? 0 : value); // NaN 값을 0으로 대체
  }

  // 코사인 유사도 계산 함수
  function calculateCosineSimilarity(embedding1, embedding2) {
    if (!Array.isArray(embedding1) || !Array.isArray(embedding2)) {
      console.error('Cosine 유사도 계산 오류: 입력값이 배열이 아닙니다.', { embedding1, embedding2 });
      return NaN;
    }

    const removeNaNValues = (arr) => arr.map((value) => (isNaN(value) ? 0 : value));

    embedding1 = removeNaNValues(embedding1);
    embedding2 = removeNaNValues(embedding2);

    if (embedding1.length !== embedding2.length) {
      console.error('임베딩 길이가 일치하지 않습니다:', embedding1.length, embedding2.length);
      return NaN;
    }

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
  toast.style.transition = 'opacity 0.1s ease'; // 나타나는 속도를 더 빠르게 설정
  toast.style.opacity = '1';

  // 위치에 따른 설정
  if (position === 'bottom') {
    toast.style.bottom = '20px';
  } else if (position === 'middle') {
    toast.style.bottom = '100px'; // bottom 위치보다 위로 설정
  } else if (position === 'top') {
    toast.style.top = '20px';
  }

  document.body.appendChild(toast);

  // 2초 후 자동으로 사라짐
  setTimeout(() => {
    toast.style.opacity = '0'; // 사라지는 효과 적용
    setTimeout(() => {
      toast.remove();
    }, 100); // 사라지는 시간도 빠르게 조정
  }, 1500);
}
