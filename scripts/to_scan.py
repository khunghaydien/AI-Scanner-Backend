#!/usr/bin/env python3
"""
Image Scanner using OpenCV
Enhanced version: cleaner, flatter, and more realistic scan effect.
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


def scan_image_to_pil(image: np.ndarray) -> Image.Image:
    """
    Chuyển ảnh sang đen trắng (grayscale).
    
    Args:
        image: Input BGR image (OpenCV format)
    Returns:
        PIL Image in grayscale (black and white)
    """
    # === Convert to grayscale ===
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # === Convert to PIL image ===
    pil_image = Image.fromarray(gray)
    
    # Convert to RGB mode (grayscale as RGB)
    pil_image = pil_image.convert('RGB')
    
    return pil_image


def scan_image(input_path: str, output_path: str) -> None:
    """
    Process image to create a scanned document effect and place it in A4 PDF frame.
    
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

        # === Scan image to PIL (reuse helper function) ===
        pil_image = scan_image_to_pil(image)

        # === Prepare A4 page parameters ===
        a4_width_mm, a4_height_mm = 210, 297
        dpi = 300
        a4_layout = (img2pdf.mm_to_pt(a4_width_mm), img2pdf.mm_to_pt(a4_height_mm))

        # === Create A4 page with scanned image centered (reuse function from to_pdf.py) ===
        from to_pdf import create_a4_page_from_image
        a4_background = create_a4_page_from_image(pil_image, dpi)

        # === Save temporary PNG ===
        temp_a4_path = os.path.join(os.path.dirname(output_path), f"temp_a4_{os.getpid()}.png")
        a4_background.save(temp_a4_path, 'PNG', dpi=(dpi, dpi))

        # === Convert to PDF with A4 layout ===
        with open(output_path, 'wb') as f:
            f.write(img2pdf.convert(temp_a4_path, layout_fun=img2pdf.get_layout_fun(a4_layout)))

        # === Cleanup ===
        if os.path.exists(temp_a4_path):
            os.unlink(temp_a4_path)

        print(f"✅ Successfully scanned and cleaned image → PDF A4: {output_path}", file=sys.stdout)

    except Exception as e:
        print(f"❌ Error scanning image: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python3 scan_image.py <input_path> <output_path>", file=sys.stderr)
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]
    scan_image(input_path, output_path)
