from facenet_pytorch import MTCNN, InceptionResnetV1
import sys
import base64
from io import BytesIO
from PIL import Image
import torch

temp_image_path = sys.argv[1]
with open(temp_image_path, 'r') as file:
    image_data = file.read().strip()

if image_data.startswith('data:image/png;base64,'):
    image_data = image_data.split(',')[1]

image = Image.open(BytesIO(base64.b64decode(image_data)))

if image.mode == 'RGBA':
    image = image.convert('RGB')

mtcnn = MTCNN()
face = mtcnn(image)

if face is not None:
    model = InceptionResnetV1(pretrained='vggface2').eval()
    face_embedding = model(face.unsqueeze(0))
    print(face_embedding)
else:
    print("Face not detected.")
