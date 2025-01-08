from flask import Flask, render_template, Response
import cv2
import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision.transforms import transforms
from PIL import Image
from facenet_pytorch import MTCNN

# Flask 애플리케이션 초기화
app = Flask(__name__)

# 모델 정의: CDCN_Spatial_Frequency
class CDCN_Spatial_Frequency(nn.Module):
    def __init__(self):
        super(CDCN_Spatial_Frequency, self).__init__()

        # 공간적 정보 처리 네트워크 (RGB 이미지)
        self.conv1_rgb = nn.Conv2d(3, 32, kernel_size=3, padding=1)
        self.conv2_rgb = nn.Conv2d(32, 64, kernel_size=3, padding=1)
        self.conv3_rgb = nn.Conv2d(64, 128, kernel_size=3, padding=1)

        # 주파수 정보 처리 네트워크 (주파수 영역)
        self.conv1_fft = nn.Conv2d(3, 32, kernel_size=3, padding=1)
        self.conv2_fft = nn.Conv2d(32, 64, kernel_size=3, padding=1)
        self.conv3_fft = nn.Conv2d(64, 128, kernel_size=3, padding=1)

        # 결합 후 fully connected
        self.fc1 = nn.Linear(128 * 32 * 32 * 2, 512)  # 두 네트워크에서 나온 특징을 결합
        self.fc2 = nn.Linear(512, 2)  # 2 클래스 (REAL or FAKE)

    def forward(self, x_rgb, x_fft):
        # RGB 이미지 처리
        x_rgb = F.relu(self.conv1_rgb(x_rgb))
        x_rgb = F.max_pool2d(F.relu(self.conv2_rgb(x_rgb)), 2)
        x_rgb = F.max_pool2d(F.relu(self.conv3_rgb(x_rgb)), 2)

        # 주파수 정보 처리
        x_fft = F.relu(self.conv1_fft(x_fft))
        x_fft = F.max_pool2d(F.relu(self.conv2_fft(x_fft)), 2)
        x_fft = F.max_pool2d(F.relu(self.conv3_fft(x_fft)), 2)

        # 두 네트워크에서 나온 특성 결합
        x = torch.cat((x_rgb.view(x_rgb.size(0), -1), x_fft.view(x_fft.size(0), -1)), dim=1)
        x = F.relu(self.fc1(x))
        x = self.fc2(x)
        return x

# 모델 초기화 및 가중치 로드
device = 'cuda' if torch.cuda.is_available() else 'cpu'
model = CDCN_Spatial_Frequency().to(device)
model.load_state_dict(torch.load('./models/fft_v4.pth', map_location=device))
model.eval()

# MTCNN 초기화
mtcnn = MTCNN(keep_all=True, device=device)

# 이미지 전처리 함수
transform = transforms.Compose([
    transforms.Resize((128, 128)),
    transforms.ToTensor()
])

def fft_transform(image):
    gray = image.mean(dim=1, keepdim=True)  # RGB -> Grayscale
    f = torch.fft.fft2(gray)  # 푸리에 변환
    fshift = torch.fft.fftshift(f)
    magnitude_spectrum = torch.abs(fshift)
    return magnitude_spectrum.repeat(1, 3, 1, 1)

# 웹캠 프레임 생성
camera = cv2.VideoCapture(0)

def generate_frames():
    while True:
        success, frame = camera.read()
        if not success:
            break
        else:
            # BGR -> RGB 변환
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # MTCNN으로 얼굴 탐지
            boxes, _ = mtcnn.detect(rgb_frame)

            if boxes is not None:
                for box in boxes:
                    x1, y1, x2, y2 = map(int, box)
                    x1, y1, x2, y2 = max(0, x1), max(0, y1), min(frame.shape[1], x2), min(frame.shape[0], y2)
                    
                    # 얼굴 영역 잘라내기
                    face = rgb_frame[y1:y2, x1:x2]
                    
                    if face.size > 0:  # 얼굴 영역이 있는 경우
                        face_pil = Image.fromarray(face)
                        face_tensor = transform(face_pil).unsqueeze(0).to(device)
                        freq_tensor = fft_transform(face_tensor)

                        # 모델 예측
                        with torch.no_grad():
                            output = model(face_tensor, freq_tensor)
                            probability = torch.softmax(output, 1)
                            real_prob = probability[0, 0]
                            fake_prob = probability[0, 1]

                            # 비율 기반 예측
                            if real_prob >= 7 * fake_prob:  # 실시간 판단 기준 설정
                                label = "Real"
                            else:
                                label = "Fake"

                        # 결과 표시
                        color = (0, 255, 0) if label == "Real" else (0, 0, 255)
                        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                        cv2.putText(frame, label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, color, 2)

            # OpenCV 이미지를 바이트 형식으로 변환
            _, buffer = cv2.imencode('.jpg', frame)
            frame = buffer.tobytes()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

@app.route('/')
def index():
    return render_template('index.html')  # HTML 파일 렌더링

@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

if __name__ == '__main__':
    app.run(debug=True)
