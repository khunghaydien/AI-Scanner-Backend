#!/usr/bin/env python3
"""
Smart Document Extractor using rembg and OpenCV
Automatically isolates the main object (e.g., document, card, photo) 
from any background color and crops it tightly in a rectangular frame.
"""

import sys
import cv2
import numpy as np
from rembg import remove
from PIL import Image
import requests
from urllib.parse import urlparse


def is_dark_background(image):
    """
    Kiểm tra xem nền ảnh có phải là màu tối (đen, xanh đậm, v.v.) hay không.
    
    Args:
        image: Input BGR image
    Returns:
        True nếu nền tối, False nếu nền sáng
    """
    h, w = image.shape[:2]
    
    # Chuyển sang grayscale để kiểm tra độ sáng
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Lấy các vùng biên/cạnh của ảnh (thường là nền)
    border_width = min(50, w // 10, h // 10)  # Lấy 10% hoặc tối đa 50px
    
    # Lấy các vùng biên: trên, dưới, trái, phải
    top_border = gray[0:border_width, :]
    bottom_border = gray[h-border_width:h, :]
    left_border = gray[:, 0:border_width]
    right_border = gray[:, w-border_width:w]
    
    # Gộp tất cả các vùng biên
    borders = np.concatenate([
        top_border.flatten(),
        bottom_border.flatten(),
        left_border.flatten(),
        right_border.flatten()
    ])
    
    # Tính giá trị trung bình độ sáng của nền
    avg_brightness = np.mean(borders)
    
    # Ngưỡng: < 128 (50% độ sáng) = nền tối, >= 128 = nền sáng
    # Có thể điều chỉnh ngưỡng này nếu cần
    is_dark = avg_brightness < 128
    
    return is_dark


def extract_main_object(image):
    """
    Detect and crop the main object from any background using rembg and OpenCV.

    Args:
        image: Input BGR image (cv2.imread)
    Returns:
        Cropped image containing the main object with transparent/white background.
    """
    original = image.copy()
    h, w = image.shape[:2]

    # === Step 0: Kiểm tra màu nền - chỉ cắt nếu nền tối ===
    if not is_dark_background(image):
        # Nền sáng (trắng/sáng) → không cắt, trả về ảnh gốc
        return original

    # === Step 0.5: Resize ảnh lớn để tránh OOM nhưng vẫn giữ chất lượng ===
    # max_dimension: Kích thước tối đa (chiều dài nhất - width hoặc height) của ảnh trước khi xử lý với rembg
    # - Nếu ảnh > max_dimension → resize xuống max_dimension (giữ tỷ lệ)
    # - Sau khi xử lý xong → scale lại kết quả về tỷ lệ tương ứng với ảnh gốc
    # - Kích thước lớn hơn = chính xác hơn nhưng tốn nhiều memory hơn
    max_dimension = 1920 
    scale = 1.0
    resized_image = image
    original_h, original_w = h, w
    
    if max(h, w) > max_dimension:
        scale = max_dimension / max(h, w)
        new_width = int(w * scale)
        new_height = int(h * scale)
        resized_image = cv2.resize(image, (new_width, new_height), interpolation=cv2.INTER_AREA)
        print(f"Resized image from {w}x{h} to {new_width}x{new_height} to avoid OOM", file=sys.stderr)
        h, w = new_height, new_width

    # === Step 1: Use rembg to remove background (chỉ khi nền tối) ===
    try:
        # Convert BGR to RGB for PIL
        image_rgb = cv2.cvtColor(resized_image, cv2.COLOR_BGR2RGB)
        pil_image = Image.fromarray(image_rgb)
        
        # Remove background using rembg với tham số tối ưu
        # only_person=False để xử lý document tốt hơn
        # alpha_matting=False để giảm memory usage
        output = remove(pil_image, only_person=False, alpha_matting=False)
        
        # Convert back to numpy array
        output_array = np.array(output)
    except Exception as e:
        print(f"Error in rembg: {str(e)}, returning original image", file=sys.stderr)
        return original
    
    # === Step 2: Use OpenCV to find bounding box of non-transparent pixels ===
    # Extract alpha channel (transparency mask)
    if output_array.shape[2] == 4:
        alpha = output_array[:, :, 3]
    else:
        # If no alpha channel, convert to grayscale for mask
        gray = cv2.cvtColor(output_array, cv2.COLOR_RGB2GRAY)
        alpha = gray
    
    # Create binary mask (non-transparent pixels)
    _, mask = cv2.threshold(alpha, 10, 255, cv2.THRESH_BINARY)
    
    # Find contours of the mask
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if not contours:
        # Nếu không tìm thấy contour, scale lại về kích thước gốc nếu đã resize
        if scale < 1.0:
            return cv2.resize(resized_image, (original_w, original_h), interpolation=cv2.INTER_LINEAR)
        return original
    
    # Get the largest contour (main object)
    max_contour = max(contours, key=cv2.contourArea)
    area = cv2.contourArea(max_contour)
    
    # If object is too small (< 5% of image), return original
    if area < (w * h * 0.05):
        if scale < 1.0:
            return cv2.resize(resized_image, (original_w, original_h), interpolation=cv2.INTER_LINEAR)
        return original
    
    # === Step 3: Get bounding rectangle (tự động theo kích thước object) ===
    x, y, bw, bh = cv2.boundingRect(max_contour)
    
    # Add padding for safety margin (tỷ lệ % theo kích thước object, không fix cứng)
    pad = max(5, int(0.02 * max(bw, bh)))  # Tối thiểu 5px padding
    x1 = max(0, x - pad)
    y1 = max(0, y - pad)
    x2 = min(w, x + bw + pad)
    y2 = min(h, y + bh + pad)
    
    # Tính kích thước thực tế của vùng cắt (tự động theo object)
    crop_width = x2 - x1
    crop_height = y2 - y1
    
    # === Step 4: Crop the RGBA image (kích thước output tự động theo object) ===
    cropped_rgba = output_array[y1:y2, x1:x2]
    
    # Kích thước output sẽ là (crop_height, crop_width) - tự động thay đổi theo object
    
    # === Step 5: Convert to BGR with white background ===
    # Extract RGB channels
    if cropped_rgba.shape[2] == 4:
        rgb = cropped_rgba[:, :, :3]
        alpha_channel = cropped_rgba[:, :, 3]
    else:
        rgb = cropped_rgba
        alpha_channel = np.ones((cropped_rgba.shape[0], cropped_rgba.shape[1]), dtype=np.uint8) * 255
    
    # Create white background
    white_bg = np.ones_like(rgb) * 255
    
    # Normalize alpha to 0-1 range
    alpha_normalized = alpha_channel.astype(np.float32) / 255.0
    alpha_3d = np.stack([alpha_normalized] * 3, axis=2)
    
    # Blend RGB with white background using alpha
    result = (rgb * alpha_3d + white_bg * (1 - alpha_3d)).astype(np.uint8)
    
    # Convert RGB to BGR for OpenCV
    result_bgr = cv2.cvtColor(result, cv2.COLOR_RGB2BGR)
    
    # === Step 6: Scale lại kết quả về kích thước tương ứng với ảnh gốc nếu đã resize ===
    if scale < 1.0:
        # Tính kích thước mới dựa trên tỷ lệ scale và kích thước crop
        new_crop_width = int(crop_width / scale)
        new_crop_height = int(crop_height / scale)
        # Scale lại với interpolation tốt để giữ chất lượng
        result_bgr = cv2.resize(result_bgr, (new_crop_width, new_crop_height), interpolation=cv2.INTER_LINEAR)
    
    # Kích thước output: (crop_height, crop_width) - tự động theo kích thước object
    # Không fix cứng, sẽ thay đổi tùy theo từng ảnh
    return result_bgr


if __name__ == "__main__":
    """
    Usage:
        python3 extract_document.py <input_path> <output_path>
    """
    if len(sys.argv) != 3:
        print("Usage: python3 extract_document.py <input_path> <output_path>", file=sys.stderr)
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    try:
        # === Check if input is URL or file path ===
        parsed = urlparse(input_path)
        is_url = parsed.scheme in ('http', 'https')
        
        # === Read image from URL or file ===
        if is_url:
            response = requests.get(input_path, timeout=30)
            response.raise_for_status()
            nparr = np.frombuffer(response.content, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if image is None:
                raise ValueError(f"Could not decode image from URL: {input_path}")
        else:
            image = cv2.imread(input_path)
            if image is None:
                raise ValueError(f"Could not read image from {input_path}")

        cropped = extract_main_object(image)
        
        # Đảm bảo output là PNG (image format, không phải PDF)
        # Nếu output_path không có extension .png, thêm vào
        if not output_path.lower().endswith(('.png', '.jpg', '.jpeg')):
            output_path = output_path.replace('.pdf', '.png')
        
        # Lưu ảnh PNG (không phải PDF)
        cv2.imwrite(output_path, cropped, [cv2.IMWRITE_PNG_COMPRESSION, 6])

        print(f"✅ Successfully extracted object as PNG image: {output_path}", file=sys.stdout)

    except Exception as e:
        print(f"❌ Error extracting object: {str(e)}", file=sys.stderr)
        sys.exit(1)
