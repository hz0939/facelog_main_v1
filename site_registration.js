// site_registration.js
window.onload = async () => {
  const form = document.getElementById('site-form');
  const userEmail = localStorage.getItem('userEmail'); // 로그인한 사용자 이메일 가져오기

  // 사용자가 로그인하지 않은 경우
  if (!userEmail) {
    alert('로그인이 필요합니다.');
    window.location.href = 'login.html';
    return;
  }

    // 사이트 등록 시작 시 자동 감지 비활성화
  window.electronAPI.send('disable-observer');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    // 입력 필드에서 값 가져오기
    const siteName = document.getElementById('site-name').value;
    const siteURL = document.getElementById('site-url').value;
    const siteID = document.getElementById('site-id').value;
    const sitePassword = document.getElementById('site-password').value;

    // 암호화 처리
    const encryptedID = await window.cryptoAPI.encryptData(siteID);
    const encryptedPassword = await window.cryptoAPI.encryptData(sitePassword);

    // Firestore에 저장할 데이터 객체 생성
    const newSiteData = {
      name: siteName,
      url: siteURL,
      id: encryptedID,
      password: encryptedPassword,
    };

    console.log('Firestore에 저장할 데이터:', newSiteData);

    // Firestore에 데이터 저장
    window.electronAPI.writeDataToDB(`users/${userEmail}/sites`, newSiteData)
      .then(() => {
        alert('사이트가 성공적으로 등록되었습니다.');
        window.location.href = 'mainpage.html';
      })
      .catch((error) => {
        console.error('Firestore에 데이터 저장 중 오류 발생:', error);
        alert('사이트 등록 중 오류가 발생했습니다.');
      });
  });
};
