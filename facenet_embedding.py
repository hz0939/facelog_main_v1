from facenet_pytorch import MTCNN, InceptionResnetV1
import sys
import base64
from io import BytesIO
from PIL import Image
import torch

# 이미지 데이터 파일 경로를 인수로 받음
temp_image_path = sys.argv[1]

# 이미지 데이터 파일 읽기
with open(temp_image_path, 'r') as file:
    image_data = file.read().strip()

# 'data:image/png;base64,' 접두어 제거
if image_data.startswith('data:image/png;base64,'):
    image_data = image_data.split(',')[1]

# Base64 디코딩 및 이미지 변환
image = Image.open(BytesIO(base64.b64decode(image_data)))

# 이미지가 4채널(RGBA)인 경우 3채널(RGB)로 변환
if image.mode == 'RGBA':
    image = image.convert('RGB')

# MTCNN 모델 로드 및 얼굴 검출
mtcnn = MTCNN()
face = mtcnn(image)

if face is not None:
    # InceptionResnetV1 모델 로드 및 임베딩 생성
    model = InceptionResnetV1(pretrained='vggface2').eval()
    face_embedding = model(face.unsqueeze(0))

    # 텐서 형태로 출력 (기존 형식 유지)
    print(face_embedding)
else:
    print("Face not detected.")
