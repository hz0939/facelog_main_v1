// renderer-signup.js
window.onload = () => {
  const signUpButton = document.getElementById('submitSignUp');

  if (signUpButton) {  
    signUpButton.addEventListener('click', async () => {
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
    
      // 이메일과 비밀번호를 암호화하여 로컬 저장
      const encryptedEmail = await window.cryptoAPI.encryptData(email);
      const encryptedPassword = await window.cryptoAPI.encryptData(password);
    
      localStorage.setItem('tempEmail', encryptedEmail);
      localStorage.setItem('tempPassword', encryptedPassword);
    
      // 얼굴 등록 페이지로 이동
      window.electronAPI.send('navigate-to-signup-face');
    });
  } 
}; 


