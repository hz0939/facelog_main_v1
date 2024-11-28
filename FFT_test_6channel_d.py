from flask import Flask, Response
import sys
import torch
import torch.nn as nn
import torch.nn.functional as F
import cv2
from mtcnn import MTCNN
from torchvision import transforms
from PIL import Image
import os
import io
import base64
import numpy as np
import json

# oneDNN 최적화를 비활성화
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'
import tensorflow as tf

# 모델 정의
class CDCN_Spatial_Frequency(nn.Module):
    def __init__(self):
        super(CDCN_Spatial_Frequency, self).__init__()
        # RGB 이미지 처리 (공간적 정보)
        self.conv1_rgb = nn.Conv2d(3, 32, kernel_size=3, padding=1)  # 3채널 (RGB)
        self.conv2_rgb = nn.Conv2d(32, 64, kernel_size=3, padding=1)
        self.conv3_rgb = nn.Conv2d(64, 128, kernel_size=3, padding=1)

        # 주파수 정보 처리 (FFT) -> 1채널 -> 3채널로 수정
        self.conv1_fft = nn.Conv2d(3, 32, kernel_size=3, padding=1)  # 3채널 (주파수 정보)
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
# Flask 서버 초기화
app = Flask(__name__)

# 모델 로드
model_path = 'FFT_V4.pth'
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = CDCN_Spatial_Frequency().to(device)

# 가중치 로드
try:
    model.load_state_dict(torch.load(model_path, map_location=device))  # map_location을 사용하여 CPU로 로드
    print("모델 가중치가 성공적으로 로드되었습니다.")
except Exception as e:
    print(f"모델 가중치 로드 실패: {e}")
    exit()

model.eval()

# MTCNN 모델 초기화
detector = MTCNN()

# 이미지 전처리 함수
transform = transforms.Compose([
    transforms.Resize((128, 128)),
    transforms.ToTensor(),
])

# 주파수 변환 함수 (FFT)
def fft_transform(image):
    gray = image.mean(dim=1, keepdim=True)  # 그레이스케일로 변환
    f = torch.fft.fft2(gray)  # 푸리에 변환
    fshift = torch.fft.fftshift(f)  # 주파수 영역 중앙으로 이동
    magnitude_spectrum = torch.abs(fshift)  # 크기 스펙트럼 반환

    # 주파수 영역 정보가 1채널로 반환되므로, 3채널로 확장
    magnitude_spectrum = magnitude_spectrum.repeat(1, 3, 1, 1)  # 3채널로 확장
    return magnitude_spectrum

# 웹캠 캡처
cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("웹캠을 열 수 없습니다.", file=sys.stderr)
    sys.exit(1)

while True:
    ret, frame = cap.read()
    if not ret:
        print("웹캠에서 프레임을 읽을 수 없습니다.", file=sys.stderr)
        break

    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    faces = detector.detect_faces(rgb_frame)

    for face in faces:
        x, y, w, h = face['box']
        face_image = rgb_frame[y:y+h, x:x+w]
        face_pil = Image.fromarray(face_image)

        face_tensor = transform(face_pil).unsqueeze(0).to(device)
        with torch.no_grad():
            outputs = model(face_tensor, face_tensor)
            probabilities = torch.softmax(outputs, dim=1)
            real_prob = probabilities[0][0].item()
            fake_prob = probabilities[0][1].item()
            label = 'Real' if real_prob > fake_prob else 'Fake'

        result = {
            "label": label,
            "real_prob": real_prob,
            "fake_prob": fake_prob
        }

        # JSON 형태로 결과를 출력
        print(json.dumps(result))
        sys.stdout.flush() 