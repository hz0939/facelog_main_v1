// renderer-mainpage.js

window.onload = async () => {
  const dataDisplay = document.getElementById('data-display');
  const logOutButton = document.getElementById('logOutButton');
  const addButton = document.getElementById('addButton');
  const logo = document.getElementById('logo');
  const deleteAccountButton = document.getElementById('deleteAccountButton');

  const userEmail = localStorage.getItem('userEmail');
  console.log("로그인된 사용자 이메일:", userEmail);

  // 로그아웃 버튼 클릭 시
  if (logOutButton) {
    logOutButton.addEventListener('click', () => {
      window.electronAPI.logOut();
      localStorage.removeItem('userEmail');
      window.electronAPI.navigateToIndex();
    });
  }

  // 사이트 추가 버튼 클릭 시
  if (addButton) {
    addButton.addEventListener('click', () => {
      console.log("사이트 추가 페이지로 이동");
      window.location.href = 'writepage.html'; // 동일 창에서 이동
    });
  } else {
    console.error("addButton 요소를 찾을 수 없습니다.");
  }

  // Firestore에서 사용자 사이트 정보 불러오기
  const sites = await window.electronAPI.getUserSites(userEmail);
  if (sites.length > 0) {
    dataDisplay.innerHTML = sites.map(site => {
      const fullTitle = site.title || 'Untitled';
      const maxLength = 7; // 제목 길이 제한
      const shortTitle = fullTitle.length > maxLength ? `${fullTitle.slice(0, maxLength)}...` : fullTitle;
  
      console.log("원본 제목:", fullTitle, " | 잘린 제목:", shortTitle);
  
      return `
        <div class="site-entry">
          <button class="site-icon" data-url="${site.url}" data-id="${site.id}" data-password="${site.password}" data-doc-id="${site.id}">
            <img class="site-icon-img" src="${site.icon || 'default-icon.png'}" alt="${fullTitle} icon">
            <p class="site-title">${shortTitle}</p>
          </button>
          <button class="more-options">...</button>
          <div class="context-menu">
            <button class="edit-button">바로가기 수정</button>
            <button class="delete-button">삭제</button>
          </div> 
        </div>
      `;
    }).join('');

    // 각 사이트 아이콘 클릭 시 URL 이동 및 자동 로그인
    document.querySelectorAll('.site-icon').forEach(icon => {
      icon.addEventListener('click', async () => {
        const encodedUrl = icon.getAttribute('data-url');
        const url = decodeURIComponent(encodedUrl); // URL 디코딩
        const id = icon.getAttribute('data-id');
        const password = icon.getAttribute('data-password');

        console.log("이동할 URL:", url);
        console.log("자동 로그인 정보 - ID:", id, "Password:", password);

        try {
          console.log("자동 로그인 시작");
          window.electronAPI.send('disable-observer');
          await window.electronAPI.autoLogin(url, id, password);
          window.electronAPI.send('enable-observer');
        } catch (error) {
          console.error("자동 로그인 중 오류 발생:", error);
        }
      });
    });
  } else {
    dataDisplay.innerHTML = "<p>등록된 사이트 정보가 없습니다.</p>";
  }

  // more-options 버튼 클릭 시 context-menu 표시
  document.querySelectorAll('.more-options').forEach(button => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const siteEntry = button.closest('.site-entry');
      const contextMenu = siteEntry.querySelector('.context-menu');
      contextMenu.style.display = 'block';

      // 다른 곳 클릭 시 메뉴 닫기
      document.addEventListener('click', (e) => {
        if (!contextMenu.contains(e.target)) {
          contextMenu.style.display = 'none';
        }
      }, { once: true });
    });
  });

  // 삭제 버튼 클릭 시 Firestore에서 데이터 삭제
  document.querySelectorAll('.delete-button').forEach(button => {
    button.addEventListener('click', async (event) => {
      event.stopPropagation();
      const siteEntry = button.closest('.site-entry');
      const siteUrl = siteEntry.querySelector('.site-icon').getAttribute('data-url');

      // URL을 한 번만 인코딩하여 Firestore의 문서 ID 형식과 일치시킴
      const docId = encodeURIComponent(siteUrl);
      console.log("Firestore에서 삭제 요청할 한 번 인코딩된 문서 ID:", docId);

      if (!docId) {
        alert("삭제할 문서 ID가 없습니다.");
        return;
      }

      try {
        await window.electronAPI.deleteSiteData(userEmail, docId);
        alert('사이트 정보가 Firestore에서 삭제되었습니다.');
        location.reload(); // 삭제 후 페이지 새로고침
      } catch (error) {
        console.error('Firestore에서 사이트 데이터 삭제 실패:', error);
        alert('사이트 삭제에 실패했습니다.');
      }
    });
  });

  // 로고 클릭 시 메인 페이지로 이동
  if (logo) {
    logo.addEventListener('click', async () => {
      const user = await window.electronAPI.getAuthUser();
      if (user) {
        window.location.href = 'mainpage.html';
      } else {
        window.electronAPI.navigateToIndex();
      }
    });
  }

  // 회원 탈퇴 버튼 클릭 시
  if (deleteAccountButton) {
    deleteAccountButton.addEventListener('click', () => {
      window.electronAPI.navigateToDeleteAuth();
    });
  }

  // URL 입력 및 사이트 이동 버튼 클릭 시
  document.getElementById('go-button').addEventListener('click', () => {
    const urlInput = document.getElementById('url-input').value.trim();
    const url = urlInput.startsWith('http') ? urlInput : `https://${urlInput}`;
    if (url) {
      console.log("URL 입력:", url);
      window.electronAPI.openUrlInNewWindow(url);
    } else {
      console.error("URL 입력 값이 비어 있습니다.");
    }
  });
};

// 'refresh-main-page' 이벤트 수신 시 Firestore에서 최신 사이트 정보 불러오기
window.electronAPI.on('refresh-main-page-to-renderer', async () => {
  console.log("메인 페이지에서 'refresh-main-page-to-renderer' 이벤트 수신됨, Firestore에서 최신 데이터 불러오기");
  const userEmail = localStorage.getItem('userEmail');
  if (userEmail) {
    await loadUserSites(userEmail);
  }
});

