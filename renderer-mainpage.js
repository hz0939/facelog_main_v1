window.onload = async () => {
  const dataDisplay = document.getElementById('data-display');
  const logOutButton = document.getElementById('logOutButton');
  const addButton = document.getElementById('addButton');
  const logo = document.getElementById('logo');

  const userEmail = localStorage.getItem('userEmail');
  console.log("로그인된 사용자 이메일:", userEmail);

  await new Promise(resolve => setTimeout(resolve, 1000)); // 지연 시간 추가

  if (logOutButton) {
    logOutButton.addEventListener('click', () => {
      window.electronAPI.logOut();
      localStorage.removeItem('userEmail');  // 로그아웃 시 이메일 제거
      window.electronAPI.navigateToIndex();
    });
  }

    // Add New Site 버튼 클릭 시 writepage.html로 이동
    if (addButton) {
      addButton.addEventListener('click', () => {
        console.log("Navigating to write page"); // 디버깅용 로그
        window.electronAPI.navigateToWritePage(); // 페이지 이동 호출
      });
    } else {
      console.error("addButton 요소를 찾을 수 없습니다.");
    }

    const sites = await window.electronAPI.getUserSites(userEmail);
    if (sites.length > 0) {
      dataDisplay.innerHTML = sites.map(site => `
        <div class="site-entry">
          <button class="site-icon" data-url="${site.url}" data-id="${site.id}" data-password="${site.password}">
            <img src="icon.png" alt="${site.name} icon" width="50" height="50">
            <p>${site.name}</p>
          </button>
        </div>
      `).join('');
  
      // 각 사이트 버튼에 자동 로그인 이벤트 추가
      const siteIcons = document.querySelectorAll('.site-icon');
      siteIcons.forEach(icon => {
        icon.addEventListener('click', () => {
          const url = icon.getAttribute('data-url');
          const id = icon.getAttribute('data-id');
          const password = icon.getAttribute('data-password');
  
          // 자동 로그인 요청
          window.electronAPI.autoLogin(url, id, password);
        });
      });
    } else {
      dataDisplay.innerHTML = "<p>등록된 사이트 정보가 없습니다.</p>";
    }
  
    if (logo) {
      logo.addEventListener('click', async () => {
        const user = await window.electronAPI.getAuthUser();
        if (user) {
          if (window.location.pathname !== '/mainpage.html') {
            window.location.href = 'mainpage.html';
          } else {
            window.location.reload();
          }
        } else {
          window.electronAPI.navigateToIndex();
        }
      });
    }

    // 회원 탈퇴
    const deleteAccountButton = document.getElementById('deleteAccountButton');

    if (deleteAccountButton) {
      deleteAccountButton.addEventListener('click', () => {
        // 탈퇴 전 얼굴 인증 페이지로 이동
        window.electronAPI.navigateToDeleteAuth();
      });
    }
  };

// URL 입력 및 사이트 이동
document.getElementById('go-button').addEventListener('click', () => {
  const urlInput = document.getElementById('url-input').value.trim();
  const url = urlInput.startsWith('http') ? urlInput : `https://${urlInput}`;
  
  if (url) {
    console.log("열려는 URL:", url); // 디버깅용 로그
    window.electronAPI.openUrlInNewWindow(url);
  } else {
    console.error("URL이 비어 있습니다.");
  }
});