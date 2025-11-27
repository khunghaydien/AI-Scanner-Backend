#!/usr/bin/env python3
"""
Color Image Scanner using OpenCV
Scans image while preserving colors (not converting to black & white).
Places the image in A4 PDF frame with white background.
"""

import sys
import os
import cv2
import numpy as np
from PIL import Image
import img2pdf
import requests
from urllib.parse import urlparse


def download_image_from_url(url: str) -> np.ndarray:
    """
    Download image from URL and convert to OpenCV format.
    
    Args:
        url: URL to image
    Returns:
        Image as numpy array (BGR format for OpenCV)
    """
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    
    # Convert bytes to numpy array
    nparr = np.frombuffer(response.content, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if image is None:
        raise ValueError(f"Could not decode image from URL: {url}")
    
    return image


def create_a4_page_from_image(pil_image: Image.Image, dpi: int = 300) -> Image.Image:
    """
    Create an A4 page with image centered on white background.
    Scale ảnh để vừa khung A4: nếu ảnh nhỏ thì scale up, nếu ảnh to thì scale down.
    Dừng khi chạm width hoặc height, luôn giữ nguyên tỷ lệ khung hình.
    
    Args:
        pil_image: PIL Image to place on A4 page
        dpi: DPI for the page (default 300)
    Returns:
        PIL Image of A4 page with image centered
    """
    # Prepare A4 page parameters
    a4_width_mm, a4_height_mm = 210, 297
    a4_width_px = int((a4_width_mm / 25.4) * dpi)
    a4_height_px = int((a4_height_mm / 25.4) * dpi)
    
    # Create white A4 background
    a4_background = Image.new('RGB', (a4_width_px, a4_height_px), color='white')
    
    # Ensure the image is RGB
    if pil_image.mode != 'RGB':
        pil_image = pil_image.convert('RGB')
    
    img_width, img_height = pil_image.size
    
    # Tính tỷ lệ scale cho cả width và height
    # Lấy min để đảm bảo ảnh vừa khung (dừng khi chạm width hoặc height)
    scale_ratio_width = a4_width_px / img_width
    scale_ratio_height = a4_height_px / img_height
    scale_ratio = min(scale_ratio_width, scale_ratio_height)
    
    # Scale ảnh theo tỷ lệ (scale up nếu nhỏ, scale down nếu to)
    new_width = int(img_width * scale_ratio)
    new_height = int(img_height * scale_ratio)
    
    # Resize ảnh giữ nguyên tỷ lệ khung hình
    pil_image = pil_image.resize((new_width, new_height), Image.Resampling.LANCZOS)
    
    # Center image on A4
    x_offset_px = (a4_width_px - new_width) // 2
    y_offset_px = (a4_height_px - new_height) // 2
    a4_background.paste(pil_image, (x_offset_px, y_offset_px))
    
    return a4_background


def scan_image_color(input_path: str, output_path: str) -> None:
    """
    Process image to create a scanned document effect with colors preserved and place it in A4 PDF frame.
    
    Args:
        input_path: Path to input image or URL to image
        output_path: Path to save scanned PDF (must be .pdf)
    """
    try:
        # === Check if input is URL or file path ===
        parsed = urlparse(input_path)
        is_url = parsed.scheme in ('http', 'https')
        
        # === Read image from URL or file ===
        if is_url:
            image = download_image_from_url(input_path)
        else:
            image = cv2.imread(input_path)
            if image is None:
                raise ValueError(f"Could not read image from {input_path}")

        # === Giữ nguyên màu, chỉ convert BGR to RGB ===
        # Convert BGR to RGB (không làm sáng, không enhance)
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # === Convert to PIL image for PDF generation (giữ nguyên màu gốc) ===
        pil_image = Image.fromarray(image_rgb)
        
        # === Prepare A4 page parameters ===
        a4_width_mm, a4_height_mm = 210, 297
        dpi = 300
        a4_layout = (img2pdf.mm_to_pt(a4_width_mm), img2pdf.mm_to_pt(a4_height_mm))
        
        # === Create A4 page with image centered ===
        a4_background = create_a4_page_from_image(pil_image, dpi)
        
        # === Save temporary PNG ===
        temp_a4_path = os.path.join(os.path.dirname(output_path), f"temp_a4_color_{os.getpid()}.png")
        a4_background.save(temp_a4_path, 'PNG', dpi=(dpi, dpi))
        
        # === Convert to PDF with A4 layout ===
        with open(output_path, 'wb') as f:
            f.write(img2pdf.convert(temp_a4_path, layout_fun=img2pdf.get_layout_fun(a4_layout)))
        
        # === Cleanup ===
        if os.path.exists(temp_a4_path):
            os.unlink(temp_a4_path)
        
        print(f"✅ Successfully scanned color image → PDF A4: {output_path}", file=sys.stdout)
    
    except Exception as e:
        print(f"❌ Error scanning color image: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python3 scan_image_color.py <input_path> <output_path>", file=sys.stderr)
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    scan_image_color(input_path, output_path)

