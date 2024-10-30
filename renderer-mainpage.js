window.onload = () => {
  const logOutButton = document.getElementById('logOutButton');
  const logo = document.getElementById('logo');

  if (logOutButton) {
    logOutButton.addEventListener('click', () => {
      localStorage.removeItem('loggedInUser');
      window.electronAPI.navigateToIndex();
    });
  }

  if (logo) {
    logo.addEventListener('click', () => {
      window.electronAPI.navigateToIndex();
    });
  }
};

window.onload = () => {
  const logOutButton = document.getElementById('logOutButton');
  const logo = document.getElementById('logo');

  if (logOutButton) {
    logOutButton.addEventListener('click', () => {
      localStorage.removeItem('loggedInUser');
      window.electronAPI.navigateToIndex();
    });
  }

  if (logo) {
    logo.addEventListener('click', () => {
      window.electronAPI.getAuthUser().then(user => {
        if (user) {
          // 로그인된 상태에서 mainpage.html로 이동 또는 새로고침
          if (window.location.pathname !== '/mainpage.html') {
            window.location.href = 'mainpage.html';
          } else {
            window.location.reload();  // 이미 mainpage.html에 있으면 새로고침
          }
        } else {
          // 로그인되지 않은 경우 index.html로 이동
          window.electronAPI.navigateToIndex();
        }
      });
    });
  }
  
  const dataDisplay = document.getElementById('dataDisplay');

  window.electronAPI.getDataFromDB('sites').then((data) => {
    if (data && data.length > 0) {
      dataDisplay.innerHTML = data.map(site => `
        <div class="site-entry">
          <button class="site-icon" data-url="${site.url}" data-id="${site.id}" data-password="${site.password}">
            <img src="icon.png" alt="${site.name} icon" width="50" height="50">
            <p>${site.name}</p>
          </button>
        </div>
      `).join('');

      // 각 아이콘 클릭 시 자동 로그인 처리
      const siteIcons = document.querySelectorAll('.site-icon');
      siteIcons.forEach(icon => {
        icon.addEventListener('click', (event) => {
          const url = icon.getAttribute('data-url');
          const id = icon.getAttribute('data-id');
          const password = icon.getAttribute('data-password');

          // 자동 로그인 처리
          window.electronAPI.autoLogin(url, id, password);
        });
      });
    } else {
      dataDisplay.innerHTML = "<p>등록된 사이트 정보가 없습니다.</p>";
    }
  }).catch(error => {
    console.error('데이터 불러오기 중 오류 발생:', error);
    dataDisplay.innerHTML = "<p>데이터를 불러오는 중 오류가 발생했습니다.</p>";
  });

  logOutButton.addEventListener('click', () => {
    window.electronAPI.logOut();
    localStorage.removeItem('loggedInUser');
    window.electronAPI.navigateToIndex();
  });

  // 데이터 쓰기 페이지로 이동
  addButton.addEventListener('click', () => {
    window.electronAPI.navigateToWritePage();
  });
  
};
