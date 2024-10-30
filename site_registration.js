window.onload = () => {
    const form = document.getElementById('site-form');
  
    form.addEventListener('submit', (event) => {
      event.preventDefault();
  
      // 입력된 값 가져오기
      const siteName = document.getElementById('site-name').value;
      const siteURL = document.getElementById('site-url').value;
      const siteID = document.getElementById('site-id').value;
      const sitePassword = document.getElementById('site-password').value;
  
      // Firestore에 저장할 데이터 객체 생성
      const newSiteData = {
        name: siteName,
        url: siteURL,
        id: siteID,
        password: sitePassword
      };
  
      console.log('Saving site data to Firestore:', newSiteData);  // 로그로 값 확인
  
      // Firestore에 랜덤 ID로 데이터 저장 (docId는 자동으로 생성됨)
      window.electronAPI.writeDataToDB('sites', newSiteData).then(() => {
        alert('사이트가 성공적으로 등록되었습니다.');
        window.location.href = 'mainpage.html'; // 등록 후 메인 페이지로 이동
      }).catch((error) => {
        console.error('Firestore에 데이터 저장 중 오류 발생:', error);
        alert('사이트 등록 중 오류가 발생했습니다.');
      });
    });
  };
  