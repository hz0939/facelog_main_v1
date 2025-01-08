from flask import Flask, render_template, Response
import cv2
import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision.transforms import transforms
from PIL import Image
from facenet_pytorch import MTCNN

# Flask ���ø����̼� �ʱ�ȭ
app = Flask(__name__)

# �� ����: CDCN_Spatial_Frequency
class CDCN_Spatial_Frequency(nn.Module):
    def __init__(self):
        super(CDCN_Spatial_Frequency, self).__init__()

        # ������ ���� ó�� ��Ʈ��ũ (RGB �̹���)
        self.conv1_rgb = nn.Conv2d(3, 32, kernel_size=3, padding=1)
        self.conv2_rgb = nn.Conv2d(32, 64, kernel_size=3, padding=1)
        self.conv3_rgb = nn.Conv2d(64, 128, kernel_size=3, padding=1)

        # ���ļ� ���� ó�� ��Ʈ��ũ (���ļ� ����)
        self.conv1_fft = nn.Conv2d(3, 32, kernel_size=3, padding=1)
        self.conv2_fft = nn.Conv2d(32, 64, kernel_size=3, padding=1)
        self.conv3_fft = nn.Conv2d(64, 128, kernel_size=3, padding=1)

        # ���� �� fully connected
        self.fc1 = nn.Linear(128 * 32 * 32 * 2, 512)  # �� ��Ʈ��ũ���� ���� Ư¡�� ����
        self.fc2 = nn.Linear(512, 2)  # 2 Ŭ���� (REAL or FAKE)

    def forward(self, x_rgb, x_fft):
        # RGB �̹��� ó��
        x_rgb = F.relu(self.conv1_rgb(x_rgb))
        x_rgb = F.max_pool2d(F.relu(self.conv2_rgb(x_rgb)), 2)
        x_rgb = F.max_pool2d(F.relu(self.conv3_rgb(x_rgb)), 2)

        # ���ļ� ���� ó��
        x_fft = F.relu(self.conv1_fft(x_fft))
        x_fft = F.max_pool2d(F.relu(self.conv2_fft(x_fft)), 2)
        x_fft = F.max_pool2d(F.relu(self.conv3_fft(x_fft)), 2)

        # �� ��Ʈ��ũ���� ���� Ư�� ����
        x = torch.cat((x_rgb.view(x_rgb.size(0), -1), x_fft.view(x_fft.size(0), -1)), dim=1)
        x = F.relu(self.fc1(x))
        x = self.fc2(x)
        return x

# �� �ʱ�ȭ �� ����ġ �ε�
device = 'cuda' if torch.cuda.is_available() else 'cpu'
model = CDCN_Spatial_Frequency().to(device)
model.load_state_dict(torch.load('./models/fft_v4.pth', map_location=device))
model.eval()

# MTCNN �ʱ�ȭ
mtcnn = MTCNN(keep_all=True, device=device)

# �̹��� ��ó�� �Լ�
transform = transforms.Compose([
    transforms.Resize((128, 128)),
    transforms.ToTensor()
])

def fft_transform(image):
    gray = image.mean(dim=1, keepdim=True)  # RGB -> Grayscale
    f = torch.fft.fft2(gray)  # Ǫ���� ��ȯ
    fshift = torch.fft.fftshift(f)
    magnitude_spectrum = torch.abs(fshift)
    return magnitude_spectrum.repeat(1, 3, 1, 1)

# ��ķ ������ ����
camera = cv2.VideoCapture(0)

def generate_frames():
    while True:
        success, frame = camera.read()
        if not success:
            break
        else:
            # BGR -> RGB ��ȯ
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # MTCNN���� �� Ž��
            boxes, _ = mtcnn.detect(rgb_frame)

            if boxes is not None:
                for box in boxes:
                    x1, y1, x2, y2 = map(int, box)
                    x1, y1, x2, y2 = max(0, x1), max(0, y1), min(frame.shape[1], x2), min(frame.shape[0], y2)
                    
                    # �� ���� �߶󳻱�
                    face = rgb_frame[y1:y2, x1:x2]
                    
                    if face.size > 0:  # �� ������ �ִ� ���
                        face_pil = Image.fromarray(face)
                        face_tensor = transform(face_pil).unsqueeze(0).to(device)
                        freq_tensor = fft_transform(face_tensor)

                        # �� ����
                        with torch.no_grad():
                            output = model(face_tensor, freq_tensor)
                            probability = torch.softmax(output, 1)
                            real_prob = probability[0, 0]
                            fake_prob = probability[0, 1]

                            # ���� ��� ����
                            if real_prob >= 7 * fake_prob:  # �ǽð� �Ǵ� ���� ����
                                label = "Real"
                            else:
                                label = "Fake"

                        # ��� ǥ��
                        color = (0, 255, 0) if label == "Real" else (0, 0, 255)
                        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                        cv2.putText(frame, label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, color, 2)

            # OpenCV �̹����� ����Ʈ �������� ��ȯ
            _, buffer = cv2.imencode('.jpg', frame)
            frame = buffer.tobytes()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

@app.route('/')
def index():
    return render_template('index.html')  # HTML ���� ������

@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

if __name__ == '__main__':
    app.run(debug=True)
